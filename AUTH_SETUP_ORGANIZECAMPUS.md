# Authentication Setup Guide for organizecampus.com

This guide is customized for your domain: **organizecampus.com**

## ✅ What's Been Implemented

- ✅ Registration page (TAMU email only)
- ✅ Email verification system
- ✅ Login/logout functionality
- ✅ Password reset flow
- ✅ Session management
- ✅ Protected routes (middleware)
- ✅ API authentication

## 📋 Step-by-Step Setup

### Step 1: Create/Configure Supabase Project

1. **Go to Supabase Dashboard**
   - Navigate to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Create a new project OR select existing project

2. **Get Your Credentials**
   - Go to **Settings** → **API**
   - Copy these values (you'll need them):
     - **Project URL** (looks like: `https://xxxxx.supabase.co`)
     - **anon public** key (long string starting with `eyJ...`)
     - **service_role** key (keep this secret!)

### Step 2: Enable Email Authentication

1. **Go to Authentication → Providers**
   - Find **Email** provider
   - Click to enable it
   - Configure settings:
     - ✅ **Enable email confirmations**: ON
     - ✅ **Secure email change**: ON
     - ✅ **Double confirm email changes**: ON (optional)

2. **Configure Email Templates** (Optional)
   - Go to **Authentication** → **Email Templates**
   - Customize:
     - **Confirm signup** - Email verification
     - **Reset password** - Password reset
   - You can add your branding/logo

### Step 3: Set Redirect URLs for organizecampus.com

1. **Go to Authentication → URL Configuration**
   - **Site URL**: `https://organizecampus.com`
   - **Redirect URLs**: Add these EXACT URLs (one per line):
     ```
     https://organizecampus.com/auth/callback
     https://organizecampus.com/reset-password
     http://localhost:3000/auth/callback
     http://localhost:3000/reset-password
     ```
   - Click **Save**

### Step 4: Run Database Migration

1. **Go to SQL Editor** in Supabase Dashboard
2. **Click "New query"**
3. **Open the file**: `scripts/migrate-auth.sql`
4. **Copy the entire contents** and paste into SQL Editor
5. **Click "Run"** (or press Cmd/Ctrl + Enter)
6. **Verify success**: Should see "Success. No rows returned"

This migration will:
- Link `users` table with Supabase Auth
- Auto-create user profiles on signup
- Set up proper security policies

### Step 5: Set Environment Variables

#### For Local Development (.env.local)

Create or update `.env.local` in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace with your actual values from Step 1.

#### For Production (Vercel/Render)

1. **Go to your hosting platform** (Vercel/Render/etc.)
2. **Find Environment Variables** section
3. **Add these variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` = your service_role key (optional, for admin operations)
4. **Make sure to add for Production environment**
5. **Redeploy** your application

### Step 6: Test Authentication

#### Local Testing:
```bash
npm run dev
```

1. Visit `http://localhost:3000`
2. Should redirect to `/login`
3. Click "Sign up" to register
4. Use a TAMU email (e.g., `test@tamu.edu`)
5. Check email for verification link
6. Click verification link
7. Login and test survey

#### Production Testing:
1. Visit `https://organizecampus.com`
2. Should redirect to `/login`
3. Test registration → verification → login flow
4. Test password reset flow
5. Verify protected routes work

## 🔒 Security Checklist

Before going live:

- [ ] Email confirmations are required
- [ ] Redirect URLs are set correctly
- [ ] Environment variables are set in production
- [ ] Database migration has been run
- [ ] RLS policies are configured (see migration script)
- [ ] Test password reset flow works
- [ ] Test email verification works

## 🐛 Troubleshooting

### "Invalid redirect URL"
- Check that `https://organizecampus.com/auth/callback` is in Supabase redirect URLs
- Make sure Site URL is set to `https://organizecampus.com`

### "Email not sending"
- Check Supabase Dashboard → Authentication → Logs
- Verify email provider is enabled
- Check email templates are configured

### "Unauthorized" errors
- Verify environment variables are set correctly
- Check that database migration was run
- Verify user is logged in (check browser console)

### Database errors
- Make sure migration script ran successfully
- Check Supabase Dashboard → Database → Tables → `users` table exists
- Verify `user_id` column was added

## 📝 Quick Reference

**Your Domain**: `organizecampus.com`

**Required Redirect URLs**:
- `https://organizecampus.com/auth/callback`
- `https://organizecampus.com/reset-password`

**Environment Variables Needed**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (optional)

**Migration File**: `scripts/migrate-auth.sql`

## 🎯 Next Steps After Setup

1. ✅ Test all authentication flows
2. ✅ Customize email templates with your branding
3. ✅ Monitor authentication logs in Supabase
4. ✅ Set up error tracking (if needed)
5. ✅ Consider adding social login later (Google, etc.)

## 📞 Need Help?

If you encounter issues:
1. Check Supabase Dashboard → Logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Ensure migration script ran successfully
5. Double-check redirect URLs match exactly

