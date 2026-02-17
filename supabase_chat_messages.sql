-- Chat messages table - scoped by organization and channel
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'general',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  reactions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_org_channel ON chat_messages(organization_id, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is a member OR the org account owner
-- Members of the org can read messages
CREATE POLICY "members_and_org_can_read_messages" ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_joined_organizations
      WHERE user_joined_organizations.user_id = auth.uid()
      AND user_joined_organizations.organization_id = chat_messages.organization_id
    )
    OR EXISTS (
      SELECT 1 FROM org_accounts
      WHERE org_accounts.user_id = auth.uid()
      AND org_accounts.organization_id = chat_messages.organization_id
    )
  );

-- Members and org account can insert messages
CREATE POLICY "members_and_org_can_insert_messages" ON chat_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM user_joined_organizations
        WHERE user_joined_organizations.user_id = auth.uid()
        AND user_joined_organizations.organization_id = chat_messages.organization_id
      )
      OR EXISTS (
        SELECT 1 FROM org_accounts
        WHERE org_accounts.user_id = auth.uid()
        AND org_accounts.organization_id = chat_messages.organization_id
      )
    )
  );

-- Members and org account can update reactions
CREATE POLICY "members_and_org_can_update_reactions" ON chat_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_joined_organizations
      WHERE user_joined_organizations.user_id = auth.uid()
      AND user_joined_organizations.organization_id = chat_messages.organization_id
    )
    OR EXISTS (
      SELECT 1 FROM org_accounts
      WHERE org_accounts.user_id = auth.uid()
      AND org_accounts.organization_id = chat_messages.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_joined_organizations
      WHERE user_joined_organizations.user_id = auth.uid()
      AND user_joined_organizations.organization_id = chat_messages.organization_id
    )
    OR EXISTS (
      SELECT 1 FROM org_accounts
      WHERE org_accounts.user_id = auth.uid()
      AND org_accounts.organization_id = chat_messages.organization_id
    )
  );

-- Users can delete own messages, OR org accounts/officers can delete any message in their org
CREATE POLICY "delete_own_or_admin_delete" ON chat_messages
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM org_accounts
      WHERE org_accounts.user_id = auth.uid()
      AND org_accounts.organization_id = chat_messages.organization_id
    )
    OR EXISTS (
      SELECT 1 FROM user_joined_organizations
      WHERE user_joined_organizations.user_id = auth.uid()
      AND user_joined_organizations.organization_id = chat_messages.organization_id
      AND user_joined_organizations.role IN ('admin', 'officer')
    )
  );

-- Enable REPLICA IDENTITY FULL so DELETE events include the old row data for realtime
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
