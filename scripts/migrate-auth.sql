-- Authentication Migration Script
-- Run this in Supabase SQL Editor after setting up authentication
-- This links the users table with Supabase Auth

-- Add user_id column to link with auth.users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);

-- Create a function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (email, name, user_id, first_seen, last_updated)
  VALUES (
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.id,
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE
  SET user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call function on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies to allow users to read/update their own data
DROP POLICY IF EXISTS "Users can view own data" ON users;
CREATE POLICY "Users can view own data" ON users
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Optional: Keep permissive policy for admin operations (remove for production)
-- Uncomment below if you want to keep admin access during development
-- DROP POLICY IF EXISTS "Allow all operations" ON users;
-- CREATE POLICY "Allow all operations" ON users
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

