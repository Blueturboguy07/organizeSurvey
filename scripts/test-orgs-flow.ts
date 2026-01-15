/**
 * Test script to debug organization join/save flow
 * Run with: npx ts-node scripts/test-orgs-flow.ts
 * 
 * This tests:
 * 1. Database connection
 * 2. Inserting/deleting from user_joined_organizations
 * 3. Inserting/deleting from saved_organizations
 * 4. Fetching joined/saved organizations
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  console.log('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testOrgsFlow() {
  console.log('🧪 Testing Organization Flow\n')
  console.log('='.repeat(50))

  // 1. Get a test user
  console.log('\n1️⃣ Getting test user...')
  const { data: users, error: usersError } = await supabase
    .from('user_queries')
    .select('user_id')
    .limit(1)
    .single()

  if (usersError || !users) {
    console.log('❌ No users found in user_queries table')
    console.log('   Error:', usersError?.message)
    
    // Try getting from auth.users
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    if (authUsers?.users?.[0]) {
      console.log('✅ Found user from auth:', authUsers.users[0].id)
    }
    return
  }

  const testUserId = users.user_id
  console.log('✅ Test user ID:', testUserId)

  // 2. Get a test organization
  console.log('\n2️⃣ Getting test organization...')
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name')
    .limit(5)

  if (orgsError || !orgs || orgs.length === 0) {
    console.log('❌ No organizations found')
    console.log('   Error:', orgsError?.message)
    return
  }

  console.log('✅ Found', orgs.length, 'organizations')
  orgs.forEach(org => console.log('   -', org.name, '(', org.id, ')'))
  
  const testOrgId = orgs[0].id
  const testOrgName = orgs[0].name

  // 3. Test user_joined_organizations table
  console.log('\n3️⃣ Testing user_joined_organizations table...')
  
  // Check current joined orgs
  const { data: currentJoined, error: currentJoinedError } = await supabase
    .from('user_joined_organizations')
    .select('*')
    .eq('user_id', testUserId)

  console.log('   Current joined orgs:', currentJoined?.length || 0)
  if (currentJoinedError) {
    console.log('   ❌ Error fetching:', currentJoinedError.message)
  }

  // Try to insert
  console.log('   Attempting to join org...')
  const { data: joinData, error: joinError } = await supabase
    .from('user_joined_organizations')
    .insert({
      user_id: testUserId,
      organization_id: testOrgId
    })
    .select()

  if (joinError) {
    if (joinError.code === '23505') {
      console.log('   ⚠️ Already joined (unique constraint)')
    } else {
      console.log('   ❌ Error joining:', joinError.message, joinError.code)
    }
  } else {
    console.log('   ✅ Successfully joined:', joinData)
  }

  // Verify it's in the database
  const { data: verifyJoined } = await supabase
    .from('user_joined_organizations')
    .select('*')
    .eq('user_id', testUserId)
    .eq('organization_id', testOrgId)

  console.log('   Verification - found in DB:', verifyJoined?.length ? '✅ Yes' : '❌ No')

  // 4. Test saved_organizations table
  console.log('\n4️⃣ Testing saved_organizations table...')
  
  // Check current saved orgs
  const { data: currentSaved, error: currentSavedError } = await supabase
    .from('saved_organizations')
    .select('*')
    .eq('user_id', testUserId)

  console.log('   Current saved orgs:', currentSaved?.length || 0)
  if (currentSavedError) {
    console.log('   ❌ Error fetching:', currentSavedError.message)
    console.log('   ℹ️ The saved_organizations table might not exist yet')
  }

  if (!currentSavedError) {
    // Try to insert
    console.log('   Attempting to save org...')
    const { data: saveData, error: saveError } = await supabase
      .from('saved_organizations')
      .insert({
        user_id: testUserId,
        organization_id: testOrgId,
        organization_name: testOrgName,
        saved_when_not_on_platform: false,
        notify_when_available: false,
        auto_joined: false
      })
      .select()

    if (saveError) {
      if (saveError.code === '23505') {
        console.log('   ⚠️ Already saved (unique constraint)')
      } else {
        console.log('   ❌ Error saving:', saveError.message, saveError.code)
      }
    } else {
      console.log('   ✅ Successfully saved:', saveData)
    }
  }

  // 5. Test the API query flow (simulating what the API does)
  console.log('\n5️⃣ Testing API query flow for joined organizations...')
  
  // This is what /api/organizations/joined does
  const { data: joinedOrgsResult, error: joinedOrgsError } = await supabase
    .from('user_joined_organizations')
    .select('organization_id, joined_at')
    .eq('user_id', testUserId)
    .order('joined_at', { ascending: false })

  if (joinedOrgsError) {
    console.log('   ❌ Error:', joinedOrgsError.message)
  } else {
    console.log('   Found', joinedOrgsResult?.length || 0, 'joined organization IDs')
    
    if (joinedOrgsResult && joinedOrgsResult.length > 0) {
      const orgIds = joinedOrgsResult.map(jo => jo.organization_id)
      console.log('   IDs:', orgIds)
      
      // Fetch org details
      const { data: orgDetails, error: orgDetailsError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)

      if (orgDetailsError) {
        console.log('   ❌ Error fetching org details:', orgDetailsError.message)
      } else {
        console.log('   ✅ Got details for', orgDetails?.length || 0, 'organizations')
        orgDetails?.forEach(org => {
          console.log('      -', org.name)
        })
      }
    }
  }

  // 6. Test the API query flow for saved organizations
  console.log('\n6️⃣ Testing API query flow for saved organizations...')
  
  const { data: savedOrgsResult, error: savedOrgsError } = await supabase
    .from('saved_organizations')
    .select('id, organization_id, organization_name, saved_when_not_on_platform, notify_when_available, auto_joined, saved_at')
    .eq('user_id', testUserId)
    .order('saved_at', { ascending: false })

  if (savedOrgsError) {
    console.log('   ❌ Error:', savedOrgsError.message)
  } else {
    console.log('   Found', savedOrgsResult?.length || 0, 'saved organizations')
    savedOrgsResult?.forEach(so => {
      console.log('      -', so.organization_name, so.organization_id ? '(on platform)' : '(not on platform)')
    })
  }

  // 7. Check RLS policies
  console.log('\n7️⃣ Checking if RLS is enabled...')
  
  // Try with anon key to see if RLS blocks
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const anonClient = createClient(supabaseUrl as string, anonKey)
  
  const { data: anonJoined, error: anonJoinedError } = await anonClient
    .from('user_joined_organizations')
    .select('*')
    .eq('user_id', testUserId)

  if (anonJoinedError) {
    console.log('   ⚠️ Anon client blocked by RLS (expected):', anonJoinedError.message)
  } else {
    console.log('   Anon client returned', anonJoined?.length || 0, 'rows')
    console.log('   ℹ️ If this is 0 with no error, RLS might be blocking without auth')
  }

  // 8. Clean up test data (optional)
  console.log('\n8️⃣ Cleanup (leaving test data)...')
  console.log('   To clean up manually, run:')
  console.log(`   DELETE FROM user_joined_organizations WHERE user_id = '${testUserId}';`)
  console.log(`   DELETE FROM saved_organizations WHERE user_id = '${testUserId}';`)

  console.log('\n' + '='.repeat(50))
  console.log('✅ Test complete!\n')
}

testOrgsFlow().catch(console.error)

