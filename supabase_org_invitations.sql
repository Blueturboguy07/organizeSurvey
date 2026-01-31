-- ============================================================================
-- Organization Invitations Table Schema for Supabase
-- Run this SQL in Supabase SQL Editor to create org_invitations table
-- This table tracks member invitations sent by organizations
-- ============================================================================

-- Drop existing policies first (before table operations)
DROP POLICY IF EXISTS "Org owners can view their invitations" ON public.org_invitations;
DROP POLICY IF EXISTS "Org owners can insert invitations" ON public.org_invitations;
DROP POLICY IF EXISTS "Org owners can update their invitations" ON public.org_invitations;
DROP POLICY IF EXISTS "Public can read invitations by token" ON public.org_invitations;
DROP POLICY IF EXISTS "Service role full access on invitations" ON public.org_invitations;
DROP POLICY IF EXISTS "Users can read invitations sent to them" ON public.org_invitations;

-- Create org_invitations table
CREATE TABLE IF NOT EXISTS public.org_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Organization sending the invite
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Email of the invited person
  email TEXT NOT NULL,
  
  -- Name of the invited person (optional, for display purposes)
  name TEXT,
  
  -- Unique invite token for verification
  invite_token TEXT UNIQUE NOT NULL,
  
  -- Status: pending, accepted, expired, cancelled
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  
  -- User ID if the invite was accepted (links to the user who accepted)
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days') NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  -- Prevent duplicate pending invites to same email for same org
  UNIQUE(organization_id, email, status) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON public.org_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.org_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.org_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON public.org_invitations(status);

-- Enable Row Level Security
ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Org owners can view their organization's invitations
CREATE POLICY "Org owners can view their invitations"
  ON public.org_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_accounts 
      WHERE org_accounts.organization_id = org_invitations.organization_id 
      AND org_accounts.user_id = auth.uid()
    )
  );

-- Org owners can insert invitations for their organization
CREATE POLICY "Org owners can insert invitations"
  ON public.org_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_accounts 
      WHERE org_accounts.organization_id = org_invitations.organization_id 
      AND org_accounts.user_id = auth.uid()
    )
  );

-- Org owners can update (cancel) their invitations
CREATE POLICY "Org owners can update their invitations"
  ON public.org_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_accounts 
      WHERE org_accounts.organization_id = org_invitations.organization_id 
      AND org_accounts.user_id = auth.uid()
    )
  );

-- Service role has full access (for invite acceptance during registration)
CREATE POLICY "Service role full access on invitations"
  ON public.org_invitations
  FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read invitations sent to their email
CREATE POLICY "Users can read invitations sent to them"
  ON public.org_invitations
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Enable real-time for this table (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.org_invitations;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;

-- ============================================================================
-- Function to auto-expire old invitations
-- ============================================================================
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE org_invitations 
  SET status = 'expired' 
  WHERE status = 'pending' 
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Note: You can run this function periodically via a cron job or 
-- call it before querying invitations to ensure expired ones are marked.
-- ============================================================================
