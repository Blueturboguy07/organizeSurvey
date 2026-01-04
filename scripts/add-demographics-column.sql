-- Migration: Add user_demographics column to user_queries table
-- Run this in Supabase SQL Editor if you already have the user_queries table

-- Add the column if it doesn't exist
ALTER TABLE user_queries 
ADD COLUMN IF NOT EXISTS user_demographics JSONB;

-- Add a comment explaining the column
COMMENT ON COLUMN user_queries.user_demographics IS 'Stores user demographic data (classification, gender, race, etc.) for eligibility filtering when loading saved queries';

