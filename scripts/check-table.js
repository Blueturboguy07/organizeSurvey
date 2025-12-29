// Check if users table exists in Supabase
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

console.log('🔍 Checking if users table exists...')

// Try to query the table
supabase
  .from('users')
  .select('count', { count: 'exact', head: true })
  .then(({ error, count }) => {
    if (error) {
      if (error.message.includes('does not exist') || error.code === 'PGRST116') {
        console.error('❌ Table "users" does not exist!')
        console.log('\n📝 Please run this SQL in your Supabase SQL Editor:')
        console.log('\n' + '='.repeat(60))
        console.log(`
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latest_query TEXT,
  latest_cleansed_query TEXT,
  latest_query_keywords JSONB,
  last_updated TIMESTAMP DEFAULT NOW(),
  first_seen TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (for development)
CREATE POLICY "Allow all operations" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);
`)
        console.log('='.repeat(60))
        console.log('\n📍 Steps:')
        console.log('1. Go to Supabase Dashboard → SQL Editor')
        console.log('2. Click "New query"')
        console.log('3. Paste the SQL above')
        console.log('4. Click "Run"')
        console.log('5. Then run the test again\n')
      } else {
        console.error('❌ Error:', error.message)
      }
      process.exit(1)
    } else {
      console.log('✅ Table "users" exists!')
      console.log(`📊 Current row count: ${count || 0}`)
      console.log('\n✅ Ready to test submissions!')
    }
  })
  .catch(err => {
    console.error('❌ Error:', err.message)
    process.exit(1)
  })

