-- Add responses JSON column to applications table
-- Run this in Supabase SQL Editor

-- Add the column
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS responses JSONB DEFAULT '{}';

-- Format: { "question_id": { "text": "response text", "options": ["option1"] }, ... }
-- Or simpler: { "question_id": "response_text_or_array" }
