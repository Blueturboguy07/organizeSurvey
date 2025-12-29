# Deployment Steps - What to Do Now

## ✅ What I Just Did

1. ✅ Created `api/search.py` - Python serverless function for Vercel
2. ✅ Updated `app/api/search/route.ts` - Now calls Python function on Vercel, uses local Python locally
3. ✅ Updated `vercel.json` - Added Python 3.9 runtime configuration
4. ✅ Updated `.gitignore` - Removed `organizations_embeddings.pkl` so it gets deployed

## 📋 What You Need to Do Now

### Step 1: Commit and Push Your Changes

```bash
# Add all files (including the new Python API)
git add .

# Commit the changes
git commit -m "Add Python serverless function for Vercel deployment"

# Push to GitHub
git push origin main
```

### Step 2: Verify Required Files Are in Git

Make sure these files are tracked (not ignored):

```bash
# Check if these files are tracked
git ls-files | grep -E "(final.csv|organizations_embeddings.pkl|api/search.py|scripts/weighted_search.py|requirements.txt)"
```

If any are missing, force add them:

```bash
git add -f final.csv organizations_embeddings.pkl
git commit -m "Add required data files for deployment"
git push
```

### Step 3: Deploy to Vercel

**Option A: Automatic (if already connected to GitHub)**
- Vercel will automatically redeploy when you push
- Go to Vercel Dashboard → Your Project → Deployments
- Wait for the new deployment to complete

**Option B: Manual Deploy**
1. Go to [vercel.com](https://vercel.com)
2. Click on your project
3. Go to **Deployments** tab
4. Click **"Redeploy"** on the latest deployment
5. Or push a new commit to trigger deployment

### Step 4: Verify Python Runtime

After deployment, check:

1. **Vercel Dashboard** → **Functions** tab
   - You should see `api/search.py` listed
   - Runtime should show `python3.9`

2. **Test the deployment:**
   - Visit your Vercel URL
   - Complete the survey form
   - Submit and check if search results appear
   - Check Vercel Function Logs for any errors

### Step 5: Check Function Logs

If there are errors:

1. Go to **Vercel Dashboard** → **Functions** → `api/search.py`
2. Click on a recent invocation
3. Check **Logs** tab for Python errors
4. Common issues:
   - Missing dependencies → Check `requirements.txt`
   - File not found → Verify `final.csv` and `organizations_embeddings.pkl` are deployed
   - Import errors → Check Python path in `api/search.py`

## 🔍 Troubleshooting

### Error: "Module not found" or Import errors

**Solution:** Make sure `requirements.txt` has all dependencies:
```txt
pandas>=2.0.0
numpy<2.0.0,>=1.24.0
sentence-transformers>=2.2.0
scikit-learn>=1.3.0
```

### Error: "File not found: final.csv"

**Solution:** 
1. Check file is in git: `git ls-files | grep final.csv`
2. If not, add it: `git add -f final.csv && git commit -m "Add CSV" && git push`

### Error: "Function timeout"

**Solution:**
- First search may take longer (downloading models)
- Vercel free tier has 10s timeout
- Consider upgrading or optimizing the search

### Search still not working

**Check:**
1. Vercel Function Logs for Python errors
2. Browser Console for JavaScript errors
3. Network tab to see if `/api/search` is being called
4. Verify environment variables are set

## ✅ Success Indicators

You'll know it's working when:
- ✅ Survey form loads on Vercel
- ✅ Form submission saves to Supabase
- ✅ Search results appear after submission
- ✅ No "spawn python3 ENOENT" errors
- ✅ Vercel Functions shows `api/search.py` with successful invocations

## 📝 Next Steps After Deployment

1. **Monitor Usage:**
   - Check Vercel Analytics
   - Monitor Supabase for stored data
   - Watch function execution times

2. **Optimize if needed:**
   - Cache embeddings if searches are slow
   - Consider pre-warming the function
   - Monitor costs on Vercel

3. **Test thoroughly:**
   - Test with different queries
   - Verify all form fields work
   - Check mobile responsiveness

---

**Ready to deploy?** Just commit and push, then wait for Vercel to rebuild!

