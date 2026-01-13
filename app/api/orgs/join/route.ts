import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { organization_id } = body

    if (!organization_id) {
      return NextResponse.json(
        { error: 'Missing organization_id' },
        { status: 400 }
      )
    }

    // Check if organization exists
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, application_required')
      .eq('id', organization_id)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Check if already joined
    const { data: existing } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Already joined this organization' },
        { status: 400 }
      )
    }

    // Join the organization
    const { data, error } = await supabaseAdmin
      .from('user_joined_organizations')
      .insert({
        user_id: user.id,
        organization_id: organization_id
      })
      .select()
      .single()

    if (error) {
      console.error('Error joining organization:', error)
      return NextResponse.json(
        { error: 'Failed to join organization' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Join org API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

