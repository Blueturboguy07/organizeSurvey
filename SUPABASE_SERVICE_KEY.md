# Getting Your Supabase Service Role Key

The service role key is needed for server-side API routes to bypass Row Level Security.

## Steps:

1. Go to your Supabase Dashboard
2. Click **Settings** (gear icon) → **API**
3. Scroll down to **Project API keys**
4. Find **service_role** key (⚠️ Keep this secret!)
5. Copy the key

## Add to Environment Variables:

### For Local Development (.env.local):
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### For Vercel:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - Key: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: Your service role key
   - Environment: Production, Preview, Development
3. Redeploy

⚠️ **Important**: Never expose the service role key in client-side code! It's only used in API routes.

