-- ============================================================================
-- User Joined Organizations Table Schema for Supabase
-- Run this SQL in Supabase SQL Editor to create the user_joined_organizations table
-- This table tracks which organizations a student has joined
-- ============================================================================

-- Create user_joined_organizations table
CREATE TABLE IF NOT EXISTS public.user_joined_organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Ensure a user can only join an organization once
  UNIQUE(user_id, organization_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_joined_orgs_user_id ON public.user_joined_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_joined_orgs_org_id ON public.user_joined_organizations(organization_id);

-- Enable Row Level Security
ALTER TABLE public.user_joined_organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Users can view own joined organizations" ON public.user_joined_organizations;
DROP POLICY IF EXISTS "Users can insert own joined organizations" ON public.user_joined_organizations;
DROP POLICY IF EXISTS "Users can delete own joined organizations" ON public.user_joined_organizations;

-- Create RLS policies
-- Users can read their own joined organizations
CREATE POLICY "Users can view own joined organizations"
  ON public.user_joined_organizations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own joined organizations
CREATE POLICY "Users can insert own joined organizations"
  ON public.user_joined_organizations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own joined organizations (to leave an org)
CREATE POLICY "Users can delete own joined organizations"
  ON public.user_joined_organizations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Org account owners can insert members when accepting applications
DROP POLICY IF EXISTS "Org owners can add members" ON public.user_joined_organizations;
CREATE POLICY "Org owners can add members"
  ON public.user_joined_organizations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_accounts 
      WHERE org_accounts.organization_id = user_joined_organizations.organization_id 
      AND org_accounts.user_id = auth.uid()
    )
  );

-- Enable real-time for this table
-- Real-time subscriptions allow clients to listen for INSERT, UPDATE, DELETE events
-- This is required for the dashboard to update recommendations in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_joined_organizations;

-- ============================================================================
-- Note: The user_queries table should already exist from previous setup
-- If it doesn't exist, you may need to create it separately
-- 
-- Real-time is now enabled for user_joined_organizations table.
-- Changes to this table will automatically trigger updates in the frontend
-- through Supabase Realtime subscriptions.
-- ============================================================================

