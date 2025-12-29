# Vercel Deployment - Step by Step

## Quick Start (5 minutes)

### 1. Prepare Your Code

```bash
# Make sure everything is committed
git add .
git commit -m "Ready for deployment"
git push
```

### 2. Deploy to Vercel

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. Click **"Add New Project"**
3. **Import** your GitHub repository
4. Vercel will auto-detect Next.js - click **"Deploy"**

### 3. Add Environment Variables

**Before the first deploy completes**, go to:
- **Settings** → **Environment Variables**

Add these (get values from Supabase Dashboard → Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (optional)
```

**Important**: Select all environments (Production, Preview, Development)

### 4. Redeploy

After adding environment variables:
- Go to **Deployments** tab
- Click **"..."** on latest deployment → **"Redeploy"**

### 5. Test

Visit your deployed URL (e.g., `https://your-app.vercel.app`) and:
- ✅ Test the survey form
- ✅ Submit a form
- ✅ Check Supabase Dashboard → Table Editor → `users` to see data

## ⚠️ Known Limitation: Python Search API

The `/api/search` endpoint uses Python scripts which **won't work** on Vercel's Next.js serverless functions.

### Current Status:
- ✅ Frontend works perfectly
- ✅ Form submission to Supabase works
- ❌ Search functionality will fail (Python not available)

### Quick Fix Options:

**Option A: Use Separate Python Service** (Recommended)
1. Deploy Python search to Railway/Render
2. Update `app/api/search/route.ts` to call external API
3. Or create a proxy endpoint

**Option B: Test Locally**
- Keep search working locally
- Deploy frontend to Vercel
- Users can use locally until Python service is set up

## Monitoring

- **Vercel Dashboard**: View logs, deployments, analytics
- **Supabase Dashboard**: Monitor database, view stored data
- **Function Logs**: Check for errors in Vercel → Functions tab

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Ensure `npm run build` works locally
- Verify all dependencies in `package.json`

### Environment Variables Not Working
- Make sure they're set for all environments
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

### Supabase Connection Fails
- Verify environment variables are correct
- Check Supabase RLS policies allow writes
- Test locally first: `node scripts/check-stored-data.js`

## Next Steps

1. ✅ Deploy frontend (works now)
2. ⏳ Set up Python search service (see DEPLOYMENT.md)
3. ✅ Monitor usage in Vercel and Supabase dashboards

