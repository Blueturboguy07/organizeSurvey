# Backend Setup Guide

This guide will help you set up the Supabase backend for the user profile features.

## Prerequisites

- A Supabase project (https://supabase.com)
- Access to your Supabase project dashboard

## Step 1: Create the Users Table

1. Go to your Supabase Dashboard → SQL Editor
2. Run the following SQL script to create the `users` table:

```sql
-- Create user_profiles table for profile information
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  profile_picture_url TEXT,
  email_preferences JSONB DEFAULT '{
    "marketing": true,
    "updates": true,
    "recommendations": true
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Create policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Create policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
```

## Step 2: Create Storage Bucket for Profile Pictures

1. Go to your Supabase Dashboard → Storage
2. Click "New bucket"
3. Configure the bucket:
   - **Name**: `profile-pictures`
   - **Public bucket**: ✅ Check this (enables public access to images)
   - **File size limit**: 5 MB (or your preferred limit)
   - **Allowed MIME types**: `image/jpeg,image/jpg,image/png,image/webp`

4. After creating the bucket, set up storage policies:

Go to Storage → `profile-pictures` → Policies, and add these policies:

**Policy 1: Allow authenticated users to upload**
```sql
CREATE POLICY "Authenticated users can upload profile pictures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  (storage.foldername(name))[1] = auth.uid()::text OR
  name LIKE (auth.uid()::text || '-%')
);
```

**Policy 2: Allow authenticated users to update their own pictures**
```sql
CREATE POLICY "Users can update own profile pictures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  (name LIKE (auth.uid()::text || '-%'))
);
```

**Policy 3: Allow authenticated users to delete their own pictures**
```sql
CREATE POLICY "Users can delete own profile pictures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  (name LIKE (auth.uid()::text || '-%'))
);
```

**Policy 4: Allow public read access**
```sql
CREATE POLICY "Public can view profile pictures"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');
```

## Step 3: Verify Environment Variables

Make sure your `.env.local` file (or your deployment environment) has these variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Important**: 
- The `SUPABASE_SERVICE_ROLE_KEY` is needed for admin operations (bypassing RLS)
- Never expose the service role key in client-side code
- Keep it secure and only use it in server-side API routes

## Step 4: Test the Setup

1. **Test Database Table**:
   - Try registering a new user or updating an existing profile
   - Check the `user_profiles` table in Supabase Dashboard → Table Editor
   - Verify that the profile data is being saved correctly

2. **Test Storage**:
   - Try uploading a profile picture through the profile page
   - Check Storage → `profile-pictures` bucket to see if files are uploaded
   - Verify that the image URL is accessible publicly

3. **Test Email Preferences**:
   - Update email preferences in the profile page
   - Check the `email_preferences` column in the `users` table
   - Verify the JSON structure matches the expected format

## Troubleshooting

### Issue: "Failed to upload image" error
- **Solution**: Make sure the storage bucket exists and policies are set correctly
- Check that the bucket is public if you want public URLs
- Verify file size and MIME type restrictions

### Issue: "Failed to update profile" error
- **Solution**: Check that the `users` table exists and RLS policies are correct
- Verify that the user is authenticated (check auth token)
- Check Supabase logs for detailed error messages

### Issue: Profile picture not displaying
- **Solution**: Ensure the storage bucket is public
- Check that the `profile_picture_url` is correctly saved in the database
- Verify the URL format matches Supabase Storage URL pattern

### Issue: RLS Policy errors
- **Solution**: Make sure you're using the service role key for admin operations
- Verify that RLS policies allow the operations you're trying to perform
- Check that `auth.uid()` matches the user ID in your queries

## Additional Notes

- The `user_profiles` table uses `id` as a foreign key to `auth.users(id)`, so it automatically links to Supabase Auth
- The `email_preferences` column uses JSONB for flexible preference storage
- The `updated_at` timestamp is automatically updated via a database trigger
- Profile pictures are stored with a naming pattern: `{user_id}-{timestamp}.{ext}`

## Security Considerations

1. **RLS Policies**: Always use Row Level Security to protect user data
2. **Storage Policies**: Restrict uploads to authenticated users only
3. **File Validation**: The API validates file types and sizes before upload
4. **Service Role Key**: Only use the service role key in server-side code

## Next Steps

After completing this setup:
1. Test user registration to ensure profiles are created
2. Test profile picture uploads
3. Test email preferences updates
4. Monitor Supabase logs for any errors

