-- ============================================
-- Add reviewed column to applications table
-- ============================================
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add reviewed column (default false)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false;

-- Create index for filtering by reviewed status
CREATE INDEX IF NOT EXISTS idx_applications_reviewed ON applications(reviewed);
