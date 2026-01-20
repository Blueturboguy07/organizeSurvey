-- ============================================================================
-- Applications System Schema for Supabase
-- Run this SQL in Supabase SQL Editor
-- ============================================================================

-- Add is_application_based flag to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'is_application_based'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN is_application_based BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create index on is_application_based for filtering
CREATE INDEX IF NOT EXISTS idx_organizations_application_based ON public.organizations(is_application_based);

-- ============================================================================
-- Applications Table
-- ============================================================================

-- Drop and recreate to add new columns (or use ALTER TABLE if you have existing data)
DROP TABLE IF EXISTS applications;

CREATE TABLE applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- User applying
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Organization being applied to
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Application form data
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    why_join TEXT NOT NULL,
    
    -- Status: waiting, interview, accepted, rejected
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'interview', 'accepted', 'rejected')),
    
    -- Status change tracking
    status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate applications
    UNIQUE(user_id, organization_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_organization_id ON applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- Enable Row Level Security
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own applications
CREATE POLICY "Users can read own applications" ON applications
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can create applications
CREATE POLICY "Users can create applications" ON applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own applications (withdraw)
CREATE POLICY "Users can delete own applications" ON applications
    FOR DELETE USING (auth.uid() = user_id);

-- Policy: Org account owners can read applications to their org
CREATE POLICY "Org owners can read applications" ON applications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM org_accounts 
            WHERE org_accounts.organization_id = applications.organization_id 
            AND org_accounts.user_id = auth.uid()
        )
    );

-- Policy: Org account owners can update application status
CREATE POLICY "Org owners can update application status" ON applications
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM org_accounts 
            WHERE org_accounts.organization_id = applications.organization_id 
            AND org_accounts.user_id = auth.uid()
        )
    );

-- Policy: Service role full access
CREATE POLICY "Service role full access on applications" ON applications
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Enable realtime for applications
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE applications;

-- ============================================================================
-- Add internal notes and ranking columns to applications
-- ============================================================================

-- Internal notes - only visible to org owners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'internal_notes'
  ) THEN
    ALTER TABLE public.applications ADD COLUMN internal_notes TEXT DEFAULT '';
  END IF;
END $$;

-- Numeric ranking for candidate comparison (lower = better, null = unranked)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'rank'
  ) THEN
    ALTER TABLE public.applications ADD COLUMN rank INTEGER DEFAULT NULL;
  END IF;
END $$;

-- Create index on rank for sorting
CREATE INDEX IF NOT EXISTS idx_applications_rank ON applications(rank);
