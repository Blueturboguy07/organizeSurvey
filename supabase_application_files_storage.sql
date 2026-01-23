-- ============================================
-- Create storage bucket for application files
-- ============================================
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create the storage bucket for application files
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-files', 'application-files', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload files to their own folder
CREATE POLICY "Users can upload application files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'application-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view their own uploaded files
CREATE POLICY "Users can view own application files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'application-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Org accounts can view files for applications to their org
CREATE POLICY "Org accounts can view applicant files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'application-files' AND
  EXISTS (
    SELECT 1 FROM applications a
    JOIN org_accounts oa ON oa.organization_id = a.organization_id
    WHERE (storage.foldername(name))[1] = a.user_id::text
    AND oa.user_id = auth.uid()
    AND oa.email_verified = true
    AND oa.is_active = true
  )
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own application files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'application-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
