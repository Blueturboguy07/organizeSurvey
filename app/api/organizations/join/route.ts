import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { organizationId } = body

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Verify organization exists
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, application_required')
      .eq('id', organizationId)
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
      .eq('organization_id', organizationId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Already joined this organization' },
        { status: 400 }
      )
    }

    // Join organization
    const { data, error } = await supabaseAdmin
      .from('user_joined_organizations')
      .insert({
        user_id: user.id,
        organization_id: organizationId
      })
      .select()
      .single()

    if (error) {
      console.error('Error joining organization:', error)
      return NextResponse.json(
        { error: 'Failed to join organization', details: error.message },
        { status: 500 }
      )
    }

    // If user had saved this org, update the saved record
    await supabaseAdmin
      .from('saved_organizations')
      .update({ 
        organization_id: organizationId,
        saved_when_not_on_platform: false,
        auto_joined: false // Manual join, not auto
      })
      .eq('user_id', user.id)
      .or(`organization_id.eq.${organizationId},organization_name.ilike.${org.name}`)

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Join organization error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('user_joined_organizations')
      .delete()
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)

    if (error) {
      console.error('Error leaving organization:', error)
      return NextResponse.json(
        { error: 'Failed to leave organization', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Leave organization error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

