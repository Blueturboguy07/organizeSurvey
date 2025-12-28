#!/usr/bin/env python3
import json
import sys
from vector_search import search_organizations

# Test query similar to what a user would submit
test_query_old = "Engineering, Technology/Computer Science | off-campus | Freshman | South Asian | Male | gym, ai, machine learning, startups | Projects, Workshops, Social Events, Competitions | Building my resume / Career help"

test_query_new = "Engineering, Technology/Computer Science | Engineering, Technology/Computer Science | Engineering, Technology/Computer Science | Building my resume / Career help | Building my resume / Career help | Building my resume / Career help | Projects, Workshops, Social Events, Competitions | Projects, Workshops, Social Events, Competitions | gym, ai, machine learning, startups | off-campus | South Asian | Male"

user_data = {
    'gender': 'Male',
    'race': 'South Asian',
    'classification': 'Freshman',
    'sexuality': '',
    'careerFields': ['Engineering', 'Technology/Computer Science']
}

print("=" * 80)
print("TESTING QUERY WEIGHTING IMPACT")
print("=" * 80)

print("\n1. OLD QUERY (Equal Weighting):")
print(f"   Query: {test_query_old[:100]}...")
print("\n   Top 20 Results:")
results_old = search_organizations(test_query_old, user_data, top_n=20)
for i, org in enumerate(results_old[:10], 1):
    print(f"   {i}. {org['name']} ({org['similarity_score']:.3f}) - {org['club_type']}")

print("\n" + "=" * 80)
print("\n2. NEW QUERY (Weighted - Career/Goals Emphasized):")
print(f"   Query: {test_query_new[:100]}...")
print("\n   Top 20 Results:")
results_new = search_organizations(test_query_new, user_data, top_n=20)
for i, org in enumerate(results_new[:10], 1):
    print(f"   {i}. {org['name']} ({org['similarity_score']:.3f}) - {org['club_type']}")

print("\n" + "=" * 80)
print("\nANALYSIS (Top 20):")
freshman_old = sum(1 for org in results_old if 'freshman' in org['name'].lower() or 'freshmen' in org['name'].lower())
freshman_new = sum(1 for org in results_new if 'freshman' in org['name'].lower() or 'freshmen' in org['name'].lower())
eng_old = sum(1 for org in results_old if any(keyword in org['name'].lower() or keyword in org.get('bio', '').lower() for keyword in ['engineering', 'tech', 'computer', 'coding', 'programming', 'software', 'cs', 'ai', 'machine learning']))
eng_new = sum(1 for org in results_new if any(keyword in org['name'].lower() or keyword in org.get('bio', '').lower() for keyword in ['engineering', 'tech', 'computer', 'coding', 'programming', 'software', 'cs', 'ai', 'machine learning']))
career_old = sum(1 for org in results_old if 'career' in org.get('bio', '').lower() or 'resume' in org.get('bio', '').lower() or 'professional' in org.get('club_type', '').lower())
career_new = sum(1 for org in results_new if 'career' in org.get('bio', '').lower() or 'resume' in org.get('bio', '').lower() or 'professional' in org.get('club_type', '').lower())

print(f"Freshman-focused orgs:")
print(f"  Old: {freshman_old}/20 ({freshman_old/20*100:.1f}%)")
print(f"  New: {freshman_new}/20 ({freshman_new/20*100:.1f}%)")
print(f"  Change: {freshman_new - freshman_old:+d} ({((freshman_new - freshman_old)/20*100):+.1f}%)")
print(f"\nEngineering/Tech orgs:")
print(f"  Old: {eng_old}/20 ({eng_old/20*100:.1f}%)")
print(f"  New: {eng_new}/20 ({eng_new/20*100:.1f}%)")
print(f"  Change: {eng_new - eng_old:+d} ({((eng_new - eng_old)/20*100):+.1f}%)")
print(f"\nCareer/Professional-focused orgs:")
print(f"  Old: {career_old}/20 ({career_old/20*100:.1f}%)")
print(f"  New: {career_new}/20 ({career_new/20*100:.1f}%)")
print(f"  Change: {career_new - career_old:+d} ({((career_new - career_old)/20*100):+.1f}%)")

