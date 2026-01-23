-- ============================================
-- Add file_upload to question_type constraint
-- ============================================
-- Run this in your Supabase SQL Editor
-- This updates the check constraint to allow file_upload question type
-- ============================================

-- Drop the existing constraint
ALTER TABLE form_questions DROP CONSTRAINT IF EXISTS form_questions_question_type_check;

-- Add the updated constraint with file_upload included
ALTER TABLE form_questions ADD CONSTRAINT form_questions_question_type_check 
  CHECK (question_type IN ('short_text', 'long_text', 'multiple_choice', 'file_upload'));
