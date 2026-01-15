import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('🟣 [API] POST /api/organizations/join - Starting...')
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.log('🟣 [API] No auth header')
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
      console.log('🟣 [API] Auth error:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or expired session.' },
        { status: 401 }
      )
    }

    console.log('🟣 [API] User authenticated:', user.id, user.email)

    const body = await request.json()
    const { organizationId } = body
    console.log('🟣 [API] Organization ID:', organizationId)

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Verify organization exists
    console.log('🟣 [API] Verifying organization exists...')
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, application_required')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      console.log('🟣 [API] Organization not found:', orgError?.message)
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    console.log('🟣 [API] Organization found:', org.name)

    // Check if already joined
    const { data: existing } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single()

    if (existing) {
      console.log('🟣 [API] Already joined')
      return NextResponse.json(
        { error: 'Already joined this organization' },
        { status: 400 }
      )
    }

    // Join organization
    console.log('🟣 [API] Inserting into user_joined_organizations...')
    const { data, error } = await supabaseAdmin
      .from('user_joined_organizations')
      .insert({
        user_id: user.id,
        organization_id: organizationId
      })
      .select()
      .single()

    if (error) {
      console.error('🟣 [API] Error joining organization:', error)
      return NextResponse.json(
        { error: 'Failed to join organization', details: error.message },
        { status: 500 }
      )
    }

    console.log('🟣 [API] Successfully joined! Insert result:', JSON.stringify(data))

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

    console.log('🟣 [API] Returning success')
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
    console.log('🟣 [API] DELETE /api/organizations/join - Starting...')
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.log('🟣 [API] No auth header')
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
      console.log('🟣 [API] Auth error:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or expired session.' },
        { status: 401 }
      )
    }

    console.log('🟣 [API] User authenticated:', user.id, user.email)

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    console.log('🟣 [API] Organization ID to leave:', organizationId)

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // First check if the record exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('id, user_id, organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single()

    console.log('🟣 [API] Existing record check:', existing, 'Error:', checkError?.message)

    if (!existing) {
      console.log('🟣 [API] No record found to delete - user may not have joined this org')
      return NextResponse.json(
        { error: 'You have not joined this organization', notJoined: true },
        { status: 400 }
      )
    }

    // Delete using the record ID for certainty
    console.log('🟣 [API] Deleting record ID:', existing.id)
    const { data: deleteResult, error: deleteError } = await supabaseAdmin
      .from('user_joined_organizations')
      .delete()
      .eq('id', existing.id)
      .select()

    console.log('🟣 [API] Delete result:', deleteResult, 'Error:', deleteError?.message)

    if (deleteError) {
      console.error('🟣 [API] Error leaving organization:', deleteError)
      return NextResponse.json(
        { error: 'Failed to leave organization', details: deleteError.message },
        { status: 500 }
      )
    }

    // Verify deletion
    const { data: verifyData } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single()

    if (verifyData) {
      console.error('🟣 [API] CRITICAL: Record still exists after delete!')
      return NextResponse.json(
        { error: 'Delete operation failed - record still exists', debug: { existing, deleteResult, verifyData } },
        { status: 500 }
      )
    }

    console.log('🟣 [API] Successfully left organization')
    return NextResponse.json({ success: true, deleted: existing })
  } catch (error: any) {
    console.error('🟣 [API] Leave organization error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

