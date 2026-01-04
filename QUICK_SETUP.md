# Quick Setup Guide - What You Need to Do

Based on your existing `user_queries` table, here's exactly what you need to do:

## ✅ Step 1: Create the `users` Table

1. Go to your **Supabase Dashboard** → **SQL Editor**
2. Copy and paste this SQL (from lines 7-66 of `supabase_setup.sql`):

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

-- Create RLS policies
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

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

-- Create index on email
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
```

3. Click **Run** (or press Cmd/Ctrl + Enter)

## ✅ Step 2: Create Storage Bucket for Profile Pictures

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"** button
3. Fill in:
   - **Name**: `profile-pictures`
   - **Public bucket**: ✅ **Check this box** (important!)
   - **File size limit**: `5242880` (5MB in bytes)
   - **Allowed MIME types**: `image/jpeg,image/jpg,image/png,image/webp`
4. Click **"Create bucket"**

## ✅ Step 3: Add Storage Policies

1. Still in **Storage**, click on the **`profile-pictures`** bucket
2. Click the **"Policies"** tab
3. Click **"New Policy"** and add these 4 policies one by one:

### Policy 1: Upload
- **Policy name**: `Authenticated users can upload profile pictures`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
(bucket_id = 'profile-pictures' AND name LIKE (auth.uid()::text || '-%'))
```

### Policy 2: Update
- **Policy name**: `Users can update own profile pictures`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
(bucket_id = 'profile-pictures' AND name LIKE (auth.uid()::text || '-%'))
```

### Policy 3: Delete
- **Policy name**: `Users can delete own profile pictures`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
(bucket_id = 'profile-pictures' AND name LIKE (auth.uid()::text || '-%'))
```

### Policy 4: Public Read
- **Policy name**: `Public can view profile pictures`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **Policy definition**:
```sql
(bucket_id = 'profile-pictures')
```

## ✅ Step 4: Verify Environment Variables

Make sure you have these in your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

You can find these in: **Supabase Dashboard** → **Settings** → **API**

## ✅ Step 5: Test It!

1. Start your Next.js app: `npm run dev`
2. Register a new user or log in
3. Go to `/profile` page
4. Try uploading a profile picture
5. Try updating your name and email preferences

## 🎉 That's It!

Your backend is now set up. The `user_profiles` table will store profile data, and the `profile-pictures` bucket will store uploaded images.

## Troubleshooting

**If profile picture upload fails:**
- Make sure the bucket is **public**
- Check that all 4 storage policies are created
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in your environment

**If profile updates fail:**
- Check that the `user_profiles` table was created successfully
- Verify RLS policies are in place
- Check browser console for specific error messages

