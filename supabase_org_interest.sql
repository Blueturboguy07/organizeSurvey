-- ============================================================================
-- Organization Interest Tracking Schema
-- Tracks student interest in orgs not yet on the platform
-- ============================================================================

-- Create table to track interest in organizations
CREATE TABLE IF NOT EXISTS public.org_interest_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Tracking
  interest_count INTEGER DEFAULT 0,
  last_notified_at TIMESTAMP WITH TIME ZONE,
  last_milestone_notified INTEGER DEFAULT 0, -- 0, 10, 20, 30, etc.
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.org_interest_notifications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read interest counts (for display purposes)
DROP POLICY IF EXISTS "Anyone can read interest counts" ON public.org_interest_notifications;
CREATE POLICY "Anyone can read interest counts"
  ON public.org_interest_notifications
  FOR SELECT
  USING (true);

-- Only service role can update
DROP POLICY IF EXISTS "Service role full access on interest" ON public.org_interest_notifications;
CREATE POLICY "Service role full access on interest"
  ON public.org_interest_notifications
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create index
CREATE INDEX IF NOT EXISTS idx_org_interest_org_id ON public.org_interest_notifications(organization_id);

-- ============================================================================
-- Note: When a student saves an org not on platform, we:
-- 1. Increment interest_count
-- 2. Check if we've hit a milestone (10, 20, 30, etc.)
-- 3. If milestone hit and not already notified at that level, send email
-- ============================================================================
