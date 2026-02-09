-- Announcements table for org-to-member communications
CREATE TABLE IF NOT EXISTS org_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by org
CREATE INDEX IF NOT EXISTS idx_announcements_org ON org_announcements(organization_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON org_announcements(created_at DESC);

-- Enable RLS
ALTER TABLE org_announcements ENABLE ROW LEVEL SECURITY;

-- Org accounts can insert announcements for their org
CREATE POLICY "org_accounts_can_insert_announcements" ON org_announcements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_accounts
      WHERE org_accounts.user_id = auth.uid()
      AND org_accounts.organization_id = org_announcements.organization_id
    )
  );

-- Members of the org can read announcements
CREATE POLICY "members_can_read_announcements" ON org_announcements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_joined_organizations
      WHERE user_joined_organizations.user_id = auth.uid()
      AND user_joined_organizations.organization_id = org_announcements.organization_id
    )
    OR
    EXISTS (
      SELECT 1 FROM org_accounts
      WHERE org_accounts.user_id = auth.uid()
      AND org_accounts.organization_id = org_announcements.organization_id
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE org_announcements;
