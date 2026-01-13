import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    validateEnvVars()
    
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

    // Get user's joined organizations with full org details
    const { data: joinedOrgs, error: joinedOrgsError } = await supabaseAdmin
      .from('user_joined_organizations')
      .select(`
        id,
        joined_at,
        organization_id,
        organizations (*)
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })

    if (joinedOrgsError) {
      console.error('Error fetching joined organizations:', joinedOrgsError)
      return NextResponse.json(
        { error: 'Failed to fetch joined organizations' },
        { status: 500 }
      )
    }

    // Format the response
    const formattedOrgs = (joinedOrgs || []).map((jo: any) => ({
      id: jo.id,
      joined_at: jo.joined_at,
      organization: jo.organizations
    }))

    return NextResponse.json({ joined_orgs: formattedOrgs })
  } catch (error: any) {
    console.error('Get joined orgs API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

