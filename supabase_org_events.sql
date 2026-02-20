-- Org events table
CREATE TABLE IF NOT EXISTS org_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#500000',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_events_org ON org_events(organization_id, start_time);

ALTER TABLE org_events ENABLE ROW LEVEL SECURITY;

-- Members and org accounts can read events
CREATE POLICY "members_and_org_can_read_events" ON org_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_joined_organizations WHERE user_joined_organizations.user_id = auth.uid() AND user_joined_organizations.organization_id = org_events.organization_id)
    OR EXISTS (SELECT 1 FROM org_accounts WHERE org_accounts.user_id = auth.uid() AND org_accounts.organization_id = org_events.organization_id)
  );

-- Only org accounts and admin/officer members can create events
CREATE POLICY "admins_can_insert_events" ON org_events
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND (
      EXISTS (SELECT 1 FROM org_accounts WHERE org_accounts.user_id = auth.uid() AND org_accounts.organization_id = org_events.organization_id)
      OR EXISTS (SELECT 1 FROM user_joined_organizations WHERE user_joined_organizations.user_id = auth.uid() AND user_joined_organizations.organization_id = org_events.organization_id AND user_joined_organizations.role IN ('admin', 'officer'))
    )
  );

-- Only org accounts and admin/officer members can update events
CREATE POLICY "admins_can_update_events" ON org_events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM org_accounts WHERE org_accounts.user_id = auth.uid() AND org_accounts.organization_id = org_events.organization_id)
    OR EXISTS (SELECT 1 FROM user_joined_organizations WHERE user_joined_organizations.user_id = auth.uid() AND user_joined_organizations.organization_id = org_events.organization_id AND user_joined_organizations.role IN ('admin', 'officer'))
  );

-- Only org accounts and admin/officer members can delete events
CREATE POLICY "admins_can_delete_events" ON org_events
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM org_accounts WHERE org_accounts.user_id = auth.uid() AND org_accounts.organization_id = org_events.organization_id)
    OR EXISTS (SELECT 1 FROM user_joined_organizations WHERE user_joined_organizations.user_id = auth.uid() AND user_joined_organizations.organization_id = org_events.organization_id AND user_joined_organizations.role IN ('admin', 'officer'))
  );

ALTER TABLE org_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE org_events;
