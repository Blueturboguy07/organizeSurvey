-- Custom channels per org
CREATE TABLE IF NOT EXISTS org_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '#',
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_channels_org ON org_channels(organization_id);

ALTER TABLE org_channels ENABLE ROW LEVEL SECURITY;

-- Members and org accounts can read channels
CREATE POLICY "members_and_org_can_read_channels" ON org_channels
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_joined_organizations WHERE user_joined_organizations.user_id = auth.uid() AND user_joined_organizations.organization_id = org_channels.organization_id)
    OR EXISTS (SELECT 1 FROM org_accounts WHERE org_accounts.user_id = auth.uid() AND org_accounts.organization_id = org_channels.organization_id)
  );

-- Only admins/officers and org accounts can create channels
CREATE POLICY "admins_can_insert_channels" ON org_channels
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND (
      EXISTS (SELECT 1 FROM org_accounts WHERE org_accounts.user_id = auth.uid() AND org_accounts.organization_id = org_channels.organization_id)
      OR EXISTS (SELECT 1 FROM user_joined_organizations WHERE user_joined_organizations.user_id = auth.uid() AND user_joined_organizations.organization_id = org_channels.organization_id AND user_joined_organizations.role IN ('admin', 'officer'))
    )
  );

-- Only admins/officers and org accounts can delete channels
CREATE POLICY "admins_can_delete_channels" ON org_channels
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM org_accounts WHERE org_accounts.user_id = auth.uid() AND org_accounts.organization_id = org_channels.organization_id)
    OR EXISTS (SELECT 1 FROM user_joined_organizations WHERE user_joined_organizations.user_id = auth.uid() AND user_joined_organizations.organization_id = org_channels.organization_id AND user_joined_organizations.role IN ('admin', 'officer'))
  );

ALTER TABLE org_channels REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE org_channels;
