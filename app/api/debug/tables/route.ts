import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check if required tables exist
 * No auth required - just checks table structure
 */
export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tables: {}
  }

  try {
    // Check organizations table
    const { count: orgCount, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*', { count: 'exact', head: true })

    if (orgError) {
      results.tables.organizations = { exists: false, error: orgError.message }
    } else {
      results.tables.organizations = { exists: true, count: orgCount }
    }

    // Check user_joined_organizations table
    const { count: joinedCount, error: joinedError } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('*', { count: 'exact', head: true })

    if (joinedError) {
      results.tables.user_joined_organizations = { 
        exists: false, 
        error: joinedError.message,
        hint: 'Run SQL from supabase_user_joined_orgs.sql'
      }
    } else {
      results.tables.user_joined_organizations = { exists: true, count: joinedCount }
    }

    // Check saved_organizations table
    const { count: savedCount, error: savedError } = await supabaseAdmin
      .from('saved_organizations')
      .select('*', { count: 'exact', head: true })

    if (savedError) {
      results.tables.saved_organizations = { 
        exists: false, 
        error: savedError.message,
        hint: 'Run SQL from supabase_saved_organizations.sql'
      }
    } else {
      results.tables.saved_organizations = { exists: true, count: savedCount }
    }

    // Check user_queries table
    const { count: queriesCount, error: queriesError } = await supabaseAdmin
      .from('user_queries')
      .select('*', { count: 'exact', head: true })

    if (queriesError) {
      results.tables.user_queries = { exists: false, error: queriesError.message }
    } else {
      results.tables.user_queries = { exists: true, count: queriesCount }
    }

    // Summary
    const allExist = Object.values(results.tables).every((t: any) => t.exists)
    results.summary = allExist 
      ? '✅ All required tables exist'
      : '❌ Some tables are missing - check the hints above'

    return NextResponse.json(results)
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      hint: 'Check your Supabase environment variables'
    }, { status: 500 })
  }
}

