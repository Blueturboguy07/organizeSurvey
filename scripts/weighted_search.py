#!/usr/bin/env python3
import pandas as pd
import sys
import json

def load_data(csv_path='final.csv'):
    """Load CSV and handle missing values"""
    df = pd.read_csv(csv_path)
    
    # Fill NaN values with empty strings
    for col in df.columns:
        df[col] = df[col].fillna('').astype(str)
    
    return df

def check_eligibility(org_row, user_data):
    """Check if organization is eligible based on user demographics"""
    user_gender = user_data.get('gender', '').strip().lower()
    user_race = user_data.get('race', '').strip().lower()
    user_classification = user_data.get('classification', '').strip().lower()
    user_sexuality = user_data.get('sexuality', '').strip().lower()
    user_religion = user_data.get('religion', '').strip().lower()
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
    
    # Gender filtering
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
    
    # Race filtering
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
    
    # Classification filtering
    # Only filter out if organization explicitly restricts classifications
    # If typical_classifications exists but user doesn't match, still check all_eligible_classifications
    if user_classification:
        class_matches = False
        
        # Check typical_classifications first
        if typical_classifications and typical_classifications not in ['nan', 'none', '']:
            if user_classification in typical_classifications:
                class_matches = True
        
        # Check all_eligible_classifications if not matched yet
        if not class_matches and all_eligible_classifications and all_eligible_classifications not in ['nan', 'none', '']:
            if user_classification in all_eligible_classifications:
                class_matches = True
        
        # Filter out if user doesn't match AND:
        # 1. all_eligible_classifications is specified (explicit restriction), OR
        # 2. org name suggests it's restricted (e.g., "Graduate Student Association" for non-graduates)
        if not class_matches:
            if all_eligible_classifications and all_eligible_classifications not in ['nan', 'none', '']:
                # Explicit restriction - filter out
                return False
            
            # Check if org name suggests classification restriction
            org_name_lower = org_name
            if 'graduate' in org_name_lower and 'graduate student' in org_name_lower:
                if user_classification != 'graduate':
                    return False
            elif 'freshman' in org_name_lower or 'freshmen' in org_name_lower:
                if user_classification != 'freshman':
                    return False
            
            # If only typical_classifications is specified (but not all_eligible_classifications), 
            # don't filter out - typical_classifications just indicates what's common, not required
    
    # Sexuality filtering
    if user_sexuality and user_sexuality != 'straight':
        if eligible_sexuality and eligible_sexuality not in ['nan', 'none', '']:
            if user_sexuality not in eligible_sexuality:
                return False
    
    # Religion filtering
    # If user has a religion, only show organizations of that religion or non-religious orgs
    if user_religion:
        org_name = str(org_row.get('name', '')).lower()
        org_bio = str(org_row.get('bio', '')).lower()
        org_text = f"{org_name} {org_bio}".lower()
        
        # Detect if organization is religious and what religion
        religious_keywords = {
            'christian': ['christian', 'christ', 'jesus', 'bible', 'gospel', 'church', 'ministry', 'campus crusade', 'cru', 'methodist', 'catholic', 'baptist', 'presbyterian', 'lutheran', 'episcopal', 'orthodox christian', 'wesley', 'intervarsity', 'navigators'],
            'muslim': ['muslim', 'islam', 'islamic', 'mosque', 'masjid', 'ramadan', 'hijab'],
            'jewish': ['jewish', 'judaism', 'hillel', 'synagogue', 'hebrew', 'shabbat', 'kosher'],
            'hindu': ['hindu', 'hinduism', 'temple', 'puja', 'veda', 'yoga', 'bhakti'],
            'buddhist': ['buddhist', 'buddhism', 'buddha', 'meditation', 'zen', 'dharma']
        }
        
        # Check if org is religious
        org_religion = None
        for religion, keywords in religious_keywords.items():
            if any(keyword in org_text for keyword in keywords):
                org_religion = religion
                break
        
        # If org is religious and doesn't match user's religion, filter it out
        if org_religion and org_religion != user_religion:
            return False
        
        # Also check for user's specific religion term (for "Other" religions)
        # If user specified "Other" religion, check if org mentions that specific term
        if user_religion not in religious_keywords.keys():
            # User has a custom/other religion
            # Filter out orgs that are clearly of a different major religion
            for religion, keywords in religious_keywords.items():
                if any(keyword in org_text for keyword in keywords):
                    # Org is of a major religion, user has different religion -> filter out
                    return False
    
    # Major/career field filtering
    if typical_majors and typical_majors not in ['nan', 'none', ''] and user_career_fields:
        career_to_major_map = {
            'engineering': ['engineering', 'engineer', 'tech'],
            'technology/computer science': ['computer', 'technology', 'tech', 'cs', 'programming', 'software', 'coding'],
            'business/finance': ['business', 'finance', 'mays', 'accounting', 'economics'],
            'medicine/healthcare': ['medicine', 'medical', 'health', 'pre-med', 'premed', 'bims', 'biology'],
            'law': ['law', 'legal', 'pre-law', 'prelaw'],
            'education': ['education', 'teaching', 'teach'],
            'arts/design': ['art', 'arts', 'design', 'graphic'],
            'science/research': ['science', 'research', 'chemistry', 'physics'],
            'agriculture': ['agriculture', 'ag', 'agri'],
            'communication/media': ['communication', 'media', 'journalism', 'journal'],
            'social work': ['social work', 'social'],
            'government/public service': ['government', 'public', 'political', 'politics'],
            'sports/fitness': ['sports', 'fitness', 'athletic', 'athletics'],
            'hospitality/tourism': ['hospitality', 'tourism', 'hotel', 'restaurant']
        }
        
        org_majors_lower = typical_majors.lower()
        matches_any_career = False
        
        for career_field in user_career_fields:
            career_lower = career_field.lower()
            if career_lower in org_majors_lower:
                matches_any_career = True
                break
            if career_lower in career_to_major_map:
                for keyword in career_to_major_map[career_lower]:
                    if keyword in org_majors_lower:
                        matches_any_career = True
                        break
                if matches_any_career:
                    break
        
        if not matches_any_career:
            return False
    
    return True

def calculate_relevance_score(org_row, query_keywords):
    """Calculate relevance score based on weighted matching"""
    score = 0
    
    # Normalize all text to lowercase
    name = str(org_row.get('name', '')).lower()
    typical_majors = str(org_row.get('typical_majors', '')).lower()
    typical_activities = str(org_row.get('typical_activities', '')).lower()
    club_culture_style = str(org_row.get('club_culture_style', '')).lower()
    bio = str(org_row.get('bio', '')).lower()
    
    # Extract organization name words for better matching
    # e.g., "TAMUHack" -> ["tamuhack", "tamu", "hack"]
    # "Aggie Data Science Club" -> ["aggie", "data", "science", "club", "adsc"]
    name_words = []
    # Split on common separators and get individual words
    import re
    name_parts = re.split(r'[,\s\-&]+', name)
    for part in name_parts:
        if part and len(part) > 2:
            name_words.append(part.lower())
            # Also add acronyms (all caps sequences)
            if part.isupper() and len(part) > 1:
                name_words.append(part.lower())
    
    # Check each keyword against each field
    matches_count = 0
    for keyword in query_keywords:
        keyword_lower = keyword.lower().strip()
        if not keyword_lower or len(keyword_lower) < 2:
            continue
        
        keyword_matched = False
            
        # Match in 'name': 10 points (also check name words for partial matches)
        if keyword_lower in name or any(keyword_lower in word for word in name_words):
            score += 10
            keyword_matched = True
        
        # Match in 'typical_majors': 10 points
        if typical_majors and typical_majors != 'nan' and keyword_lower in typical_majors:
            score += 10
            keyword_matched = True
        
        # Match in 'typical_activities': 5 points
        if typical_activities and typical_activities != 'nan' and keyword_lower in typical_activities:
            score += 5
            keyword_matched = True
        
        # Match in 'club_culture_style': 5 points
        if club_culture_style and club_culture_style != 'nan' and keyword_lower in club_culture_style:
            score += 5
            keyword_matched = True
        
        # Match in 'bio': 1 point (but give extra weight if majors is NaN)
        if keyword_lower in bio:
            if typical_majors == 'nan' or not typical_majors or typical_majors == '':
                # If majors is missing, bio matches are more important
                score += 5  # Increased from 3 to 5
            else:
                score += 1
            keyword_matched = True
        
        # Also check for phrase matches in bio (e.g., "data science" as a phrase)
        # This helps organizations like "Aggie Data Science Club"
        if len(keyword_lower) > 4:  # Only for longer keywords
            # Check if keyword appears as part of a phrase in bio
            bio_words = bio.split()
            for i in range(len(bio_words) - 1):
                phrase = f"{bio_words[i]} {bio_words[i+1]}"
                if keyword_lower in phrase:
                    if typical_majors == 'nan' or not typical_majors or typical_majors == '':
                        score += 2  # Extra bonus for phrase match when majors missing
                    keyword_matched = True
                    break
        
        if keyword_matched:
            matches_count += 1
    
    # Bonus for multiple keyword matches (shows stronger relevance)
    if matches_count >= 3:
        score += 5
    elif matches_count >= 2:
        score += 2
    
    # Special handling for well-known tech organizations
    # Give bonus if organization name contains tech-related terms even if not in query
    tech_org_keywords = ['hack', 'acm', 'programming', 'coding', 'data science', 'computing', 'software', 'developer']
    if any(tech_term in name for tech_term in tech_org_keywords):
        # Check if query is tech-related
        tech_query_terms = ['computer', 'technology', 'tech', 'programming', 'coding', 'engineering', 'software', 'data']
        if any(term in ' '.join(query_keywords).lower() for term in tech_query_terms):
            score += 5  # Increased bonus for tech orgs when query is tech-related
    
    # Bonus for organizations with strong activity matches (especially competitions/hackathons)
    if 'competitions' in typical_activities.lower() or 'hack' in name.lower():
        comp_keywords = ['competitions', 'competition', 'hack', 'hackathon']
        if any(kw in ' '.join(query_keywords).lower() for kw in comp_keywords):
            score += 3  # Bonus for hackathon/competition orgs when query mentions competitions
    
    # Fix 2: Context-Aware Scoring - Detect query focus and match org relevance
    # Identify if query has specific domain terms vs generic terms
    query_text = ' '.join(query_keywords).lower()
    org_text = f"{name} {typical_majors} {bio}".lower()
    
    # Extract multi-word phrases from query (2-3 word combinations)
    query_phrases = []
    query_words_list = query_keywords
    for i in range(len(query_words_list) - 1):
        # Two-word phrases
        phrase = f"{query_words_list[i].lower()} {query_words_list[i+1].lower()}"
        query_phrases.append(phrase)
        # Three-word phrases if available
        if i < len(query_words_list) - 2:
            phrase3 = f"{query_words_list[i].lower()} {query_words_list[i+1].lower()} {query_words_list[i+2].lower()}"
            query_phrases.append(phrase3)
    
    # Detect if query has specific domain terms (multi-word phrases or domain-specific single words)
    # A query is "domain-focused" if it has phrases (2+ words together) or very specific terms
    has_specific_phrases = len([p for p in query_phrases if len(p.split()) >= 2]) > 0
    has_specific_terms = any(len(kw) > 6 for kw in query_keywords)  # Longer words tend to be more specific
    
    if has_specific_phrases or has_specific_terms:
        # Check if org matches the specific domain focus
        org_matches_specific = False
        
        # Check if any query phrase appears in org
        for phrase in query_phrases:
            if phrase in org_text:
                org_matches_specific = True
                break
        
        # Check if org has similar specific terms (words that appear together in query)
        if not org_matches_specific:
            # Count how many query keywords appear in org
            matching_keywords = sum(1 for kw in query_keywords if kw.lower() in org_text)
            keyword_match_ratio = matching_keywords / len(query_keywords) if query_keywords else 0
            
            # If org matches most keywords, it's likely relevant
            if keyword_match_ratio > 0.5:
                org_matches_specific = True
        
        if org_matches_specific:
            # Boost orgs that match the specific domain focus
            score += int(score * 0.2)  # 20% boost relative to current score
        else:
            # Penalize orgs that only match generic terms when query is specific
            # Check if org matched on very generic terms (common words)
            generic_terms = ['science', 'technology', 'tech', 'engineering', 'research', 'study']
            org_matched_generic = any(term in org_text for term in generic_terms)
            query_has_generic = any(term in query_text for term in generic_terms)
            
            if org_matched_generic and query_has_generic:
                # Check if the generic term appears in a non-matching context
                # e.g., "food technology" when query is about "computer technology"
                for generic_term in generic_terms:
                    if generic_term in query_text and generic_term in org_text:
                        # Check surrounding context - if different contexts, it's a mismatch
                        query_context = query_text[max(0, query_text.find(generic_term)-10):query_text.find(generic_term)+20]
                        org_context = org_text[max(0, org_text.find(generic_term)-10):org_text.find(generic_term)+20]
                        
                        # If contexts are very different (few shared words), penalize
                        query_context_words = set(query_context.split())
                        org_context_words = set(org_context.split())
                        shared_context = query_context_words & org_context_words
                        if len(shared_context) < 2:  # Very different contexts
                            score -= int(score * 0.3)  # 30% penalty relative to current score
                            break
    
    # Fix 3: Phrase Matching - Boost organizations that match complete phrases from query
    # Extract all 2-3 word phrases from query
    query_phrases_all = []
    for i in range(len(query_keywords)):
        # Single word (already handled above)
        # Two-word phrases
        if i < len(query_keywords) - 1:
            phrase = f"{query_keywords[i].lower()} {query_keywords[i+1].lower()}"
            query_phrases_all.append(phrase)
        # Three-word phrases
        if i < len(query_keywords) - 2:
            phrase3 = f"{query_keywords[i].lower()} {query_keywords[i+1].lower()} {query_keywords[i+2].lower()}"
            query_phrases_all.append(phrase3)
    
    org_text_full = f"{name} {typical_majors} {bio}".lower()
    
    # Check for phrase matches (prioritize longer phrases)
    phrase_matches = []
    for phrase in sorted(query_phrases_all, key=len, reverse=True):  # Longer phrases first
        if phrase in org_text_full:
            phrase_matches.append(phrase)
            # Only count each phrase once, and prefer longer matches
            break
    
    if phrase_matches:
        # Bonus proportional to phrase length and score
        longest_phrase = max(phrase_matches, key=len)
        phrase_bonus = min(int(score * 0.25), 20)  # 25% bonus, max 20 points
        score += phrase_bonus
    
    return score

def search_clubs(query, user_data=None, csv_path='final.csv', top_n=10):
    """Main search function"""
    # Load data
    df = load_data(csv_path)
    
    if len(df) == 0:
        return []
    
    # Split query into keywords - handle multiple delimiters
    # Split by common delimiters: space, comma, pipe, slash
    import re
    # First split by | to separate major sections
    sections = query.split('|')
    query_keywords = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
        
        # Split on multiple delimiters: commas, spaces, slashes, hyphens
        # This will properly split "Technology/Computer Science" into individual words
        words = re.split(r'[,\s/\-]+', section)
        
        for word in words:
            word = word.strip()
            if word and word not in ['', 'nan', 'none'] and len(word) > 1:
                # Add the word itself
                query_keywords.append(word)
                
                # For multi-word terms (after splitting), also add individual words
                # e.g., if we have "Computer Science" as one token, split it further
                if ' ' in word:
                    subwords = word.split()
                    for subword in subwords:
                        subword = subword.strip()
                        if subword and len(subword) > 2:  # Ignore very short words
                            query_keywords.append(subword)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_keywords = []
    for kw in query_keywords:
        kw_lower = kw.lower()
        if kw_lower not in seen and len(kw_lower) > 1:
            seen.add(kw_lower)
            unique_keywords.append(kw)
    
    query_keywords = unique_keywords
    
    if not query_keywords:
        return []
    
    # Calculate relevance scores
    df['relevance_score'] = df.apply(lambda row: calculate_relevance_score(row, query_keywords), axis=1)
    
    # Filter by eligibility if user_data provided
    if user_data:
        df['is_eligible'] = df.apply(lambda row: check_eligibility(row, user_data), axis=1)
        df = df[df['is_eligible'] == True]
    
    # Sort by relevance score (descending)
    df_sorted = df.sort_values(by='relevance_score', ascending=False)
    
    # Filter to only organizations with nonzero scores
    df_with_scores = df_sorted[df_sorted['relevance_score'] > 0]
    
    # Get all results with nonzero scores (or top_n if specified and smaller)
    results = []
    if top_n > 0:
        # Limit to top_n results
        max_results = min(len(df_with_scores), top_n)
        df_to_process = df_with_scores.head(max_results)
    else:
        # Return all results with nonzero scores
        df_to_process = df_with_scores
    
    for idx, row in df_to_process.iterrows():
        bio = str(row.get('bio', ''))
        bio_snippet = bio[:200] + '...' if len(bio) > 200 else bio
        
        # Calculate detailed score breakdown for insights
        score_breakdown = {
            'name_matches': 0,
            'majors_matches': 0,
            'activities_matches': 0,
            'culture_matches': 0,
            'bio_matches': 0
        }
        
        name_lower = str(row.get('name', '')).lower()
        majors_lower = str(row.get('typical_majors', '')).lower()
        activities_lower = str(row.get('typical_activities', '')).lower()
        culture_lower = str(row.get('club_culture_style', '')).lower()
        bio_lower = bio.lower()
        
        for keyword in query_keywords:
            keyword_lower = keyword.lower().strip()
            if keyword_lower in name_lower:
                score_breakdown['name_matches'] += 10
            if keyword_lower in majors_lower:
                score_breakdown['majors_matches'] += 10
            if keyword_lower in activities_lower:
                score_breakdown['activities_matches'] += 5
            if keyword_lower in culture_lower:
                score_breakdown['culture_matches'] += 5
            if keyword_lower in bio_lower:
                score_breakdown['bio_matches'] += 1
        
        results.append({
            'name': str(row.get('name', '')),
            'relevance_score': int(row['relevance_score']),
            'bio_snippet': bio_snippet,
            'typical_majors': str(row.get('typical_majors', '')),
            'typical_activities': str(row.get('typical_activities', '')),
            'club_culture_style': str(row.get('club_culture_style', '')),
            'score_breakdown': score_breakdown,
            'full_bio': bio  # Include full bio for better matching insights
        })
    
    return results

def display_results(results):
    """Display search results in a formatted way"""
    if not results:
        print("No matching clubs found.")
        return
    
    print(f"\n{'='*80}")
    print(f"Top {len(results)} Matching Clubs")
    print(f"{'='*80}\n")
    
    for i, club in enumerate(results, 1):
        print(f"{i}. {club['name']}")
        print(f"   Relevance Score: {club['relevance_score']}")
        if club['typical_majors'] and club['typical_majors'] != 'nan':
            print(f"   Majors: {club['typical_majors']}")
        if club['typical_activities'] and club['typical_activities'] != 'nan':
            print(f"   Activities: {club['typical_activities']}")
        if club['club_culture_style'] and club['club_culture_style'] != 'nan':
            print(f"   Culture: {club['club_culture_style']}")
        print(f"   Bio: {club['bio_snippet']}")
        print()

if __name__ == '__main__':
    # Check if running from API (JSON input file provided)
    if len(sys.argv) >= 2 and sys.argv[1].endswith('.json'):
        # API mode: read from JSON file
        input_file = sys.argv[1]
        csv_path = sys.argv[2] if len(sys.argv) > 2 else 'final.csv'
        
        try:
            with open(input_file, 'r') as f:
                input_data = json.load(f)
            
            query = input_data.get('query', '')
            user_data = input_data.get('userData', {})
            
            if not query:
                print(json.dumps({'error': 'Missing query in input file'}))
                sys.exit(1)
            
            # Use top_n=0 to get all results with nonzero scores
            results = search_clubs(query, user_data, csv_path, top_n=0)
            print(json.dumps(results))
        except Exception as e:
            print(json.dumps({'error': str(e)}))
            sys.exit(1)
    else:
        # Interactive mode: command line input
        csv_path = sys.argv[1] if len(sys.argv) > 1 else 'final.csv'
        
        print("="*80)
        print("Club Search - Weighted Relevance Scoring")
        print("="*80)
        print("\nEnter your search query (e.g., 'engineering social'):")
        query = input("> ").strip()
        
        if not query:
            print("No query provided. Exiting.")
            sys.exit(0)
        
        # Optional: Get user data for filtering
        print("\nOptional: Enter user data for filtering (press Enter to skip):")
        print("Format: JSON with gender, race, classification, sexuality, careerFields")
        print("Example: {\"gender\":\"Male\",\"classification\":\"Freshman\",\"careerFields\":[\"Engineering\"]}")
        user_data_str = input("> ").strip()
        
        user_data = None
        if user_data_str:
            try:
                user_data = json.loads(user_data_str)
            except json.JSONDecodeError:
                print("Invalid JSON format. Proceeding without filtering.")
        
        # Perform search
        print(f"\nSearching in '{csv_path}'...")
        results = search_clubs(query, user_data, csv_path, top_n=10)
        
        # Display results
        display_results(results)

