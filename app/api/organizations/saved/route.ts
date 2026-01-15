import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🟢 [API] GET /api/organizations/saved - Starting...')
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.log('🟢 [API] No auth header')
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('🟢 [API] Token present, length:', token.length)
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.log('🟢 [API] Auth error:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or expired session.' },
        { status: 401 }
      )
    }

    console.log('🟢 [API] User authenticated:', user.id, user.email)

    // Get saved organizations
    console.log('🟢 [API] Querying saved_organizations...')
    const { data: savedOrgs, error: savedOrgsError } = await supabaseAdmin
      .from('saved_organizations')
      .select(`
        id,
        organization_id,
        organization_name,
        saved_when_not_on_platform,
        notify_when_available,
        auto_joined,
        saved_at
      `)
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })

    if (savedOrgsError) {
      console.error('🟢 [API] Error fetching saved organizations:', savedOrgsError)
      return NextResponse.json(
        { error: 'Failed to fetch saved organizations', details: savedOrgsError.message },
        { status: 500 }
      )
    }

    console.log('🟢 [API] Saved orgs query result:', JSON.stringify(savedOrgs))

    if (!savedOrgs || savedOrgs.length === 0) {
      console.log(`🟢 [API] No saved organizations found for user ${user.id}`)
      return NextResponse.json({ organizations: [], debug: { userId: user.id, savedOrgsCount: 0 } })
    }

    console.log(`🟢 [API] Found ${savedOrgs.length} saved organizations for user ${user.id}`)

    // Get organization details for orgs that are on platform
    const orgIds = savedOrgs
      .map((so: any) => so.organization_id)
      .filter((id: string | null) => id !== null)

    let orgsMap = new Map()
    if (orgIds.length > 0) {
      const { data: orgs } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .in('id', orgIds)

      if (orgs) {
        orgsMap = new Map(orgs.map((org: any) => [org.id, org]))
      }
    }

    // Format the response - include org details if available, otherwise just name
    const organizations = savedOrgs.map((so: any) => {
      const orgDetails = so.organization_id ? orgsMap.get(so.organization_id) : null
      return {
        id: so.organization_id || `saved-${so.id}`,
        name: so.organization_name,
        ...(orgDetails || {}),
        saved_when_not_on_platform: so.saved_when_not_on_platform,
        notify_when_available: so.notify_when_available,
        auto_joined: so.auto_joined,
        saved_at: so.saved_at,
        is_on_platform: !!so.organization_id
      }
    })

    console.log('🟢 [API] Returning', organizations.length, 'saved organizations')
    return NextResponse.json({ 
      organizations,
      debug: { userId: user.id, savedOrgsCount: savedOrgs.length, returnedCount: organizations.length }
    })
  } catch (error: any) {
    console.error('🟢 [API] Get saved organizations error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

