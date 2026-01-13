-- ============================================
-- Cleanup and Recovery Script: user_profiles table
-- ============================================
-- Run this script in your Supabase SQL Editor
-- This will clean up any orphaned objects and recreate the table
-- ============================================

-- Step 1: Drop the table if it exists (CASCADE removes all triggers, policies, and dependencies)
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Note: CASCADE automatically removes:
-- - All triggers on the table
-- - All policies on the table  
-- - All indexes on the table
-- - The table from any publications (including realtime)
-- So we don't need to manually drop those objects

-- Step 6: Now create the table fresh
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  profile_picture_url TEXT,
  email_preferences JSONB DEFAULT '{
    "marketing": true,
    "updates": true,
    "recommendations": true
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Step 7: Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Step 9: Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create trigger to automatically update updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 11: Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Step 12: Enable Realtime for user_profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;

-- ============================================
-- Cleanup and Recovery Complete!
-- ============================================
-- The user_profiles table has been:
-- 1. Completely dropped (including all references)
-- 2. Recreated fresh with all columns
-- 3. RLS enabled with proper policies
-- 4. Triggers and functions recreated
-- 5. Indexes created
-- 6. Realtime enabled
-- ============================================
-- Note: All existing user profile data has been removed.
-- Profiles will be created automatically when users register
-- or update their profiles through the app.
-- ============================================

