-- ============================================
-- Recovery Script: Recreate user_profiles table
-- ============================================
-- Run this script in your Supabase SQL Editor
-- This will recreate the accidentally deleted user_profiles table
-- ============================================

-- Step 1: Create user_profiles table for profile information
CREATE TABLE IF NOT EXISTS public.user_profiles (
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

-- Step 2: Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- Step 4: Create RLS policies
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Step 5: Create function to automatically update updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Step 8: Enable Realtime for user_profiles table
-- This allows the app to subscribe to real-time changes (used in AuthContext.tsx)
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;

-- ============================================
-- Recovery Complete!
-- ============================================
-- The user_profiles table has been recreated with:
-- - All columns (id, email, name, profile_picture_url, email_preferences, timestamps)
-- - Row Level Security enabled
-- - RLS policies for SELECT, UPDATE, and INSERT
-- - Auto-update trigger for updated_at
-- - Email index for faster lookups
-- - Realtime enabled (for live updates in the app)
-- ============================================
-- Note: Existing user data will need to be recreated as profiles are created
-- when users register or update their profiles through the app.
-- ============================================

