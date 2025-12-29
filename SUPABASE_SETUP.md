# Supabase Setup Instructions

Follow these steps to set up Supabase for storing user queries.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: Your project name (e.g., "tamu-survey")
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait 2-3 minutes for the project to be set up

## Step 2: Create the Users Table

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Paste this SQL and click **Run**:

```sql
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latest_query TEXT,
  latest_cleansed_query TEXT,
  latest_query_keywords JSONB,
  last_updated TIMESTAMP DEFAULT NOW(),
  first_seen TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security (optional, for production)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows inserts/updates (for development)
-- For production, you should restrict this based on authentication
CREATE POLICY "Allow all operations" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

4. You should see "Success. No rows returned"

## Step 3: Get Your API Keys

1. In Supabase dashboard, go to **Settings** (gear icon) → **API**
2. You'll see two important values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## Step 4: Add Environment Variables

### For Local Development:

Create or update `.env.local` in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace with your actual values from Step 3.

### For Vercel Deployment:

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add these two variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key
4. Make sure to select **Production**, **Preview**, and **Development** environments
5. Click **Save**
6. Redeploy your application

## Step 5: Test It

1. Start your dev server: `npm run dev`
2. Complete a survey submission
3. Go to Supabase dashboard → **Table Editor** → **users**
4. You should see your user data!

## Viewing Your Data

### In Supabase Dashboard:
- Go to **Table Editor** → **users**
- See all users with their latest queries
- Click on any row to see full details

### Query Data via SQL:
Go to **SQL Editor** and run:

```sql
-- Get all users
SELECT * FROM users ORDER BY last_updated DESC;

-- Get latest query for a specific user
SELECT email, name, latest_query, last_updated 
FROM users 
WHERE email = 'user@example.com';

-- Count total users
SELECT COUNT(*) FROM users;
```

## Security Notes

⚠️ **For Production:**
- The current policy allows all operations (good for testing)
- For production, you should:
  1. Set up proper Row Level Security policies
  2. Consider adding authentication
  3. Restrict who can read/write data

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Make sure `.env.local` exists and has both variables
- Restart your dev server after adding env variables
- For Vercel, make sure env variables are set in dashboard

### Error: "relation 'users' does not exist"
- Run the SQL from Step 2 to create the table

### Error: "permission denied"
- Check your Row Level Security policies
- For development, use the permissive policy shown above

### Data not appearing
- Check browser console for errors
- Verify environment variables are correct
- Check Supabase dashboard → Logs for errors

