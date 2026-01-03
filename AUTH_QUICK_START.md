# Authentication Quick Start Guide

## ✅ What's Done

All authentication features have been implemented:
- ✅ Registration page (`/register`) - TAMU email validation
- ✅ Login page (`/login`)
- ✅ Logout functionality (button in survey header)
- ✅ Password reset flow (`/forgot-password` → `/reset-password`)
- ✅ Email verification system
- ✅ Session management (automatic)
- ✅ Protected routes (middleware)

## 🚀 Quick Setup (5 Steps)

### 1. Enable Email Auth in Supabase
- Dashboard → **Authentication** → **Providers**
- Enable **Email** provider
- Enable **Email confirmations**

### 2. Set Redirect URLs
- Dashboard → **Authentication** → **URL Configuration**
- **Site URL**: `https://organizecampus.com`
- **Redirect URLs**: Add:
  - `https://organizecampus.com/auth/callback`
  - `https://organizecampus.com/reset-password`
  - `http://localhost:3000/auth/callback` (for local dev)
  - `http://localhost:3000/reset-password` (for local dev)

### 3. Run Database Migration
- Dashboard → **SQL Editor**
- Open file: `scripts/migrate-auth.sql`
- Copy entire contents and paste into SQL Editor
- Click **Run**
- This links `users` table with `auth.users`

### 4. Verify Environment Variables
Check `.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 5. Test It!
```bash
npm run dev
```
- Visit `http://localhost:3000`
- Should redirect to `/login`
- Register with a TAMU email
- Check email for verification
- Login and access `/survey`

## 📍 Routes

- `/` - Home (redirects based on auth status)
- `/register` - Registration page
- `/login` - Login page
- `/forgot-password` - Request password reset
- `/reset-password` - Reset password form
- `/survey` - Protected survey page (requires login)
- `/auth/callback` - OAuth callback handler
- `/auth/verify` - Email verification page

## 🔐 How It Works

1. **Registration**: User signs up → Email verification sent → User verifies → Can login
2. **Login**: User signs in → Session created → Redirected to `/survey`
3. **Protected Routes**: Middleware checks auth → Redirects to `/login` if not authenticated
4. **API Calls**: Survey submission includes auth token → API verifies token → Processes request

## ⚠️ Important Notes

- **TAMU Email Only**: Registration only accepts `@tamu.edu` or `@email.tamu.edu`
- **Email Verification Required**: Users must verify email before accessing survey
- **Session Persistence**: Sessions persist across page refreshes
- **Auto-logout**: Users logged out after token expiration (1 hour default)

## 📖 Full Documentation

- **Quick Checklist**: See `AUTH_CHECKLIST.md` for a step-by-step checklist
- **Detailed Guide**: See `AUTH_SETUP_ORGANIZECAMPUS.md` for complete instructions with your domain
- **Migration SQL**: See `scripts/migrate-auth.sql` for the database migration script

