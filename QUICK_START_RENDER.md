# Quick Start: Deploy Search API to Render

## Step 1: Deploy to Render (5 min)

1. Go to [render.com](https://render.com) → Sign up/Login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo
4. Settings:
   - **Name**: `organize-survey-search-api`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn api_server:app --bind 0.0.0.0:$PORT`
5. Click **"Create Web Service"**
6. Wait for deployment (~5 min)
7. **Copy your URL**: `https://your-app.onrender.com`

## Step 2: Update Vercel (2 min)

1. Go to Vercel → Your Project → **Settings** → **Environment Variables**
2. Add new variable:
   - **Name**: `SEARCH_API_URL`
   - **Value**: `https://your-app.onrender.com` (from step 1)
   - **Environments**: ✅ Production ✅ Preview ✅ Development
3. Click **Save**
4. Go to **Deployments** → Click **"..."** on latest → **"Redeploy"**

## Step 3: Test

1. Go to your deployed Vercel site
2. Fill out and submit the form
3. Search should now work! 🎉

## Troubleshooting

**Render service won't start?**
- Check Render logs
- Make sure `final.csv` is in repo root
- Verify `requirements.txt` has Flask dependencies

**Search still not working?**
- Check Vercel function logs
- Verify `SEARCH_API_URL` is set correctly
- Test Render API directly: `curl -X POST https://your-app.onrender.com/search -H "Content-Type: application/json" -d '{"query":"test","userData":{}}'`

**Slow first request?**
- Render free tier has ~30s cold start after 15min inactivity
- This is normal - subsequent requests are fast

