-- Google Calendar integration tokens
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date BIGINT,
  calendar_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role should access this table (tokens are sensitive)
CREATE POLICY "service_role_only" ON google_calendar_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- Users can check if they have a connected calendar (select own row only)
CREATE POLICY "users_can_read_own_token" ON google_calendar_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Add google event ID mapping to org_events
ALTER TABLE org_events ADD COLUMN IF NOT EXISTS google_event_id_map JSONB DEFAULT '{}';
