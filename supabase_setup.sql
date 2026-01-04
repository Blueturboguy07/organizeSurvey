-- ============================================
-- Supabase Backend Setup Script
-- ============================================
-- Run this script in your Supabase SQL Editor
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

-- Step 5: Create function to automatically update updated_at timestamp
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

-- ============================================
-- Storage Policies (Run these separately in Storage → Policies)
-- ============================================
-- Note: These need to be created through the Supabase Dashboard
-- Go to Storage → profile-pictures → Policies
-- ============================================

-- Policy 1: Allow authenticated users to upload profile pictures
-- CREATE POLICY "Authenticated users can upload profile pictures"
-- ON storage.objects
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'profile-pictures' AND
--   (storage.foldername(name))[1] = auth.uid()::text OR
--   name LIKE (auth.uid()::text || '-%')
-- );

-- Policy 2: Allow authenticated users to update their own pictures
-- CREATE POLICY "Users can update own profile pictures"
-- ON storage.objects
-- FOR UPDATE
-- TO authenticated
-- USING (
--   bucket_id = 'profile-pictures' AND
--   (name LIKE (auth.uid()::text || '-%'))
-- );

-- Policy 3: Allow authenticated users to delete their own pictures
-- CREATE POLICY "Users can delete own profile pictures"
-- ON storage.objects
-- FOR DELETE
-- TO authenticated
-- USING (
--   bucket_id = 'profile-pictures' AND
--   (name LIKE (auth.uid()::text || '-%'))
-- );

-- Policy 4: Allow public read access
-- CREATE POLICY "Public can view profile pictures"
-- ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'profile-pictures');

