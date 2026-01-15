-- ============================================================================
-- User Saved Organizations Table Schema for Supabase
-- Run this SQL in Supabase SQL Editor to create the user_saved_organizations table
-- This table tracks organizations a student wants to join but aren't on platform yet
-- When the org joins the platform, user gets notified and auto-joined if no application required
-- ============================================================================

-- Create user_saved_organizations table
CREATE TABLE IF NOT EXISTS public.user_saved_organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Track if user has been notified when org joined platform
  notified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Track if user was auto-joined (when org joined platform with no application required)
  auto_joined_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Ensure a user can only save an organization once
  UNIQUE(user_id, organization_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_saved_orgs_user_id ON public.user_saved_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_orgs_org_id ON public.user_saved_organizations(organization_id);

-- Enable Row Level Security
ALTER TABLE public.user_saved_organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Users can view own saved organizations" ON public.user_saved_organizations;
DROP POLICY IF EXISTS "Users can insert own saved organizations" ON public.user_saved_organizations;
DROP POLICY IF EXISTS "Users can delete own saved organizations" ON public.user_saved_organizations;
DROP POLICY IF EXISTS "Users can update own saved organizations" ON public.user_saved_organizations;

-- Create RLS policies
-- Users can read their own saved organizations
CREATE POLICY "Users can view own saved organizations"
  ON public.user_saved_organizations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own saved organizations
CREATE POLICY "Users can insert own saved organizations"
  ON public.user_saved_organizations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saved organizations (to unsave)
CREATE POLICY "Users can delete own saved organizations"
  ON public.user_saved_organizations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Users can update their own saved organizations (for notification tracking)
CREATE POLICY "Users can update own saved organizations"
  ON public.user_saved_organizations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Enable real-time for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_saved_organizations;

-- ============================================================================
-- Add 'is_on_platform' and 'application_required_bool' columns to organizations
-- if they don't exist. These help track platform status and join requirements.
-- ============================================================================

-- Check if columns exist and add them if not
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'is_on_platform'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN is_on_platform BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'application_required_bool'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN application_required_bool BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create index on is_on_platform for filtering
CREATE INDEX IF NOT EXISTS idx_organizations_on_platform ON public.organizations(is_on_platform);

-- ============================================================================
-- Sample queries for testing
-- ============================================================================

-- Get all saved orgs for a user
-- SELECT so.*, o.name, o.is_on_platform 
-- FROM user_saved_organizations so
-- JOIN organizations o ON so.organization_id = o.id
-- WHERE so.user_id = 'user-uuid-here';

-- Get saved orgs that are now on platform (for notification)
-- SELECT so.*, o.name 
-- FROM user_saved_organizations so
-- JOIN organizations o ON so.organization_id = o.id
-- WHERE so.user_id = 'user-uuid-here' 
-- AND o.is_on_platform = true 
-- AND so.notified_at IS NULL;


