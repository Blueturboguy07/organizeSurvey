import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or expired session.' },
        { status: 401 }
      )
    }

    // Get joined organization IDs first
    const { data: joinedOrgs, error: joinedOrgsError } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('organization_id, joined_at')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })

    if (joinedOrgsError) {
      console.error('Error fetching joined organizations:', joinedOrgsError)
      return NextResponse.json(
        { error: 'Failed to fetch joined organizations', details: joinedOrgsError.message },
        { status: 500 }
      )
    }

    if (!joinedOrgs || joinedOrgs.length === 0) {
      console.log(`No joined organizations found for user ${user.id}`)
      return NextResponse.json({ organizations: [] })
    }

    // Get full organization details
    const orgIds = joinedOrgs.map((jo: any) => jo.organization_id).filter(Boolean)
    
    if (orgIds.length === 0) {
      return NextResponse.json({ organizations: [] })
    }

    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .in('id', orgIds)

    if (orgsError) {
      console.error('Error fetching organization details:', orgsError)
      return NextResponse.json(
        { error: 'Failed to fetch organization details', details: orgsError.message },
        { status: 500 }
      )
    }

    // Create a map of org_id -> joined_at
    const joinedAtMap = new Map(
      joinedOrgs.map((jo: any) => [jo.organization_id, jo.joined_at])
    )

    // Format the response
    const organizations = (orgs || []).map((org: any) => ({
      ...org,
      joined_at: joinedAtMap.get(org.id)
    }))

    console.log(`Found ${organizations.length} joined organizations for user ${user.id}`)
    return NextResponse.json({ organizations })
  } catch (error: any) {
    console.error('Get joined organizations error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

