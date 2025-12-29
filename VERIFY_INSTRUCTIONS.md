# Verification Instructions

## Current Issue: Schema Cache

Supabase's PostgREST needs to refresh its schema cache to see your `users` table.

## Quick Fix (Choose One):

### Option 1: Refresh Schema Cache (Easiest)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **New query**
3. Paste and run:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
4. Wait 10-20 seconds
5. Run the verification script: `node scripts/verify-setup.js`

### Option 2: Recreate Table with Proper Policies

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **New query**
3. Copy and paste the entire contents of `scripts/fix-schema-cache.sql`
4. Click **Run**
5. Wait 10-20 seconds
6. Run the verification script: `node scripts/verify-setup.js`

### Option 3: Get Service Role Key (Recommended for Production)

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Find **service_role** key (⚠️ Keep secret!)
3. Add to `.env.local`:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
4. Restart dev server: `npm run dev`
5. Run verification: `node scripts/verify-setup.js`

## After Fixing:

### Test via Script:
```bash
node scripts/verify-setup.js
```

### Test via API:
```bash
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "query": "Engineering | Technology",
    "cleansedQuery": "Engineering | Technology",
    "queryKeywords": ["Engineering", "Technology"]
  }'
```

### Test via Browser:
1. Go to `http://localhost:3000`
2. Complete the survey form
3. Submit it
4. Check Supabase Dashboard → Table Editor → `users` to see your data

## Expected Result:

✅ All tests should pass
✅ Data should appear in Supabase `users` table
✅ You should see the user's email, name, and latest query

