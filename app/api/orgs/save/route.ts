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
    const { organization_name, organization_bio, organization_website, organization_contact_info, organization_id } = body

    if (!organization_name || !organization_name.trim()) {
      return NextResponse.json(
        { error: 'Missing organization_name' },
        { status: 400 }
      )
    }

    // If organization_id is provided, verify it exists
    let orgId = organization_id || null
    if (orgId) {
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id, name, application_required')
        .eq('id', orgId)
        .single()

      if (orgError || !org) {
        orgId = null // Reset if org doesn't exist
      } else {
        // If org exists and doesn't require applications, auto-join instead of saving
        const appRequired = org.application_required?.toLowerCase().trim()
        if (!appRequired || appRequired === 'no' || appRequired === 'none' || appRequired === '') {
          // Check if already joined
          const { data: existingJoin } = await supabaseAdmin
            .from('user_joined_organizations')
            .select('id')
            .eq('user_id', user.id)
            .eq('organization_id', orgId)
            .single()

          if (!existingJoin) {
            // Auto-join
            const { data: joinData, error: joinError } = await supabaseAdmin
              .from('user_joined_organizations')
              .insert({
                user_id: user.id,
                organization_id: orgId
              })
              .select()
              .single()

            if (!joinError) {
              return NextResponse.json({ 
                success: true, 
                auto_joined: true,
                data: joinData 
              })
            }
          } else {
            return NextResponse.json(
              { error: 'Already joined this organization' },
              { status: 400 }
            )
          }
        }
      }
    } else {
      // Try to find organization by name (case-insensitive)
      const { data: matchingOrg } = await supabaseAdmin
        .from('organizations')
        .select('id, name, application_required')
        .ilike('name', organization_name.trim())
        .limit(1)
        .single()

      if (matchingOrg) {
        orgId = matchingOrg.id
        // If found and doesn't require applications, auto-join
        const appRequired = matchingOrg.application_required?.toLowerCase().trim()
        if (!appRequired || appRequired === 'no' || appRequired === 'none' || appRequired === '') {
          const { data: existingJoin } = await supabaseAdmin
            .from('user_joined_organizations')
            .select('id')
            .eq('user_id', user.id)
            .eq('organization_id', orgId)
            .single()

          if (!existingJoin) {
            const { data: joinData, error: joinError } = await supabaseAdmin
              .from('user_joined_organizations')
              .insert({
                user_id: user.id,
                organization_id: orgId
              })
              .select()
              .single()

            if (!joinError) {
              return NextResponse.json({ 
                success: true, 
                auto_joined: true,
                data: joinData 
              })
            }
          } else {
            return NextResponse.json(
              { error: 'Already joined this organization' },
              { status: 400 }
            )
          }
        }
      }
    }

    // Check if already saved (by name or org_id)
    const { data: existing } = await supabaseAdmin
      .from('saved_organizations')
      .select('id')
      .eq('user_id', user.id)
      .or(`organization_name.eq.${organization_name.trim()},organization_id.eq.${orgId || 'null'}`)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Already saved this organization' },
        { status: 400 }
      )
    }

    // Save the organization (with org_id if found)
    const { data, error } = await supabaseAdmin
      .from('saved_organizations')
      .insert({
        user_id: user.id,
        organization_id: orgId,
        organization_name: organization_name.trim(),
        organization_bio: organization_bio || null,
        organization_website: organization_website || null,
        organization_contact_info: organization_contact_info || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving organization:', error)
      return NextResponse.json(
        { error: 'Failed to save organization' },
        { status: 500 }
      )
    }

    // TODO: Send email notification when org joins platform
    // This will be implemented later when email service is set up

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Save org API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

