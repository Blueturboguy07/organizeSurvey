-- Fix Supabase Schema Cache Issue
-- Run this in Supabase SQL Editor

-- Step 1: Refresh the schema cache
NOTIFY pgrst, 'reload schema';

-- Step 2: If that doesn't work, ensure RLS policies are correct
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations" ON users;

-- Create a permissive policy for development
CREATE POLICY "Allow all operations" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 3: Refresh schema cache again
NOTIFY pgrst, 'reload schema';

-- Step 4: Verify table exists and is accessible
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

