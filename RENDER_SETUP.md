# Render Deployment Guide for Search API

This guide will help you deploy the Python search API to Render so your Vercel app can use it.

## Quick Setup (5 minutes)

### 1. Prepare Your Code

Make sure these files are in your repository:
- `api_server.py` (Flask API server)
- `scripts/weighted_search.py` (search logic)
- `final.csv` (organizations data)
- `requirements.txt` (Python dependencies)
- `Procfile` (tells Render how to run the app)

### 2. Deploy to Render

1. **Go to [render.com](https://render.com)** and sign up/login
2. Click **"New +"** → **"Web Service"**
3. **Connect your GitHub repository** (the same one you use for Vercel)
4. Configure the service:
   - **Name**: `organize-survey-search-api` (or whatever you want)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn api_server:app --bind 0.0.0.0:$PORT`
   - **Plan**: Free tier is fine to start

5. Click **"Create Web Service"**

### 3. Add Environment Variables (Optional)

In Render dashboard → **Environment** tab:
- `CSV_PATH`: `./final.csv` (default, usually don't need to set)
- `PORT`: Auto-set by Render (don't change)

### 4. Get Your API URL

Once deployed, Render will give you a URL like:
```
https://organize-survey-search-api.onrender.com
```

**Copy this URL** - you'll need it for the next step!

### 5. Update Your Vercel App

Now update your Next.js app to use the Render API:

1. **Add environment variable in Vercel**:
   - Go to Vercel → Settings → Environment Variables
   - Add: `SEARCH_API_URL` = `https://your-render-app.onrender.com`
   - Make sure it's set for **all environments** (Production, Preview, Development)

2. **Update the search route** (already done in `app/api/search/route.ts`)

3. **Redeploy your Vercel app**

## Testing

1. **Test Render API directly**:
   ```bash
   curl -X POST https://your-render-app.onrender.com/search \
     -H "Content-Type: application/json" \
     -d '{"query": "engineering", "userData": {}}'
   ```

2. **Test from your Vercel app**:
   - Submit the form on your deployed site
   - Check browser console for any errors
   - Search should now work!

## Troubleshooting

### Render Service Won't Start

- Check Render logs: **Logs** tab in Render dashboard
- Make sure `final.csv` is in your repository root
- Verify `requirements.txt` has all dependencies

### Search Returns Errors

- Check Render logs for Python errors
- Verify CSV file path is correct
- Test the API directly with curl (see above)

### CORS Errors

- Flask-CORS should handle this automatically
- If you see CORS errors, check that `flask-cors` is in `requirements.txt`

### Slow First Request

- Render free tier "spins down" after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds (cold start)
- Consider upgrading to paid tier for faster response times

## Cost

- **Free tier**: Works great for testing/small projects
  - 750 hours/month free
  - Services spin down after 15 min inactivity
  - Cold starts take ~30 seconds
  
- **Paid tier**: $7/month per service
  - Always-on (no cold starts)
  - Faster response times
  - Better for production

## Next Steps

1. ✅ Deploy to Render
2. ✅ Add `SEARCH_API_URL` to Vercel env vars
3. ✅ Redeploy Vercel app
4. ✅ Test search functionality
5. 🎉 Your app should now work end-to-end!

