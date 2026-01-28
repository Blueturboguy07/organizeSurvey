-- Add application settings columns to org_accounts table
-- Run this in Supabase SQL Editor

-- Add columns for application deadline and status
ALTER TABLE org_accounts 
ADD COLUMN IF NOT EXISTS accepting_applications BOOLEAN DEFAULT true;

ALTER TABLE org_accounts 
ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMP WITH TIME ZONE;

ALTER TABLE org_accounts 
ADD COLUMN IF NOT EXISTS applications_reopen_date TIMESTAMP WITH TIME ZONE;

-- Add a comment explaining the columns
COMMENT ON COLUMN org_accounts.accepting_applications IS 'Whether the organization is currently accepting applications';
COMMENT ON COLUMN org_accounts.application_deadline IS 'The deadline for submitting applications (when accepting)';
COMMENT ON COLUMN org_accounts.applications_reopen_date IS 'The date when applications will reopen (when not accepting)';
