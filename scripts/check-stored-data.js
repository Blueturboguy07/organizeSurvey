// Check if data was actually stored
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

console.log('🔍 Checking stored data in Supabase...\n')

supabase
  .from('users')
  .select('*')
  .order('last_updated', { ascending: false })
  .limit(5)
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Error:', error.message)
      process.exit(1)
    }
    
    if (!data || data.length === 0) {
      console.log('📭 No users found in database')
    } else {
      console.log(`✅ Found ${data.length} user(s):\n`)
      data.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`)
        console.log(`   Latest Query: ${user.latest_query?.substring(0, 60)}...`)
        console.log(`   Keywords: ${JSON.stringify(user.latest_query_keywords)}`)
        console.log(`   Last Updated: ${user.last_updated}`)
        console.log(`   First Seen: ${user.first_seen}`)
        console.log('')
      })
    }
  })

