// Script to check and fix Supabase setup
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

console.log('🔍 Checking Supabase setup...\n')

// Test 1: Check if we can read
console.log('1️⃣ Testing read access...')
supabase
  .from('users')
  .select('count', { count: 'exact', head: true })
  .then(({ error, count }) => {
    if (error) {
      console.error('   ❌ Read failed:', error.message)
      if (error.message.includes('schema cache')) {
        console.log('\n💡 This is a schema cache issue. Try:')
        console.log('   1. Go to Supabase Dashboard → Settings → API')
        console.log('   2. Click "Reload schema" or wait a few minutes')
        console.log('   3. Or run this SQL to refresh:')
        console.log('      SELECT pg_notify(\'pgrst\', \'reload schema\');')
      }
      if (error.code === 'PGRST301' || error.message.includes('permission')) {
        console.log('\n💡 Row Level Security might be blocking. Run this SQL:')
        console.log(`
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations" ON users;

-- Create a new policy that allows all operations
CREATE POLICY "Allow all operations" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);
        `)
      }
    } else {
      console.log('   ✅ Read works!')
    }
    
    // Test 2: Try to insert
    console.log('\n2️⃣ Testing write access...')
    const testEmail = 'test-write@example.com'
    supabase
      .from('users')
      .upsert({
        email: testEmail,
        name: 'Test Write',
        latest_query: 'test',
        latest_cleansed_query: 'test',
        latest_query_keywords: []
      }, { onConflict: 'email' })
      .then(({ error: writeError }) => {
        if (writeError) {
          console.error('   ❌ Write failed:', writeError.message)
          console.log('\n💡 Solutions:')
          console.log('   1. Check Row Level Security policies')
          console.log('   2. Make sure the anon key has proper permissions')
          console.log('   3. Try refreshing the schema cache in Supabase dashboard')
        } else {
          console.log('   ✅ Write works!')
          // Clean up test data
          supabase.from('users').delete().eq('email', testEmail)
          console.log('\n✅ All tests passed!')
        }
      })
  })

