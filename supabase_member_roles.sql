-- ============================================================================
-- Member Roles Schema for Supabase
-- Run this SQL to add roles and titles to organization members
-- ============================================================================

-- Add role and title columns to user_joined_organizations
ALTER TABLE public.user_joined_organizations 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('member', 'officer', 'admin')),
ADD COLUMN IF NOT EXISTS title TEXT;

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_user_joined_orgs_role ON public.user_joined_organizations(role);

-- Update RLS policies to allow org owners to update member roles
DROP POLICY IF EXISTS "Org owners can update members" ON public.user_joined_organizations;
CREATE POLICY "Org owners can update members"
  ON public.user_joined_organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_accounts 
      WHERE org_accounts.organization_id = user_joined_organizations.organization_id 
      AND org_accounts.user_id = auth.uid()
    )
  );

-- Allow officers and admins of an org to view members
DROP POLICY IF EXISTS "Officers can view org members" ON public.user_joined_organizations;
CREATE POLICY "Officers can view org members"
  ON public.user_joined_organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_joined_organizations ujo
      WHERE ujo.organization_id = user_joined_organizations.organization_id 
      AND ujo.user_id = auth.uid()
      AND ujo.role IN ('officer', 'admin')
    )
  );

-- ============================================================================
-- Org Dashboard Access for Officers
-- ============================================================================

-- Create a table to track org dashboard access (alternative to using org_accounts)
-- This allows officers to access the dashboard without being the main org account
CREATE TABLE IF NOT EXISTS public.org_dashboard_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  UNIQUE(user_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.org_dashboard_access ENABLE ROW LEVEL SECURITY;

-- Policies for org_dashboard_access
DROP POLICY IF EXISTS "Users can view own dashboard access" ON public.org_dashboard_access;
CREATE POLICY "Users can view own dashboard access"
  ON public.org_dashboard_access
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Org owners can manage dashboard access" ON public.org_dashboard_access;
CREATE POLICY "Org owners can manage dashboard access"
  ON public.org_dashboard_access
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_accounts 
      WHERE org_accounts.organization_id = org_dashboard_access.organization_id 
      AND org_accounts.user_id = auth.uid()
    )
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access on dashboard_access" ON public.org_dashboard_access;
CREATE POLICY "Service role full access on dashboard_access"
  ON public.org_dashboard_access
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Allow admin members to update organization info
-- ============================================================================

-- Allow admin members (with dashboard access) to update organizations
DROP POLICY IF EXISTS "Admin members can update organizations" ON public.organizations;
CREATE POLICY "Admin members can update organizations"
  ON public.organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_joined_organizations ujo
      WHERE ujo.organization_id = organizations.id 
      AND ujo.user_id = auth.uid()
      AND ujo.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM org_accounts 
      WHERE org_accounts.organization_id = organizations.id 
      AND org_accounts.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Note: After running this, officers with 'admin' role can be granted
-- dashboard access through the org_dashboard_access table
-- ============================================================================
