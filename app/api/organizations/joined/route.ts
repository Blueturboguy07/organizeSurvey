import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🔵 [API] GET /api/organizations/joined - Starting...')
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.log('🔵 [API] No auth header')
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('🔵 [API] Token present, length:', token.length)
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.log('🔵 [API] Auth error:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or expired session.' },
        { status: 401 }
      )
    }

    console.log('🔵 [API] User authenticated:', user.id, user.email)

    // Get joined organization IDs first
    console.log('🔵 [API] Querying user_joined_organizations...')
    const { data: joinedOrgs, error: joinedOrgsError } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('organization_id, joined_at')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })

    if (joinedOrgsError) {
      console.error('🔵 [API] Error fetching joined organizations:', joinedOrgsError)
      return NextResponse.json(
        { error: 'Failed to fetch joined organizations', details: joinedOrgsError.message },
        { status: 500 }
      )
    }

    console.log('🔵 [API] Joined orgs query result:', JSON.stringify(joinedOrgs))

    if (!joinedOrgs || joinedOrgs.length === 0) {
      console.log(`🔵 [API] No joined organizations found for user ${user.id}`)
      return NextResponse.json({ organizations: [], debug: { userId: user.id, joinedOrgsCount: 0 } })
    }

    // Get full organization details
    const orgIds = joinedOrgs.map((jo: any) => jo.organization_id).filter(Boolean)
    console.log('🔵 [API] Organization IDs to fetch:', orgIds)
    
    if (orgIds.length === 0) {
      console.log('🔵 [API] No valid org IDs after filtering')
      return NextResponse.json({ organizations: [], debug: { userId: user.id, orgIdsEmpty: true } })
    }

    console.log('🔵 [API] Querying organizations table...')
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .in('id', orgIds)

    if (orgsError) {
      console.error('🔵 [API] Error fetching organization details:', orgsError)
      return NextResponse.json(
        { error: 'Failed to fetch organization details', details: orgsError.message },
        { status: 500 }
      )
    }

    console.log('🔵 [API] Organizations found:', orgs?.length || 0)

    // Create a map of org_id -> joined_at
    const joinedAtMap = new Map(
      joinedOrgs.map((jo: any) => [jo.organization_id, jo.joined_at])
    )

    // Format the response
    const organizations = (orgs || []).map((org: any) => ({
      ...org,
      joined_at: joinedAtMap.get(org.id)
    }))

    console.log(`🔵 [API] Returning ${organizations.length} joined organizations for user ${user.id}`)
    return NextResponse.json({ 
      organizations,
      debug: { userId: user.id, joinedOrgsCount: joinedOrgs.length, orgsCount: organizations.length }
    })
  } catch (error: any) {
    console.error('Get joined organizations error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

