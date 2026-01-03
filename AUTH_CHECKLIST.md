# Authentication Setup Checklist for organizecampus.com

## ✅ Pre-Setup (Do This First)

- [ ] **Create Supabase Project** (if you don't have one)
  - Go to [supabase.com/dashboard](https://supabase.com/dashboard)
  - Click "New Project"
  - Save your database password somewhere safe

- [ ] **Get Your Supabase Credentials**
  - Settings → API
  - Copy: Project URL, anon key, service_role key
  - You'll need these for environment variables

## 🔧 Setup Steps

### 1. Enable Email Auth
- [ ] Go to **Authentication → Providers**
- [ ] Enable **Email** provider
- [ ] Turn ON "Enable email confirmations"

### 2. Set Your Domain URLs
- [ ] Go to **Authentication → URL Configuration**
- [ ] Set **Site URL**: `https://organizecampus.com`
- [ ] Add these **Redirect URLs**:
  ```
  https://organizecampus.com/auth/callback
  https://organizecampus.com/reset-password
  http://localhost:3000/auth/callback
  http://localhost:3000/reset-password
  ```
- [ ] Click **Save**

### 3. Run Database Migration
- [ ] Go to **SQL Editor** in Supabase
- [ ] Open file: `scripts/migrate-auth.sql`
- [ ] Copy entire file contents
- [ ] Paste into SQL Editor
- [ ] Click **Run**
- [ ] Should see "Success" message

### 4. Set Environment Variables

**Local (.env.local file):**
- [ ] Create `.env.local` in project root
- [ ] Add:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  ```
- [ ] Replace with YOUR actual values

**Production (Vercel/Render/etc.):**
- [ ] Go to hosting platform settings
- [ ] Find Environment Variables
- [ ] Add all 3 variables above
- [ ] Make sure they're set for Production
- [ ] Redeploy application

### 5. Test Everything
- [ ] Run `npm run dev`
- [ ] Visit `http://localhost:3000`
- [ ] Should redirect to `/login`
- [ ] Test registration with TAMU email
- [ ] Check email for verification link
- [ ] Click verification link
- [ ] Login and access survey
- [ ] Test password reset flow

## 🎉 You're Done!

Once all checkboxes are checked, authentication is fully set up.

**Need help?** See `AUTH_SETUP_ORGANIZECAMPUS.md` for detailed instructions.

