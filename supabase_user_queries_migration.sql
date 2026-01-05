-- ============================================
-- Migration: Create user_queries table
-- ============================================
-- This table stores user search queries and demographics
-- Run this in your Supabase SQL Editor
-- ============================================

-- Step 1: Create user_queries table
CREATE TABLE IF NOT EXISTS public.user_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latest_cleansed_query TEXT NOT NULL,
  user_demographics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- Step 2: Enable Row Level Security
ALTER TABLE public.user_queries ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Users can view own queries" ON public.user_queries;
DROP POLICY IF EXISTS "Users can update own queries" ON public.user_queries;
DROP POLICY IF EXISTS "Users can insert own queries" ON public.user_queries;

-- Step 4: Create RLS policies
-- Users can read their own queries
CREATE POLICY "Users can view own queries"
  ON public.user_queries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own queries
CREATE POLICY "Users can update own queries"
  ON public.user_queries
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own queries
CREATE POLICY "Users can insert own queries"
  ON public.user_queries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 5: Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_queries_updated_at ON public.user_queries;
CREATE TRIGGER update_user_queries_updated_at
  BEFORE UPDATE ON public.user_queries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_queries_user_id ON public.user_queries(user_id);

