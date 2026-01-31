import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

// Get pending invitations for the current user
export async function GET(request: Request) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // Verify the token and get user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First, expire any old invitations
    await supabaseAdmin
      .from('org_invitations')
      .update({ status: 'expired' })
      .eq('email', user.email.toLowerCase())
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())

    // Get all pending invitations for this user's email
    const { data: invitations, error } = await supabaseAdmin
      .from('org_invitations')
      .select(`
        id,
        email,
        name,
        status,
        created_at,
        expires_at,
        organization_id,
        organizations:organization_id (
          id,
          name,
          bio,
          club_type
        )
      `)
      .eq('email', user.email.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user invitations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      )
    }

    // Format response
    const formattedInvitations = invitations?.map(inv => ({
      id: inv.id,
      organizationId: inv.organization_id,
      organizationName: (inv.organizations as any)?.name || 'Unknown Organization',
      organizationBio: (inv.organizations as any)?.bio || null,
      organizationType: (inv.organizations as any)?.club_type || null,
      invitedAs: inv.name,
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
    })) || []

    return NextResponse.json({
      invitations: formattedInvitations,
      count: formattedInvitations.length,
    })

  } catch (error: any) {
    console.error('Get user invitations error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Accept or decline an invitation
export async function POST(request: Request) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // Verify the token and get user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { invitationId, action } = await request.json()

    if (!invitationId || !action) {
      return NextResponse.json(
        { error: 'Invitation ID and action are required' },
        { status: 400 }
      )
    }

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "accept" or "decline"' },
        { status: 400 }
      )
    }

    // Get the invitation
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from('org_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('email', user.email?.toLowerCase())
      .eq('status', 'pending')
      .single()

    if (fetchError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found or not for this user' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseAdmin
        .from('org_invitations')
        .update({ status: 'expired' })
        .eq('id', invitationId)
      
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 }
      )
    }

    if (action === 'accept') {
      // Check if already a member
      const { data: existingMembership } = await supabaseAdmin
        .from('user_joined_organizations')
        .select('id')
        .eq('organization_id', invitation.organization_id)
        .eq('user_id', user.id)
        .single()

      if (!existingMembership) {
        // Add user to organization
        const { error: joinError } = await supabaseAdmin
          .from('user_joined_organizations')
          .insert({
            user_id: user.id,
            organization_id: invitation.organization_id,
          })

        if (joinError) {
          console.error('Error joining organization:', joinError)
          return NextResponse.json(
            { error: 'Failed to join organization' },
            { status: 500 }
          )
        }
      }

      // Update invitation status
      await supabaseAdmin
        .from('org_invitations')
        .update({
          status: 'accepted',
          accepted_by_user_id: user.id,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitationId)

      return NextResponse.json({
        success: true,
        message: 'Successfully joined the organization',
        action: 'accepted',
      })
    } else {
      // Decline - just update status
      await supabaseAdmin
        .from('org_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId)

      return NextResponse.json({
        success: true,
        message: 'Invitation declined',
        action: 'declined',
      })
    }

  } catch (error: any) {
    console.error('Respond to invitation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
