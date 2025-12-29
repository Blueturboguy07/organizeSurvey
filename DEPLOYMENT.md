# Deployment Guide

## Quick Deploy to Vercel

### Prerequisites
- GitHub account
- Vercel account (free tier works)
- Supabase project set up

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### Step 3: Add Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (optional but recommended)
```

Add these for **Production**, **Preview**, and **Development** environments.

### Step 4: Deploy

Click "Deploy" and wait for the build to complete.

## ⚠️ Important: Python Runtime Limitation

**Current Issue**: The `/api/search` route uses Python scripts, which Vercel's Next.js serverless functions don't support natively.

### Solution Options:

#### Option 1: Use Separate Python Service (Recommended)

Deploy the Python search functionality to a separate service:

1. **Railway** (easiest):
   - Create account at [railway.app](https://railway.app)
   - Create new project from GitHub
   - Add `requirements.txt` and Python files
   - Deploy
   - Update your Next.js app to call the Railway endpoint

2. **Render**:
   - Similar to Railway
   - Free tier available

3. **Google Cloud Run** or **AWS Lambda**:
   - More complex but scalable

#### Option 2: Convert Python to Node.js

Convert `scripts/weighted_search.py` to JavaScript/TypeScript. This requires:
- Rewriting the search logic in Node.js
- Using a JavaScript ML library (like `@xenova/transformers`)

#### Option 3: Pre-compute Results

If your organization data doesn't change often:
- Pre-compute search results for common queries
- Store in Supabase or a database
- Serve from cache

### Temporary Workaround

For now, the search API will fail on Vercel. You can:
1. Test locally with `npm run dev`
2. Deploy the frontend to Vercel (works fine)
3. Keep search API on a separate service

## Post-Deployment Checklist

- [ ] Environment variables set in Vercel
- [ ] Supabase RLS policies configured
- [ ] Test form submission works
- [ ] Test search functionality (if using separate service)
- [ ] Check Vercel function logs for errors
- [ ] Verify data is saving to Supabase

## Monitoring

- **Vercel Dashboard**: View deployment logs and function logs
- **Supabase Dashboard**: Monitor database usage and queries
- **Function Logs**: Check for Python/API errors

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript compiles: `npm run build`

### API Routes Not Working
- Check function logs in Vercel
- Verify environment variables are set
- Test locally first: `npm run dev`

### Supabase Connection Issues
- Verify environment variables match Supabase project
- Check Supabase RLS policies
- Test connection: `node scripts/check-stored-data.js`

### Python Script Issues
- Python won't work in Vercel Next.js functions
- Use one of the solution options above

## Next Steps

1. **Immediate**: Deploy frontend to Vercel (works now)
2. **Short-term**: Set up Python service for search API
3. **Long-term**: Consider converting to Node.js for simplicity

