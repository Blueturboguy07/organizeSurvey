#!/usr/bin/env python3
import pandas as pd
import numpy as np
import json
import sys
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import os
import pickle

def get_embeddings_path(csv_path):
    csv_dir = os.path.dirname(csv_path)
    return os.path.join(csv_dir, 'organizations_embeddings.pkl')

def load_and_process_data(csv_path):
    df = pd.read_csv(csv_path)
    
    df_temp = df.copy()
    
    for col in df_temp.columns:
        df_temp[col] = df_temp[col].fillna('')
        df_temp[col] = df_temp[col].astype(str)
        df_temp[col] = df_temp[col].replace('nan', '')
        df_temp[col] = df_temp[col].replace('None', '')
    
    df['combined_text'] = df_temp.agg(' '.join, axis=1)
    df['combined_text'] = df['combined_text'].str.replace(r'\s+', ' ', regex=True).str.strip()
    
    return df

def check_eligibility(org_row, user_data):
    user_gender = user_data.get('gender', '').strip().lower()
    user_race = user_data.get('race', '').strip().lower()
    user_classification = user_data.get('classification', '').strip().lower()
    user_sexuality = user_data.get('sexuality', '').strip().lower()
    user_career_fields = user_data.get('careerFields', [])
    if isinstance(user_career_fields, str):
        user_career_fields = [f.strip().lower() for f in user_career_fields.split(',') if f.strip()]
    elif isinstance(user_career_fields, list):
        user_career_fields = [f.strip().lower() for f in user_career_fields if f.strip()]
    else:
        user_career_fields = []
    
    org_name = str(org_row.get('name', '')).lower()
    eligible_gender = str(org_row.get('eligible_gender', '')).strip().lower()
    eligible_races = str(org_row.get('eligible_races', '')).strip().lower()
    typical_classifications = str(org_row.get('typical_classifications', '')).strip().lower()
    all_eligible_classifications = str(org_row.get('all_eligible_classifications', '')).strip().lower()
    eligible_sexuality = str(org_row.get('eligible_sexuality', '')).strip().lower()
    typical_majors = str(org_row.get('typical_majors', '')).strip().lower()
    
    if user_gender:
        if 'female' in org_name or 'women' in org_name or 'woman' in org_name:
            if user_gender not in ['female', 'woman']:
                return False
        if 'male' in org_name or 'men' in org_name or 'man' in org_name:
            if user_gender not in ['male', 'man']:
                return False
        
        if eligible_gender and eligible_gender not in ['nan', 'none', '']:
            if 'female' in eligible_gender or 'women' in eligible_gender or 'woman' in eligible_gender:
                if user_gender not in ['female', 'woman']:
                    return False
            if 'male' in eligible_gender or 'men' in eligible_gender or 'man' in eligible_gender:
                if user_gender not in ['male', 'man']:
                    return False
    
    if user_race and eligible_races and eligible_races not in ['nan', 'none', '']:
        if 'all' not in eligible_races:
            race_matches = False
            if 'asian' in user_race and 'asian' in eligible_races:
                race_matches = True
            elif 'south asian' in user_race and ('south asian' in eligible_races or 'asian' in eligible_races):
                race_matches = True
            elif 'hispanic' in user_race and 'hispanic' in eligible_races:
                race_matches = True
            elif 'black' in user_race and 'black' in eligible_races:
                race_matches = True
            elif 'white' in user_race and 'white' in eligible_races:
                race_matches = True
            elif user_race in eligible_races:
                race_matches = True
            
            if not race_matches:
                return False
    
    if user_classification:
        class_matches = False
        if typical_classifications and typical_classifications not in ['nan', 'none', '']:
            if user_classification in typical_classifications:
                class_matches = True
        
        if not class_matches and all_eligible_classifications and all_eligible_classifications not in ['nan', 'none', '']:
            if user_classification in all_eligible_classifications:
                class_matches = True
        
        if not class_matches and typical_classifications and typical_classifications not in ['nan', 'none', '']:
            return False
    
    if user_sexuality and user_sexuality != 'straight':
        if eligible_sexuality and eligible_sexuality not in ['nan', 'none', '']:
            if user_sexuality not in eligible_sexuality:
                return False
    
    # Career field filtering: if org has specific major requirements, user must match
    if typical_majors and typical_majors not in ['nan', 'none', ''] and user_career_fields:
        # Map user career fields to common major keywords
        career_to_major_map = {
            'engineering': ['engineering', 'engineer'],
            'business/finance': ['business', 'finance', 'accounting', 'economics', 'mays'],
            'medicine/healthcare': ['medicine', 'medical', 'health', 'pre-med', 'premed', 'bims', 'biology'],
            'law': ['law', 'pre-law', 'prelaw', 'legal'],
            'education': ['education', 'teaching', 'teach'],
            'arts/design': ['art', 'arts', 'design', 'graphic'],
            'technology/computer science': ['computer science', 'cs', 'technology', 'tech', 'programming', 'software'],
            'science/research': ['science', 'research', 'chemistry', 'physics', 'biology'],
            'agriculture': ['agriculture', 'ag', 'agri'],
            'communication/media': ['communication', 'media', 'journalism', 'journal'],
            'social work': ['social work', 'social'],
            'government/public service': ['government', 'public service', 'public', 'political', 'politics'],
            'sports/fitness': ['sports', 'fitness', 'athletic', 'athletics'],
            'hospitality/tourism': ['hospitality', 'tourism', 'hotel', 'restaurant']
        }
        
        # Check if org's typical_majors matches any of user's career fields
        org_majors_lower = typical_majors.lower()
        matches_any_career = False
        
        for career_field in user_career_fields:
            career_lower = career_field.lower()
            # Direct match
            if career_lower in org_majors_lower:
                matches_any_career = True
                break
            # Check mapped keywords
            if career_lower in career_to_major_map:
                for keyword in career_to_major_map[career_lower]:
                    if keyword in org_majors_lower:
                        matches_any_career = True
                        break
                if matches_any_career:
                    break
        
        # If org has specific majors but user's career fields don't match, filter out
        if not matches_any_career:
            return False
    
    return True

def search_organizations(query, user_data, csv_path='organizations_detailed.csv', top_n=20):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    df = load_and_process_data(csv_path)
    
    if len(df) == 0:
        return []
    
    embeddings_path = get_embeddings_path(csv_path)
    
    # Try to load saved embeddings
    embeddings_loaded = False
    if os.path.exists(embeddings_path):
        try:
            with open(embeddings_path, 'rb') as f:
                cached_data = pickle.load(f)
                df['text_embeddings'] = cached_data['embeddings']
                print(f"Loaded embeddings from {embeddings_path}", file=sys.stderr)
                embeddings_loaded = True
        except Exception as e:
            print(f"Failed to load embeddings: {e}, regenerating...", file=sys.stderr)
    
    # Generate embeddings if not saved
    if not embeddings_loaded:
        print("Generating embeddings (this may take a minute on first run)...", file=sys.stderr)
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Generate embeddings in batches for better performance
        batch_size = 32
        embeddings_list = []
        for i in range(0, len(df), batch_size):
            batch = df['combined_text'].iloc[i:i+batch_size].tolist()
            batch_embeddings = model.encode(batch, show_progress_bar=False)
            embeddings_list.extend(batch_embeddings)
        
        df['text_embeddings'] = embeddings_list
        
        # Save the embeddings
        try:
            with open(embeddings_path, 'wb') as f:
                pickle.dump({'embeddings': df['text_embeddings']}, f)
            print(f"Saved embeddings to {embeddings_path}", file=sys.stderr)
        except Exception as e:
            print(f"Failed to save embeddings: {e}", file=sys.stderr)
    else:
        # Still need the model for query embedding
        model = SentenceTransformer('all-MiniLM-L6-v2')
    
    query_embedding = model.encode(query)
    
    organization_embeddings_matrix = np.vstack(df['text_embeddings'].values)
    similarities = cosine_similarity(query_embedding.reshape(1, -1), organization_embeddings_matrix)
    df['similarity_score'] = similarities[0]
    
    df_sorted = df.sort_values(by='similarity_score', ascending=False)
    
    filtered_results = []
    # Continue searching until we have top_n results after filtering
    for idx, row in df_sorted.iterrows():
        if check_eligibility(row, user_data):
            filtered_results.append({
                'name': str(row.get('name', '')),
                'bio': str(row.get('bio', '')),
                'typical_activities': str(row.get('typical_activities', '')),
                'club_type': str(row.get('club_type', '')),
                'similarity_score': float(row['similarity_score']),
                'website': str(row.get('website', '')),
                'administrative_contact_info': str(row.get('administrative_contact_info', ''))
            })
            if len(filtered_results) >= top_n:
                break
    
    return filtered_results

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Missing arguments'}))
        sys.exit(1)
    
    try:
        input_file = sys.argv[1]
        csv_path = sys.argv[2] if len(sys.argv) > 2 else 'organizations_detailed.csv'
        
        with open(input_file, 'r') as f:
            input_data = json.load(f)
        
        query = input_data.get('query', '')
        user_data = input_data.get('userData', {})
        
        if not query:
            print(json.dumps({'error': 'Missing query in input file'}))
            sys.exit(1)
        
        results = search_organizations(query, user_data, csv_path)
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

