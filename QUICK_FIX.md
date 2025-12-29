# Quick Fix for Schema Cache Issue

The error `PGRST204: Could not find the 'email' column` means Supabase's PostgREST hasn't refreshed its schema cache.

## Solution: Refresh Schema Cache

### Method 1: SQL Notification (Fastest)

1. **Go to Supabase Dashboard**
2. **SQL Editor** → **New query**
3. **Paste this and click Run:**
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
4. **Wait 30 seconds** (cache refresh takes time)
5. **Test again:** `node scripts/verify-setup.js`

### Method 2: Restart Supabase Project

1. **Go to Supabase Dashboard**
2. **Settings** → **General**
3. **Click "Restart project"** (if available)
4. **Wait 2-3 minutes** for restart
5. **Test again**

### Method 3: Recreate Table (If above don't work)

1. **Go to SQL Editor**
2. **Run this:**
   ```sql
   -- Drop and recreate
   DROP TABLE IF EXISTS users CASCADE;
   
   CREATE TABLE users (
     email TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     latest_query TEXT,
     latest_cleansed_query TEXT,
     latest_query_keywords JSONB,
     last_updated TIMESTAMP DEFAULT NOW(),
     first_seen TIMESTAMP DEFAULT NOW()
   );
   
   -- Disable RLS for testing
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   
   -- Refresh cache
   NOTIFY pgrst, 'reload schema';
   ```
3. **Wait 30 seconds**
4. **Test again**

### Method 4: Use Service Role Key (Bypasses RLS)

1. **Get service role key:**
   - Supabase Dashboard → Settings → API
   - Copy **service_role** key (keep secret!)

2. **Add to `.env.local`:**
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

3. **Restart dev server:**
   ```bash
   # Kill existing server
   pkill -f "next dev"
   # Start fresh
   npm run dev
   ```

4. **Test:** `node scripts/verify-setup.js`

---

## Verify Table Exists

Check in Supabase Dashboard:
1. **Table Editor** → You should see `users` table
2. If you see it, the table exists but cache needs refresh
3. If you don't see it, recreate using Method 3

## After Fixing

Run verification:
```bash
node scripts/verify-setup.js
```

You should see:
- ✅ Table exists!
- ✅ Write successful!
- ✅ Data verified!

