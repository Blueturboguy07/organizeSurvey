-- ============================================
-- Allow org accounts to read applicant demographics
-- ============================================
-- Run this in your Supabase SQL Editor
-- This allows organizations to view demographic data
-- for users who have applied to their organization
-- ============================================

-- First, check if the policy already exists and drop it
DROP POLICY IF EXISTS "Org accounts can read applicant demographics" ON public.user_queries;

-- Create policy allowing org accounts to read user_demographics 
-- for users who have applied to their organization
CREATE POLICY "Org accounts can read applicant demographics"
ON public.user_queries
FOR SELECT
USING (
  -- User can always read their own data
  auth.uid() = user_id
  OR
  -- Org accounts can read demographics for their applicants
  EXISTS (
    SELECT 1 FROM applications a
    JOIN org_accounts oa ON oa.organization_id = a.organization_id
    WHERE a.user_id = user_queries.user_id
    AND oa.user_id = auth.uid()
    AND oa.email_verified = true
    AND oa.is_active = true
  )
);

-- Note: This policy ensures:
-- 1. Users can still read their own query data
-- 2. Verified org accounts can read demographics ONLY for users who have applied to their org
-- 3. This protects user privacy - orgs can only see info for their own applicants
