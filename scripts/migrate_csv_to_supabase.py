#!/usr/bin/env python3
"""
Migration script to import CSV data to Supabase organizations table.

Usage:
    python scripts/migrate_csv_to_supabase.py

Environment variables required:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_SERVICE_KEY - Your Supabase service role key (NOT the anon key)

The service role key is needed to bypass RLS for bulk inserts.
"""

import os
import sys
import csv
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase-py not installed. Run: pip install supabase")
    sys.exit(1)

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# CSV file path
CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'final.csv')

# CSV columns to database columns mapping
CSV_TO_DB_COLUMNS = {
    'name': 'name',
    'typical_majors': 'typical_majors',
    'all_eligible_classifications': 'all_eligible_classifications',
    'typical_classifications': 'typical_classifications',
    'eligible_races': 'eligible_races',
    'eligible_gender': 'eligible_gender',
    'eligible_sexuality': 'eligible_sexuality',
    'meeting_frequency': 'meeting_frequency',
    'meeting_times': 'meeting_times',
    'meeting_locations': 'meeting_locations',
    'dues_required': 'dues_required',
    'dues_cost': 'dues_cost',
    'application_required': 'application_required',
    'application_difficulty': 'application_difficulty',
    'time_commitment': 'time_commitment',
    'member_count': 'member_count',
    'club_type': 'club_type',
    'competitive_or_non_competitive': 'competitive_or_non_competitive',
    'leadership_roles_available': 'leadership_roles_available',
    'new_member_onboarding_process': 'new_member_onboarding_process',
    'typical_activities': 'typical_activities',
    'required_skills': 'required_skills',
    'offered_skills_or_benefits': 'offered_skills_or_benefits',
    'club_culture_style': 'club_culture_style',
    'inclusivity_focus': 'inclusivity_focus',
    'expected_member_traits': 'expected_member_traits',
    'administrative_contact_info': 'administrative_contact_info',
    'website': 'website',
    'national_local_affiliation': 'national_local_affiliation',
    'bio': 'bio'
}


def clean_value(value: str) -> str | None:
    """Clean a CSV value - convert empty strings and 'nan' to None"""
    if value is None:
        return None
    value = str(value).strip()
    if value.lower() in ['nan', 'none', '']:
        return None
    return value


def load_csv_data(csv_path: str) -> list[dict]:
    """Load and clean CSV data"""
    organizations = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            org = {}
            for csv_col, db_col in CSV_TO_DB_COLUMNS.items():
                if csv_col in row:
                    org[db_col] = clean_value(row[csv_col])
            
            # Skip rows without a name
            if not org.get('name'):
                continue
                
            organizations.append(org)
    
    return organizations


def migrate_to_supabase(organizations: list[dict], supabase: Client, batch_size: int = 100):
    """Migrate organizations to Supabase in batches"""
    total = len(organizations)
    migrated = 0
    errors = []
    
    print(f"\nMigrating {total} organizations to Supabase...")
    
    for i in range(0, total, batch_size):
        batch = organizations[i:i + batch_size]
        batch_num = i // batch_size + 1
        
        try:
            # Insert batch
            result = supabase.table('organizations').insert(batch).execute()
            migrated += len(batch)
            print(f"  Batch {batch_num}: Inserted {len(batch)} organizations ({migrated}/{total})")
            
        except Exception as e:
            error_msg = str(e)
            errors.append({
                'batch': batch_num,
                'start_index': i,
                'error': error_msg
            })
            print(f"  Batch {batch_num}: ERROR - {error_msg}")
            
            # Try inserting one by one to identify problematic rows
            for j, org in enumerate(batch):
                try:
                    supabase.table('organizations').insert(org).execute()
                    migrated += 1
                except Exception as e2:
                    print(f"    Failed to insert '{org.get('name', 'Unknown')}': {str(e2)}")
    
    return migrated, errors


def clear_existing_data(supabase: Client):
    """Clear existing data from organizations table"""
    print("\nClearing existing organizations data...")
    try:
        # Delete all rows
        supabase.table('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        print("  Existing data cleared.")
    except Exception as e:
        print(f"  Warning: Could not clear existing data: {str(e)}")


def main():
    print("=" * 60)
    print("CSV to Supabase Migration Script")
    print("=" * 60)
    
    # Check environment variables
    if not SUPABASE_URL:
        print("\nError: SUPABASE_URL environment variable not set.")
        print("Set it in .env file or export it:")
        print("  export SUPABASE_URL='https://your-project.supabase.co'")
        sys.exit(1)
    
    if not SUPABASE_SERVICE_KEY:
        print("\nError: SUPABASE_SERVICE_KEY environment variable not set.")
        print("You need the service role key (not anon key) for bulk inserts.")
        print("Find it in Supabase Dashboard > Settings > API > service_role key")
        print("Set it in .env file or export it:")
        print("  export SUPABASE_SERVICE_KEY='your-service-role-key'")
        sys.exit(1)
    
    # Check CSV file
    if not os.path.exists(CSV_PATH):
        print(f"\nError: CSV file not found at {CSV_PATH}")
        sys.exit(1)
    
    print(f"\nSupabase URL: {SUPABASE_URL}")
    print(f"CSV Path: {CSV_PATH}")
    
    # Create Supabase client
    print("\nConnecting to Supabase...")
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("  Connected successfully!")
    except Exception as e:
        print(f"  Error connecting to Supabase: {str(e)}")
        sys.exit(1)
    
    # Load CSV data
    print("\nLoading CSV data...")
    organizations = load_csv_data(CSV_PATH)
    print(f"  Loaded {len(organizations)} organizations from CSV")
    
    if not organizations:
        print("  No organizations found in CSV. Exiting.")
        sys.exit(1)
    
    # Confirm before proceeding
    print("\n" + "=" * 60)
    print("WARNING: This will clear existing organizations data!")
    print("=" * 60)
    response = input("\nProceed with migration? (yes/no): ").strip().lower()
    
    if response != 'yes':
        print("Migration cancelled.")
        sys.exit(0)
    
    # Clear existing data
    clear_existing_data(supabase)
    
    # Migrate data
    migrated, errors = migrate_to_supabase(organizations, supabase)
    
    # Summary
    print("\n" + "=" * 60)
    print("Migration Summary")
    print("=" * 60)
    print(f"  Total in CSV: {len(organizations)}")
    print(f"  Successfully migrated: {migrated}")
    print(f"  Errors: {len(errors)}")
    
    if errors:
        print("\nErrors encountered:")
        for err in errors[:5]:  # Show first 5 errors
            print(f"  - Batch {err['batch']}: {err['error'][:100]}")
        if len(errors) > 5:
            print(f"  ... and {len(errors) - 5} more errors")
    
    print("\nMigration complete!")
    print("\nNext steps:")
    print("  1. Verify data in Supabase Dashboard > Table Editor > organizations")
    print("  2. Update your app's environment variables if needed")
    print("  3. Restart your API server to use the new database")


if __name__ == '__main__':
    main()

