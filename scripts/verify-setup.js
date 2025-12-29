// Comprehensive verification script
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

console.log('🔍 Verifying Supabase Setup...\n')

// Check environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('1️⃣ Environment Variables:')
console.log('   ✅ NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '❌ Missing')
console.log('   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '❌ Missing')
console.log('   ⚠️  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓ Set (recommended)' : '⚠️  Not set (will use anon key)')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('\n❌ Missing required environment variables!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : supabase

console.log('\n2️⃣ Testing Database Connection:')

// Test 1: Check table exists
supabase
  .from('users')
  .select('count', { count: 'exact', head: true })
  .then(({ error, count }) => {
    if (error) {
      console.error('   ❌ Table check failed:', error.message)
      if (error.message.includes('schema cache')) {
        console.log('\n💡 SCHEMA CACHE ISSUE DETECTED!')
        console.log('\n📝 To fix this, run this SQL in Supabase SQL Editor:')
        console.log('\n' + '='.repeat(70))
        console.log(`
-- Option 1: Refresh schema cache (recommended)
NOTIFY pgrst, 'reload schema';

-- Option 2: If that doesn't work, recreate the table
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

-- Disable RLS temporarily for testing (or create proper policies)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS and create permissive policy
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Refresh schema again
NOTIFY pgrst, 'reload schema';
        `)
        console.log('='.repeat(70))
        console.log('\n📍 Steps:')
        console.log('   1. Go to Supabase Dashboard → SQL Editor')
        console.log('   2. Click "New query"')
        console.log('   3. Paste the SQL above')
        console.log('   4. Click "Run"')
        console.log('   5. Wait 10-20 seconds for cache to refresh')
        console.log('   6. Run this script again\n')
      }
      process.exit(1)
    } else {
      console.log('   ✅ Table exists!')
      console.log(`   📊 Current users: ${count || 0}`)
      
      // Test 2: Try to insert
      console.log('\n3️⃣ Testing Write Access:')
      const testEmail = `test-${Date.now()}@example.com`
      
      supabaseAdmin
        .from('users')
        .upsert({
          email: testEmail,
          name: 'Test User',
          latest_query: 'Engineering | Technology',
          latest_cleansed_query: 'Engineering | Technology',
          latest_query_keywords: ['Engineering', 'Technology'],
        }, { onConflict: 'email' })
        .then(({ error: writeError, data }) => {
          if (writeError) {
            console.error('   ❌ Write failed:', writeError.message)
            if (writeError.message.includes('schema cache')) {
              console.log('\n💡 Still a schema cache issue. Try:')
              console.log('   1. Wait 2-3 minutes for automatic refresh')
              console.log('   2. Or run: NOTIFY pgrst, \'reload schema\'; in SQL Editor')
              console.log('   3. Or restart your Supabase project')
            }
            process.exit(1)
          } else {
            console.log('   ✅ Write successful!')
            
            // Test 3: Verify data was saved
            console.log('\n4️⃣ Verifying Data:')
            supabaseAdmin
              .from('users')
              .select('*')
              .eq('email', testEmail)
              .single()
              .then(({ data: userData, error: readError }) => {
                if (readError || !userData) {
                  console.error('   ❌ Could not read back data:', readError?.message)
                  process.exit(1)
                } else {
                  console.log('   ✅ Data verified!')
                  console.log('      Email:', userData.email)
                  console.log('      Name:', userData.name)
                  console.log('      Query:', userData.latest_query)
                  
                  // Clean up
                  supabaseAdmin.from('users').delete().eq('email', testEmail)
                  console.log('\n✅ All tests passed! Your setup is working correctly.')
                  console.log('\n🎉 Ready to accept submissions!')
                }
              })
          }
        })
    }
  })

