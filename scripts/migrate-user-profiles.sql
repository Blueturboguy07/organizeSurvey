-- User Profiles Migration
-- Run this in Supabase SQL Editor to update users table for onboarding profiles

-- Add columns for full profile storage
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_data JSONB,
ADD COLUMN IF NOT EXISTS search_results JSONB,
ADD COLUMN IF NOT EXISTS last_search_query TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);

-- Update existing users to set onboarding_completed based on whether they have profile_data
UPDATE users 
SET onboarding_completed = (profile_data IS NOT NULL AND profile_data != '{}'::jsonb)
WHERE onboarding_completed IS NULL;

-- Add comment to table
COMMENT ON COLUMN users.profile_data IS 'Full onboarding profile including all survey responses';
COMMENT ON COLUMN users.search_results IS 'Last search results from organization matching';
COMMENT ON COLUMN users.last_search_query IS 'Last cleansed query used for search';
COMMENT ON COLUMN users.onboarding_completed IS 'Whether user has completed onboarding';

