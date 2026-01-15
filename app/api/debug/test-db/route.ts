import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to test database operations
 * Access at /api/debug/test-db with your auth token
 */
export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {}
  }

  try {
    // 1. Check auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No auth header - add Authorization: Bearer <token>' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Auth failed', 
        details: authError?.message,
        tests: results.tests 
      }, { status: 401 })
    }

    results.user = { id: user.id, email: user.email }
    results.tests.auth = '✅ Authenticated'

    // 2. Test organizations table
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .limit(3)

    if (orgsError) {
      results.tests.organizations = `❌ Error: ${orgsError.message}`
    } else {
      results.tests.organizations = `✅ Found ${orgs?.length || 0} organizations`
      results.sampleOrgs = orgs
    }

    // 3. Test user_joined_organizations table
    const { data: joinedOrgs, error: joinedError } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('*')
      .eq('user_id', user.id)

    if (joinedError) {
      results.tests.user_joined_organizations = `❌ Error: ${joinedError.message} (code: ${joinedError.code})`
      results.tests.user_joined_organizations_hint = 'Table might not exist. Run the SQL from supabase_user_joined_orgs.sql'
    } else {
      results.tests.user_joined_organizations = `✅ Found ${joinedOrgs?.length || 0} joined orgs for this user`
      results.joinedOrgs = joinedOrgs
    }

    // 4. Test saved_organizations table
    const { data: savedOrgs, error: savedError } = await supabaseAdmin
      .from('saved_organizations')
      .select('*')
      .eq('user_id', user.id)

    if (savedError) {
      results.tests.saved_organizations = `❌ Error: ${savedError.message} (code: ${savedError.code})`
      results.tests.saved_organizations_hint = 'Table might not exist. Run the SQL from supabase_saved_organizations.sql'
    } else {
      results.tests.saved_organizations = `✅ Found ${savedOrgs?.length || 0} saved orgs for this user`
      results.savedOrgs = savedOrgs
    }

    // 5. Test user_queries table (for survey data)
    const { data: userQuery, error: userQueryError } = await supabaseAdmin
      .from('user_queries')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (userQueryError) {
      if (userQueryError.code === 'PGRST116') {
        results.tests.user_queries = '⚠️ No survey data for this user (take the survey first)'
      } else {
        results.tests.user_queries = `❌ Error: ${userQueryError.message}`
      }
    } else {
      results.tests.user_queries = `✅ Found survey data`
      results.hasSurveyData = true
    }

    // 6. Test if we can write to user_joined_organizations
    if (orgs && orgs.length > 0 && !joinedError) {
      const testOrgId = orgs[0].id
      
      // Check if already joined
      const { data: alreadyJoined } = await supabaseAdmin
        .from('user_joined_organizations')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', testOrgId)
        .single()

      if (alreadyJoined) {
        results.tests.write_test = `⚠️ Skipped - already joined "${orgs[0].name}"`
      } else {
        // Try to insert
        const { data: insertResult, error: insertError } = await supabaseAdmin
          .from('user_joined_organizations')
          .insert({ user_id: user.id, organization_id: testOrgId })
          .select()

        if (insertError) {
          results.tests.write_test = `❌ Insert failed: ${insertError.message}`
        } else {
          results.tests.write_test = `✅ Successfully inserted test join for "${orgs[0].name}"`
          results.insertedJoin = insertResult

          // Clean up - delete the test insert
          const { error: deleteError } = await supabaseAdmin
            .from('user_joined_organizations')
            .delete()
            .eq('user_id', user.id)
            .eq('organization_id', testOrgId)

          if (deleteError) {
            results.tests.cleanup = `❌ Cleanup failed: ${deleteError.message}`
          } else {
            results.tests.cleanup = '✅ Test data cleaned up'
          }
        }
      }
    }

    // 7. Check realtime publication
    const { data: publications, error: pubError } = await supabaseAdmin
      .rpc('check_realtime_tables', {})
      .maybeSingle()

    if (pubError) {
      results.tests.realtime = '⚠️ Could not check realtime status (normal if function not created)'
    } else {
      results.tests.realtime = publications
    }

    return NextResponse.json(results)
  } catch (error: any) {
    results.error = error.message
    return NextResponse.json(results, { status: 500 })
  }
}

