-- ============================================================================
-- Organizations Table Schema for Supabase
-- Run this SQL in Supabase SQL Editor to create the organizations table
-- ============================================================================

-- Drop existing table if needed (be careful in production!)
-- DROP TABLE IF EXISTS organizations;

-- Create organizations table with all fields from the CSV
CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic Info
    name TEXT NOT NULL,
    bio TEXT,
    website TEXT,
    administrative_contact_info TEXT,
    
    -- Membership Demographics
    typical_majors TEXT,
    all_eligible_classifications TEXT,
    typical_classifications TEXT,
    eligible_races TEXT,
    eligible_gender TEXT,
    eligible_sexuality TEXT,
    
    -- Meeting Info
    meeting_frequency TEXT,
    meeting_times TEXT,
    meeting_locations TEXT,
    
    -- Membership Requirements
    dues_required TEXT,
    dues_cost TEXT,
    application_required TEXT,
    application_difficulty TEXT,
    
    -- Organization Details
    time_commitment TEXT,
    member_count TEXT,
    club_type TEXT,
    competitive_or_non_competitive TEXT,
    leadership_roles_available TEXT,
    new_member_onboarding_process TEXT,
    
    -- Activities & Culture
    typical_activities TEXT,
    required_skills TEXT,
    offered_skills_or_benefits TEXT,
    club_culture_style TEXT,
    inclusivity_focus TEXT,
    expected_member_traits TEXT,
    
    -- Affiliation
    national_local_affiliation TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on name for faster searches
CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);

-- Create index for full-text search on bio
CREATE INDEX IF NOT EXISTS idx_organizations_bio_gin ON organizations USING gin(to_tsvector('english', COALESCE(bio, '')));

-- Create index for full-text search on typical_majors
CREATE INDEX IF NOT EXISTS idx_organizations_majors_gin ON organizations USING gin(to_tsvector('english', COALESCE(typical_majors, '')));

-- Create composite index for common search fields
CREATE INDEX IF NOT EXISTS idx_organizations_search ON organizations(name, typical_majors, typical_activities, club_culture_style);

-- Enable Row Level Security (optional - uncomment if needed)
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (optional - uncomment if needed)
-- CREATE POLICY "Organizations are publicly readable" ON organizations
--     FOR SELECT USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Sample queries for testing after migration
-- ============================================================================

-- Count total organizations
-- SELECT COUNT(*) FROM organizations;

-- Search by name
-- SELECT name, typical_majors, bio FROM organizations WHERE name ILIKE '%engineering%' LIMIT 10;

-- Full-text search on bio
-- SELECT name, bio FROM organizations 
-- WHERE to_tsvector('english', COALESCE(bio, '')) @@ plainto_tsquery('english', 'engineering volunteering')
-- LIMIT 10;

-- Search by typical_majors
-- SELECT name, typical_majors FROM organizations WHERE typical_majors ILIKE '%computer%' LIMIT 10;

