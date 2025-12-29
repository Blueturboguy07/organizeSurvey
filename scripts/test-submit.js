// Test script to verify submit API and Supabase storage
require('dotenv').config({ path: '.env.local' })
const fetch = require('node-fetch')

const testData = {
  name: 'Test User',
  email: 'test@example.com',
  query: 'Engineering | Engineering | Engineering | Volunteering | Technology',
  cleansedQuery: 'Engineering | Engineering | Engineering | Volunteering | Technology',
  queryKeywords: ['Engineering', 'Volunteering', 'Technology']
}

console.log('🧪 Testing submit API endpoint...')
console.log('📤 Sending test data:', testData)

fetch('http://localhost:3000/api/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData)
})
  .then(async (res) => {
    const data = await res.json()
    if (!res.ok) {
      console.error('❌ API Error:', res.status, data)
      process.exit(1)
    }
    console.log('✅ API Response:', data)
    console.log('\n🔍 Now verifying data in Supabase...')
    
    // Verify in Supabase
    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', testData.email.toLowerCase().trim())
      .single()
    
    if (error) {
      console.error('❌ Supabase query error:', error.message)
      process.exit(1)
    }
    
    if (!userData) {
      console.error('❌ No data found in Supabase!')
      process.exit(1)
    }
    
    console.log('✅ Data found in Supabase:')
    console.log('   Email:', userData.email)
    console.log('   Name:', userData.name)
    console.log('   Latest Query:', userData.latest_query?.substring(0, 50) + '...')
    console.log('   Keywords:', userData.latest_query_keywords)
    console.log('   Last Updated:', userData.last_updated)
    console.log('   First Seen:', userData.first_seen)
    
    // Verify data matches
    if (userData.name !== testData.name) {
      console.error('❌ Name mismatch!')
      process.exit(1)
    }
    if (userData.latest_query !== testData.query) {
      console.error('❌ Query mismatch!')
      process.exit(1)
    }
    
    console.log('\n🎉 All tests passed! Data is being stored correctly in Supabase.')
  })
  .catch((err) => {
    console.error('❌ Test failed:', err.message)
    if (err.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure the dev server is running: npm run dev')
    }
    process.exit(1)
  })

