-- Create userQueries table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latest_cleansed_query TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure one query per user
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_queries_user_id ON user_queries(user_id);

-- Enable Row Level Security
ALTER TABLE user_queries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/update their own queries
CREATE POLICY "Users can view own queries" ON user_queries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own queries" ON user_queries
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queries" ON user_queries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

