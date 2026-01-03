# Authentication Setup Guide

This guide will walk you through setting up user authentication for ORGanize TAMU.

## ✅ What's Been Implemented

- ✅ Registration page (TAMU email only)
- ✅ Email verification system
- ✅ Login/logout functionality
- ✅ Password reset flow
- ✅ Session management
- ✅ Protected routes (middleware)
- ✅ API authentication

## 📋 What You Need to Do

### Step 1: Enable Supabase Authentication

1. **Go to your Supabase Dashboard**
   - Navigate to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project

2. **Enable Email Authentication**
   - Go to **Authentication** → **Providers** (left sidebar)
   - Find **Email** provider
   - Make sure it's **Enabled**
   - Configure email settings:
     - **Enable email confirmations**: ✅ ON (recommended)
     - **Secure email change**: ✅ ON
     - **Double confirm email changes**: ✅ ON (optional)

3. **Configure Email Templates** (Optional but Recommended)
   - Go to **Authentication** → **Email Templates**
   - Customize templates for:
     - **Confirm signup** - Email verification
     - **Reset password** - Password reset
   - You can customize the subject and body to match your branding

### Step 2: Update Site URL and Redirect URLs

1. **Go to Authentication → URL Configuration**
   - **Site URL**: Set to your production URL (e.g., `https://yourdomain.com`)
   - **Redirect URLs**: Add these URLs:
     ```
     http://localhost:3000/auth/callback
     http://localhost:3000/reset-password
     https://yourdomain.com/auth/callback
     https://yourdomain.com/reset-password
     ```

### Step 3: Update Database Schema (Link Users Table with Auth)

Run this SQL in your Supabase SQL Editor to link the `users` table with Supabase Auth:

```sql
-- Add user_id column to link with auth.users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);

-- Create a function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (email, name, user_id, first_seen, last_updated)
  VALUES (
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.id,
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE
  SET user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call function on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies to allow users to read/update their own data
DROP POLICY IF EXISTS "Users can view own data" ON users;
CREATE POLICY "Users can view own data" ON users
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Keep the permissive policy for admin operations (or remove for production)
-- DROP POLICY IF EXISTS "Allow all operations" ON users;
-- CREATE POLICY "Allow all operations" ON users
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);
```

### Step 4: Update Environment Variables

Make sure your `.env.local` file includes:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Optional, for admin operations
```

**For Vercel/Production:**
- Add these same variables in your Vercel project settings
- Make sure to add them for Production, Preview, and Development environments

### Step 5: Test the Authentication Flow

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Test Registration:**
   - Go to `http://localhost:3000/register`
   - Try registering with a TAMU email (e.g., `test@tamu.edu`)
   - Check your email for verification link
   - Click the verification link

3. **Test Login:**
   - Go to `http://localhost:3000/login`
   - Sign in with your registered credentials
   - You should be redirected to `/survey`

4. **Test Password Reset:**
   - Click "Forgot password?" on login page
   - Enter your email
   - Check email for reset link
   - Follow the link to reset password

5. **Test Protected Routes:**
   - Try accessing `/survey` without logging in - should redirect to `/login`
   - After logging in, `/survey` should be accessible

## 🔒 Security Considerations

### For Production:

1. **Update RLS Policies:**
   - Remove the permissive "Allow all operations" policy
   - Use the user-specific policies shown in Step 3

2. **Enable Email Confirmation:**
   - Make sure email confirmations are required
   - Users must verify email before accessing protected routes

3. **Rate Limiting:**
   - Already implemented in API routes
   - Consider adding rate limiting to auth endpoints if needed

4. **Password Requirements:**
   - Currently: Minimum 8 characters
   - Consider adding complexity requirements in Supabase Auth settings

## 📁 File Structure

```
app/
├── register/page.tsx          # Registration page
├── login/page.tsx             # Login page
├── forgot-password/page.tsx    # Password reset request
├── reset-password/page.tsx     # Password reset form
├── auth/
│   ├── callback/route.ts      # OAuth callback handler
│   └── verify/page.tsx         # Email verification page
├── survey/page.tsx            # Protected survey page
└── page.tsx                   # Home (redirects based on auth)

contexts/
└── AuthContext.tsx            # Auth context provider

middleware.ts                  # Route protection middleware
```

## 🐛 Troubleshooting

### Issue: "Email already registered"
- User may have signed up before
- Try logging in instead
- Or reset password if forgotten

### Issue: "Invalid verification link"
- Links expire after 1 hour
- Request a new verification email
- Check Supabase Auth → Users to resend verification

### Issue: "Unauthorized" when submitting survey
- Make sure user is logged in
- Check that session token is being sent
- Verify middleware is working correctly

### Issue: Email not sending
- Check Supabase Dashboard → Authentication → Email Templates
- Verify SMTP settings (if using custom SMTP)
- Check Supabase logs for email delivery errors

### Issue: Redirect loops
- Check middleware configuration
- Verify redirect URLs in Supabase settings
- Clear browser cookies and try again

## 📝 Additional Notes

- **TAMU Email Validation**: Only `@tamu.edu` and `@email.tamu.edu` emails are accepted
- **Session Persistence**: Sessions are stored in cookies and persist across page refreshes
- **Auto-logout**: Users are automatically logged out after token expiration (default: 1 hour)
- **Email Verification**: Required before users can access protected routes

## 🎯 Next Steps

After setup is complete:
1. Test all authentication flows
2. Customize email templates in Supabase
3. Update RLS policies for production
4. Consider adding social login (Google, etc.) if needed
5. Set up monitoring for authentication events

## 📞 Support

If you encounter issues:
1. Check Supabase Dashboard → Logs for errors
2. Check browser console for client-side errors
3. Verify all environment variables are set correctly
4. Ensure database migrations have been run

