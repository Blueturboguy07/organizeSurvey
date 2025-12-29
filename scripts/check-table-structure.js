// Check actual table structure in Supabase
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

console.log('🔍 Checking table structure...\n')

// Try to query table structure via SQL
supabase.rpc('exec_sql', {
  query: `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position;
  `
}).then(({ data, error }) => {
  if (error) {
    console.log('Trying alternative method...\n')
    // Alternative: try to describe via direct query
    supabase
      .from('users')
      .select('*')
      .limit(0)
      .then(({ error: descError }) => {
        if (descError) {
          console.error('❌ Error:', descError.message)
          console.log('\n💡 The schema cache needs to be refreshed.')
          console.log('   Try these steps:')
          console.log('   1. Go to Supabase Dashboard → SQL Editor')
          console.log('   2. Run: NOTIFY pgrst, \'reload schema\';')
          console.log('   3. Wait 30 seconds')
          console.log('   4. Or restart your Supabase project')
        }
      })
  } else {
    console.log('Table structure:', data)
  }
})

// Also try a simple test insert with explicit column names
console.log('\n🧪 Testing direct insert...')
const testEmail = `direct-test-${Date.now()}@example.com`

supabase
  .from('users')
  .insert({
    email: testEmail,
    name: 'Direct Test',
    latest_query: 'test',
    latest_cleansed_query: 'test',
    latest_query_keywords: []
  })
  .select()
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Insert failed:', error.message)
      console.error('   Code:', error.code)
      console.error('   Details:', error.details)
      console.error('   Hint:', error.hint)
    } else {
      console.log('✅ Insert successful!')
      console.log('   Data:', data)
      // Clean up
      supabase.from('users').delete().eq('email', testEmail)
    }
  })

