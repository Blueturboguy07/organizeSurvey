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
    const { organizationId, organizationName } = body

    if (!organizationName) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      )
    }

    // Check if organization exists on platform
    let orgExists = false
    let orgId = organizationId || null
    
    if (organizationId) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id, name, application_required')
        .eq('id', organizationId)
        .single()
      
      if (org) {
        orgExists = true
        orgId = org.id
      }
    } else {
      // Check by name
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id, name, application_required')
        .ilike('name', organizationName)
        .limit(1)
        .single()
      
      if (org) {
        orgExists = true
        orgId = org.id
      }
    }

    // Check if already saved
    let query = supabaseAdmin
      .from('saved_organizations')
      .select('id')
      .eq('user_id', user.id)
    
    if (orgId) {
      query = query.or(`organization_id.eq.${orgId},organization_name.ilike.${organizationName}`)
    } else {
      query = query.ilike('organization_name', organizationName)
    }
    
    const { data: existing } = await query.limit(1).maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Organization already saved' },
        { status: 400 }
      )
    }

    // Save organization
    const { data, error } = await supabaseAdmin
      .from('saved_organizations')
      .insert({
        user_id: user.id,
        organization_id: orgId,
        organization_name: organizationName,
        saved_when_not_on_platform: !orgExists,
        notify_when_available: !orgExists, // Only notify if org not on platform
        auto_joined: false
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving organization:', error)
      return NextResponse.json(
        { error: 'Failed to save organization', details: error.message },
        { status: 500 }
      )
    }

    // If org exists and is non-application based, auto-join
    let autoJoined = false
    if (orgExists && orgId) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('application_required')
        .eq('id', orgId)
        .single()

      const isNonApplicationBased = !org?.application_required || 
        ['no', 'none', 'n/a', ''].includes(String(org.application_required).toLowerCase())

      if (isNonApplicationBased) {
        // Check if already joined
        const { data: existingJoin } = await supabaseAdmin
          .from('user_joined_organizations')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', orgId)
          .single()

        if (!existingJoin) {
          // Auto-join
          await supabaseAdmin
            .from('user_joined_organizations')
            .insert({
              user_id: user.id,
              organization_id: orgId
            })
            .select()
            .single()

          // Update saved org to mark as auto-joined
          await supabaseAdmin
            .from('saved_organizations')
            .update({ auto_joined: true })
            .eq('id', data.id)
          
          autoJoined = true
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      data,
      autoJoined
    })
  } catch (error: any) {
    console.error('Save organization error:', error)
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
    const organizationName = searchParams.get('organizationName')

    if (!organizationId && !organizationName) {
      return NextResponse.json(
        { error: 'Organization ID or name is required' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabaseAdmin
      .from('saved_organizations')
      .delete()
      .eq('user_id', user.id)

    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    } else {
      query = query.ilike('organization_name', organizationName!)
    }

    const { error } = await query

    if (error) {
      console.error('Error unsaving organization:', error)
      return NextResponse.json(
        { error: 'Failed to unsave organization', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unsave organization error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

