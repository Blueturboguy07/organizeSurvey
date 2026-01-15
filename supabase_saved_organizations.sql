-- ============================================================================
-- Saved Organizations Table Schema for Supabase
-- Run this SQL in Supabase SQL Editor to create the saved_organizations table
-- This table tracks organizations that users have saved (for orgs not yet on platform)
-- ============================================================================

-- Create saved_organizations table
CREATE TABLE IF NOT EXISTS public.saved_organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Organization can be saved by name (if not on platform) or by ID (if on platform)
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL, -- Name of the organization (required for all saves)
  
  -- Track if this was saved when org was not on platform
  saved_when_not_on_platform BOOLEAN DEFAULT false,
  
  -- Track if user should be notified when org joins platform
  notify_when_available BOOLEAN DEFAULT true,
  
  -- Track if user was auto-joined (if org set as non-application based)
  auto_joined BOOLEAN DEFAULT false,
  
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Ensure a user can only save an organization once (by name or ID)
  UNIQUE(user_id, organization_id),
  UNIQUE(user_id, organization_name)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_orgs_user_id ON public.saved_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_orgs_org_id ON public.saved_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_orgs_org_name ON public.saved_organizations(organization_name);
CREATE INDEX IF NOT EXISTS idx_saved_orgs_notify ON public.saved_organizations(notify_when_available) WHERE notify_when_available = true;

-- Enable Row Level Security
ALTER TABLE public.saved_organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Users can view own saved organizations" ON public.saved_organizations;
DROP POLICY IF EXISTS "Users can insert own saved organizations" ON public.saved_organizations;
DROP POLICY IF EXISTS "Users can update own saved organizations" ON public.saved_organizations;
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

-- Users can update their own saved organizations
CREATE POLICY "Users can update own saved organizations"
  ON public.saved_organizations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own saved organizations (to unsave)
CREATE POLICY "Users can delete own saved organizations"
  ON public.saved_organizations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable real-time for this table
-- Real-time subscriptions allow clients to listen for INSERT, UPDATE, DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_organizations;

-- ============================================================================
-- Function to auto-join users when an organization is added to platform
-- This function should be called via a database trigger when an organization
-- is created and matches a saved organization name
-- ============================================================================

-- Function to check and auto-join saved organizations when org is added
CREATE OR REPLACE FUNCTION check_and_auto_join_saved_orgs()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new organization is created, check if any users have saved it
  -- If the org is set as non-application based, auto-join those users
  INSERT INTO public.user_joined_organizations (user_id, organization_id)
  SELECT DISTINCT so.user_id, NEW.id
  FROM public.saved_organizations so
  WHERE so.organization_name ILIKE NEW.name
    AND so.saved_when_not_on_platform = true
    AND so.notify_when_available = true
    AND (NEW.application_required IS NULL OR LOWER(NEW.application_required) IN ('no', 'none', 'n/a', ''))
    AND NOT EXISTS (
      SELECT 1 FROM public.user_joined_organizations ujo
      WHERE ujo.user_id = so.user_id AND ujo.organization_id = NEW.id
    )
  ON CONFLICT DO NOTHING;
  
  -- Update saved_organizations to link to the new organization
  UPDATE public.saved_organizations
  SET organization_id = NEW.id,
      auto_joined = CASE 
        WHEN (NEW.application_required IS NULL OR LOWER(NEW.application_required) IN ('no', 'none', 'n/a', ''))
        THEN true
        ELSE false
      END,
      saved_when_not_on_platform = false
  WHERE organization_name ILIKE NEW.name
    AND organization_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-join when organization is created
DROP TRIGGER IF EXISTS trigger_auto_join_saved_orgs ON public.organizations;
CREATE TRIGGER trigger_auto_join_saved_orgs
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION check_and_auto_join_saved_orgs();

-- ============================================================================
-- Note: Email notifications for when saved orgs join the platform should be
-- handled by a separate service (e.g., Edge Function or external service)
-- that queries for saved_organizations where notify_when_available = true
-- and organization_id was just set (indicating org joined platform)
-- ============================================================================

