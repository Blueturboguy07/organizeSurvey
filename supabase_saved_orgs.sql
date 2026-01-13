-- ============================================================================
-- Saved Organizations Table Schema for Supabase
-- Run this SQL in Supabase SQL Editor to create the saved_organizations table
-- This table tracks organizations that users want to join but aren't on the platform yet
-- ============================================================================

-- Create saved_organizations table
CREATE TABLE IF NOT EXISTS public.saved_organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  organization_name TEXT NOT NULL,
  organization_bio TEXT,
  organization_website TEXT,
  organization_contact_info TEXT,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE,
  
  -- Ensure a user can only save an organization once (by name or org_id)
  UNIQUE(user_id, organization_name),
  UNIQUE(user_id, organization_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_orgs_user_id ON public.saved_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_orgs_name ON public.saved_organizations(organization_name);
CREATE INDEX IF NOT EXISTS idx_saved_orgs_org_id ON public.saved_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_orgs_notified ON public.saved_organizations(notified_at) WHERE notified_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.saved_organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Users can view own saved organizations" ON public.saved_organizations;
DROP POLICY IF EXISTS "Users can insert own saved organizations" ON public.saved_organizations;
DROP POLICY IF EXISTS "Users can delete own saved organizations" ON public.saved_organizations;

-- Create RLS policies
-- Users can read their own saved organizations
CREATE POLICY "Users can view own saved organizations"
  ON public.saved_organizations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own saved organizations
CREATE POLICY "Users can insert own saved organizations"
  ON public.saved_organizations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saved organizations
CREATE POLICY "Users can delete own saved organizations"
  ON public.saved_organizations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable real-time for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_organizations;

-- ============================================================================
-- Function to match saved organizations when a new org joins the platform
-- This will link saved_organizations to the new organization and auto-join
-- users if the org doesn't require applications
-- ============================================================================

CREATE OR REPLACE FUNCTION match_saved_organizations()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to match saved organizations by name (case-insensitive)
  UPDATE public.saved_organizations
  SET organization_id = NEW.id
  WHERE organization_id IS NULL
    AND LOWER(TRIM(organization_name)) = LOWER(TRIM(NEW.name))
    AND notified_at IS NULL;
  
  -- Auto-join users who saved this org if it doesn't require applications
  -- Check if application_required is 'No' or empty/null
  IF NEW.application_required IS NULL 
     OR LOWER(TRIM(NEW.application_required)) = 'no'
     OR LOWER(TRIM(NEW.application_required)) = 'none'
     OR TRIM(NEW.application_required) = '' THEN
    
    -- Insert into user_joined_organizations for users who saved this org
    INSERT INTO public.user_joined_organizations (user_id, organization_id)
    SELECT DISTINCT user_id, NEW.id
    FROM public.saved_organizations
    WHERE organization_id = NEW.id
      AND user_id NOT IN (
        SELECT user_id 
        FROM public.user_joined_organizations 
        WHERE organization_id = NEW.id
      )
    ON CONFLICT (user_id, organization_id) DO NOTHING;
    
    -- Mark as notified
    UPDATE public.saved_organizations
    SET notified_at = NOW()
    WHERE organization_id = NEW.id
      AND notified_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run when a new organization is inserted
DROP TRIGGER IF EXISTS trigger_match_saved_orgs ON public.organizations;
CREATE TRIGGER trigger_match_saved_orgs
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION match_saved_organizations();

-- ============================================================================
-- Note: This table stores organizations users want to join
-- - If organization_id is NULL: Org not on platform yet
-- - If organization_id is set: Org is on platform, linked to organizations table
-- - When an org joins, the trigger automatically matches and can auto-join users
-- ============================================================================

