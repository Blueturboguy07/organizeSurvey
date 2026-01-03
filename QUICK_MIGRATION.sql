-- Quick Migration: Add user_id to users table
-- Run this in Supabase SQL Editor

-- Add user_id column to link with auth.users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);

-- Done! Now queries will be associated with users via user_id

