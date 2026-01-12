#!/usr/bin/env python3
"""
Weighted search for organizations.
Supports both CSV file and Supabase database as data sources.
"""
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
        # Check org name for gender-specific keywords
        if 'female' in org_name or 'women' in org_name or 'woman' in org_name:
            if user_gender not in ['female', 'woman']:
                return False
        if 'male' in org_name or 'men' in org_name or 'man' in org_name:
            if user_gender not in ['male', 'man']:
                return False
        
        # Check eligible_gender field
        if eligible_gender and eligible_gender not in ['nan', 'none', '']:
            eligible_gender_lower = eligible_gender.lower()
            
            # If "all" is set, allow everyone
            if eligible_gender_lower == 'all':
                pass  # Allow all genders
            elif 'female' in eligible_gender_lower or 'women' in eligible_gender_lower or 'woman' in eligible_gender_lower:
                if user_gender not in ['female', 'woman']:
                    return False
            elif 'male' in eligible_gender_lower or 'men' in eligible_gender_lower or 'man' in eligible_gender_lower:
                if user_gender not in ['male', 'man']:
                    return False
            else:
                # Custom "Other" value - check if user gender matches (case-insensitive)
                user_gender_lower = user_gender.lower()
                if user_gender_lower not in eligible_gender_lower and eligible_gender_lower not in user_gender_lower:
                    # Try partial match for custom values
                    if not any(word in eligible_gender_lower for word in user_gender_lower.split()):
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
    if user_sexuality:
        if eligible_sexuality and eligible_sexuality not in ['nan', 'none', '']:
            eligible_sexuality_lower = eligible_sexuality.lower()
            user_sexuality_lower = user_sexuality.lower()
            
            # If "all" is set, allow everyone
            if eligible_sexuality_lower == 'all':
                pass  # Allow all sexualities
            # Check for standard sexuality matches
            elif user_sexuality_lower == 'straight' and 'straight' in eligible_sexuality_lower:
                pass  # Match
            elif user_sexuality_lower == 'gay' and 'gay' in eligible_sexuality_lower:
                pass  # Match
            elif user_sexuality_lower == 'lesbian' and 'lesbian' in eligible_sexuality_lower:
                pass  # Match
            # Check if user sexuality is in the eligible string (for custom values)
            elif user_sexuality_lower in eligible_sexuality_lower or eligible_sexuality_lower in user_sexuality_lower:
                pass  # Match (handles custom "Other" values)
            else:
                # No match found - filter out
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
    
    # Career field filtering - check if org's career fields match user's interests
    if typical_majors and typical_majors not in ['nan', 'none', ''] and user_career_fields:
        # Mapping from user's career field selections to possible org field values
        career_field_keywords = {
            'engineering': ['engineering', 'engineer', 'tech'],
            'technology/computer science': ['computer', 'technology', 'tech', 'cs', 'programming', 'software', 'coding', 'science'],
            'business/finance': ['business', 'finance', 'mays', 'accounting', 'economics'],
            'medicine/healthcare': ['medicine', 'medical', 'health', 'healthcare', 'pre-med', 'premed', 'bims', 'biology'],
            'law': ['law', 'legal', 'pre-law', 'prelaw'],
            'education': ['education', 'teaching', 'teach'],
            'arts/design': ['art', 'arts', 'design', 'graphic'],
            'science/research': ['science', 'research', 'chemistry', 'physics'],
            'agriculture': ['agriculture', 'ag', 'agri'],
            'communication/media': ['communication', 'media', 'journalism', 'journal'],
            'social work': ['social work', 'social'],
            'government/public service': ['government', 'public', 'public service', 'political', 'politics'],
            'sports/fitness': ['sports', 'fitness', 'athletic', 'athletics', 'recreation'],
            'hospitality/tourism': ['hospitality', 'tourism', 'hotel', 'restaurant']
        }
        
        org_career_fields_lower = typical_majors.lower()
        matches_any_career = False
        
        for career_field in user_career_fields:
            career_lower = career_field.lower()
            # Direct match
            if career_lower in org_career_fields_lower:
                matches_any_career = True
                break
            # Keyword match
            if career_lower in career_field_keywords:
                for keyword in career_field_keywords[career_lower]:
                    if keyword in org_career_fields_lower:
                        matches_any_career = True
                        break
                if matches_any_career:
                    break
        
        if not matches_any_career:
            return False
    
    return True

def calculate_relevance_score(org_row, query_keywords, user_data=None):
    """Calculate relevance score with refined weightings"""
    score = 0
    
    # Normalize all text to lowercase
    name = str(org_row.get('name', '')).lower()
    typical_majors = str(org_row.get('typical_majors', '')).lower()
    typical_activities = str(org_row.get('typical_activities', '')).lower()
    club_culture_style = str(org_row.get('club_culture_style', '')).lower()
    bio = str(org_row.get('bio', '')).lower()
    
    # Extract user career fields if available
    user_career_fields = []
    if user_data and user_data.get('careerFields'):
        career_fields = user_data.get('careerFields', [])
        if isinstance(career_fields, list):
            user_career_fields = [str(f).lower() for f in career_fields if f]
        elif isinstance(career_fields, str):
            user_career_fields = [f.strip().lower() for f in career_fields.split(',') if f.strip()]
    
    # Extract user major if available
    user_major = ''
    if user_data and user_data.get('major'):
        user_major = str(user_data.get('major', '')).strip().lower()
    
    # Categorize keywords by importance
    career_keywords = ['engineering', 'business', 'finance', 'medicine', 'healthcare', 
                      'law', 'education', 'arts', 'design', 'technology', 'computer', 
                      'science', 'research', 'agriculture', 'communication', 'media',
                      'social', 'work', 'government', 'public', 'service', 'sports',
                      'fitness', 'hospitality', 'tourism']
    
    activity_keywords = ['volunteering', 'social', 'events', 'projects', 'competitions', 
                        'workshops', 'trips']
    
    demographic_keywords = ['male', 'female', 'asian', 'white', 'black', 'hispanic', 
                           'freshman', 'sophomore', 'junior', 'senior', 'graduate',
                           'christian', 'muslim', 'jewish', 'hindu', 'buddhist',
                           'campus', 'off-campus', 'on-campus']
    
    # Weight multipliers based on keyword category
    def get_keyword_weight(keyword):
        kw_lower = keyword.lower()
        if any(career in kw_lower for career in career_keywords):
            return 1.2  # Career fields are important but not overly weighted
        elif any(activity in kw_lower for activity in activity_keywords):
            return 1.2  # Activities are equally important
        elif any(demo in kw_lower for demo in demographic_keywords):
            return 0.3  # Demographics are for filtering, not ranking
        return 1.0  # Default weight
    
    # Refined field weights
    FIELD_WEIGHTS = {
        'name': 12,           # Name matches are very strong signals
        'typical_majors': 10,  # Reduced - majors are important but not everything
        'typical_activities': 8, # Activities matter a lot
        'club_culture_style': 4, # Less important
        'bio': 2,             # Bio can be informative
        'bio_phrase': 6,      # Phrase matches in bio are valuable
    }
    
    # Major matching: HIGH PRIORITY - Match user's major directly to org's typical_majors
    # This is very important for accurate matching
    major_match_bonus = 0
    if user_major and typical_majors and typical_majors != 'nan':
        typical_majors_lower = typical_majors.lower()
        user_major_lower = user_major.lower()
        
        # Exact match (highest priority)
        if user_major_lower in typical_majors_lower:
            major_match_bonus = FIELD_WEIGHTS['typical_majors'] * 1.8  # High weight for exact major match
        # Partial match - check if major words appear in typical_majors
        elif any(word in typical_majors_lower for word in user_major_lower.split() if len(word) > 3):
            major_match_bonus = FIELD_WEIGHTS['typical_majors'] * 1.3  # Good weight for partial match
        # Reverse check - if org major appears in user major
        elif any(word in user_major_lower for word in typical_majors_lower.split(',') if len(word.strip()) > 3):
            major_match_bonus = FIELD_WEIGHTS['typical_majors'] * 1.1  # Moderate weight for reverse match
    
    score += major_match_bonus
    
    # Direct career field matching: Match user's career fields directly to org's typical_majors (which contains career fields)
    # Reduced weight - career fields are less important than actual major
    career_matches = 0
    if user_career_fields and typical_majors and typical_majors != 'nan':
        # Parse org's career fields from typical_majors (comma-separated)
        org_career_fields = [f.strip().lower() for f in typical_majors.split(',') if f.strip()]
        
        # Match each user career field to org career fields
        for user_career in user_career_fields:
            user_career_lower = user_career.lower()
            # Direct exact match
            if user_career_lower in org_career_fields:
                score += FIELD_WEIGHTS['typical_majors'] * 0.8  # Reduced weight for direct match
                career_matches += 1
            # Partial match (e.g., "Engineering" matches "Engineering, Business/Finance" or vice versa)
            elif any(user_career_lower in org_field or org_field in user_career_lower for org_field in org_career_fields):
                score += FIELD_WEIGHTS['typical_majors'] * 0.6  # Reduced weight for partial match
                career_matches += 1
            # Check if user career field keywords appear in org career fields
            elif any(keyword in typical_majors for keyword in user_career_lower.split()):
                score += FIELD_WEIGHTS['typical_majors'] * 0.4  # Lower weight for keyword match
                career_matches += 1
    
    # Extract organization name words for better matching
    import re
    name_words = []
    name_parts = re.split(r'[,\s\-&]+', name)
    for part in name_parts:
        if part and len(part) > 2:
            name_words.append(part.lower())
            if part.isupper() and len(part) > 1:
                name_words.append(part.lower())
    
    # Check each keyword with category weighting
    matches_count = 0
    activity_matches = 0
    
    for keyword in query_keywords:
        keyword_lower = keyword.lower().strip()
        if not keyword_lower or len(keyword_lower) < 2:
            continue
        
        weight = get_keyword_weight(keyword)
        keyword_matched = False
            
        # Name match (weighted)
        if keyword_lower in name or any(keyword_lower in word for word in name_words):
            score += FIELD_WEIGHTS['name'] * weight
            keyword_matched = True
        
        # Typical majors match (weighted)
        if typical_majors and typical_majors != 'nan' and keyword_lower in typical_majors:
            score += FIELD_WEIGHTS['typical_majors'] * weight
            keyword_matched = True
            if weight >= 1.2:  # Career field match
                career_matches += 1
        
        # Activities match (weighted)
        if typical_activities and typical_activities != 'nan' and keyword_lower in typical_activities:
            score += FIELD_WEIGHTS['typical_activities'] * weight
            keyword_matched = True
            if weight >= 1.2:  # Activity match
                activity_matches += 1
        
        # Culture style match
        if club_culture_style and club_culture_style != 'nan' and keyword_lower in club_culture_style:
            score += FIELD_WEIGHTS['club_culture_style'] * weight
            keyword_matched = True
        
        # Bio match (weighted)
        if keyword_lower in bio:
            bio_score = FIELD_WEIGHTS['bio']
            if typical_majors == 'nan' or not typical_majors or typical_majors == '':
                bio_score = 8  # Higher if majors missing
            score += bio_score * weight
            keyword_matched = True
        
        # Phrase matching in bio (more sophisticated)
        if len(keyword_lower) > 4:
            bio_words = bio.split()
            for i in range(len(bio_words) - 1):
                phrase = f"{bio_words[i]} {bio_words[i+1]}"
                if keyword_lower in phrase:
                    score += FIELD_WEIGHTS['bio_phrase'] * weight
                    break
        
        if keyword_matched:
            matches_count += 1
    
    # Refined bonuses
    # Career field match bonus (reduced weight)
    if career_matches >= 2:
        score += 8  # Reduced from 15 - moderate career alignment bonus
    elif career_matches >= 1:
        score += 4  # Reduced from 8
    
    # Activity match bonus
    if activity_matches >= 3:
        score += 10
    elif activity_matches >= 2:
        score += 5
    
    # Multiple keyword match bonus (refined)
    if matches_count >= 5:
        score += 8
    elif matches_count >= 3:
        score += 5
    elif matches_count >= 2:
        score += 2
    
    # Exact phrase matching bonus
    query_text = ' '.join(query_keywords).lower()
    org_text = f"{name} {typical_majors} {typical_activities} {bio}".lower()
    
    # Check for exact multi-word phrases from query
    for i in range(len(query_keywords) - 1):
        phrase = f"{query_keywords[i].lower()} {query_keywords[i+1].lower()}"
        if phrase in org_text:
            score += 12  # Strong signal for exact phrase match
            break
    
    # Special handling for tech organizations
    tech_org_keywords = ['hack', 'acm', 'programming', 'coding', 'data science', 'computing', 'software', 'developer']
    if any(tech_term in name for tech_term in tech_org_keywords):
        tech_query_terms = ['computer', 'technology', 'tech', 'programming', 'coding', 'engineering', 'software', 'data']
        if any(term in query_text for term in tech_query_terms):
            score += 5
    
    # Competition/hackathon bonus
    if 'competitions' in typical_activities.lower() or 'hack' in name.lower():
        comp_keywords = ['competitions', 'competition', 'hack', 'hackathon']
        if any(kw in query_text for kw in comp_keywords):
            score += 3
    
    # Penalty for organizations with no career/activity alignment
    if career_matches == 0 and activity_matches == 0:
        score *= 0.7  # 30% penalty if no core matches
    
    return int(score)

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
    df['relevance_score'] = df.apply(lambda row: calculate_relevance_score(row, query_keywords, user_data), axis=1)
    
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
            'full_bio': bio,  # Include full bio for better matching insights
            'website': str(row.get('website', '')),
            'administrative_contact_info': str(row.get('administrative_contact_info', '')),
            'meeting_frequency': str(row.get('meeting_frequency', '')),
            'meeting_times': str(row.get('meeting_times', '')),
            'meeting_locations': str(row.get('meeting_locations', '')),
            'dues_required': str(row.get('dues_required', '')),
            'dues_cost': str(row.get('dues_cost', '')),
            'application_required': str(row.get('application_required', '')),
            'time_commitment': str(row.get('time_commitment', '')),
            'member_count': str(row.get('member_count', ''))
        })
    
    return results

def load_data_from_supabase(supabase_client):
    """Load organization data from Supabase into a DataFrame.
    
    Note: Supabase has a default row limit of 1000, so we need to paginate
    to fetch all organizations.
    """
    try:
        all_data = []
        page_size = 1000
        offset = 0
        
        # Paginate through all results
        while True:
            result = supabase_client.table('organizations') \
                .select('*') \
                .range(offset, offset + page_size - 1) \
                .execute()
            
            if not result.data:
                break
                
            all_data.extend(result.data)
            
            # If we got fewer than page_size, we've reached the end
            if len(result.data) < page_size:
                break
                
            offset += page_size
        
        if not all_data:
            return pd.DataFrame()
        
        # Convert to DataFrame
        df = pd.DataFrame(all_data)
        
        # Fill NaN/None values with empty strings (matching CSV behavior)
        for col in df.columns:
            df[col] = df[col].fillna('').astype(str)
        
        return df
    except Exception as e:
        print(f"Error loading data from Supabase: {e}", file=sys.stderr)
        return pd.DataFrame()


def search_clubs_supabase(query, user_data=None, supabase_client=None, top_n=10):
    """
    Search organizations using Supabase as the data source.
    Uses the same scoring logic as search_clubs but fetches data from Supabase.
    """
    if supabase_client is None:
        raise ValueError("Supabase client is required")
    
    # Load data from Supabase
    df = load_data_from_supabase(supabase_client)
    
    if len(df) == 0:
        return []
    
    # Use the same search logic as CSV-based search
    import re
    
    # Split query into keywords
    sections = query.split('|')
    query_keywords = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
        
        words = re.split(r'[,\s/\-]+', section)
        
        for word in words:
            word = word.strip()
            if word and word not in ['', 'nan', 'none'] and len(word) > 1:
                query_keywords.append(word)
                
                if ' ' in word:
                    subwords = word.split()
                    for subword in subwords:
                        subword = subword.strip()
                        if subword and len(subword) > 2:
                            query_keywords.append(subword)
    
    # Remove duplicates
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
    df['relevance_score'] = df.apply(lambda row: calculate_relevance_score(row, query_keywords, user_data), axis=1)
    
    # Filter by eligibility if user_data provided
    if user_data:
        df['is_eligible'] = df.apply(lambda row: check_eligibility(row, user_data), axis=1)
        df = df[df['is_eligible'] == True]
    
    # Sort by relevance score
    df_sorted = df.sort_values(by='relevance_score', ascending=False)
    
    # Filter to only organizations with nonzero scores
    df_with_scores = df_sorted[df_sorted['relevance_score'] > 0]
    
    # Get results
    results = []
    if top_n > 0:
        max_results = min(len(df_with_scores), top_n)
        df_to_process = df_with_scores.head(max_results)
    else:
        df_to_process = df_with_scores
    
    for idx, row in df_to_process.iterrows():
        bio = str(row.get('bio', ''))
        bio_snippet = bio[:200] + '...' if len(bio) > 200 else bio
        
        # Calculate score breakdown
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
            'id': str(row.get('id', '')),  # Include Supabase UUID
            'name': str(row.get('name', '')),
            'relevance_score': int(row['relevance_score']),
            'bio_snippet': bio_snippet,
            'typical_majors': str(row.get('typical_majors', '')),
            'typical_activities': str(row.get('typical_activities', '')),
            'club_culture_style': str(row.get('club_culture_style', '')),
            'score_breakdown': score_breakdown,
            'full_bio': bio,
            'website': str(row.get('website', '')),
            'administrative_contact_info': str(row.get('administrative_contact_info', '')),
            'meeting_frequency': str(row.get('meeting_frequency', '')),
            'meeting_times': str(row.get('meeting_times', '')),
            'meeting_locations': str(row.get('meeting_locations', '')),
            'dues_required': str(row.get('dues_required', '')),
            'dues_cost': str(row.get('dues_cost', '')),
            'application_required': str(row.get('application_required', '')),
            'time_commitment': str(row.get('time_commitment', '')),
            'member_count': str(row.get('member_count', ''))
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

