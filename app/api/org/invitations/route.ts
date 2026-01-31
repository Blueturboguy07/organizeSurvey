import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Get all invitations for an organization
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const status = searchParams.get('status') // optional filter

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // First, expire any old invitations
    await supabaseAdmin
      .from('org_invitations')
      .update({ status: 'expired' })
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())

    // Build query
    let query = supabaseAdmin
      .from('org_invitations')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: invitations, error } = await query

    if (error) {
      console.error('Error fetching invitations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      invitations: invitations || [],
      total: invitations?.length || 0,
    })

  } catch (error: any) {
    console.error('Get invitations error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Resend an invitation
export async function POST(request: Request) {
  try {
    const { invitationId } = await request.json()

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      )
    }

    // Get the invitation
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from('org_invitations')
      .select('*, organizations:organization_id(name)')
      .eq('id', invitationId)
      .single()

    if (fetchError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only resend pending invitations' },
        { status: 400 }
      )
    }

    // Update expiration date
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    
    await supabaseAdmin
      .from('org_invitations')
      .update({ expires_at: newExpiresAt.toISOString() })
      .eq('id', invitationId)

    // Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const inviteUrl = `${baseUrl}/register?invite=${invitation.invite_token}`

    // Resend the invite email
    const { error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      invitation.email,
      {
        data: {
          invited_to_org: invitation.organization_id,
          invite_token: invitation.invite_token,
          org_name: (invitation.organizations as any)?.name,
        },
        redirectTo: inviteUrl,
      }
    )

    if (emailError) {
      console.error('Error resending invite email:', emailError)
      return NextResponse.json(
        { error: 'Failed to resend invitation email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation resent successfully',
    })

  } catch (error: any) {
    console.error('Resend invitation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Accept an invitation (called during registration or from dashboard)
export async function PUT(request: Request) {
  try {
    const { inviteToken, userId } = await request.json()

    if (!inviteToken || !userId) {
      return NextResponse.json(
        { error: 'Invite token and user ID are required' },
        { status: 400 }
      )
    }

    // Get the invitation
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from('org_invitations')
      .select('*')
      .eq('invite_token', inviteToken)
      .single()

    if (fetchError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      )
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'This invitation has already been used or cancelled' },
        { status: 400 }
      )
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseAdmin
        .from('org_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)
      
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 }
      )
    }

    // Check if user is already a member
    const { data: existingMembership } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('id')
      .eq('organization_id', invitation.organization_id)
      .eq('user_id', userId)
      .single()

    if (existingMembership) {
      // User is already a member, just mark invitation as accepted
      await supabaseAdmin
        .from('org_invitations')
        .update({
          status: 'accepted',
          accepted_by_user_id: userId,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id)

      return NextResponse.json({
        success: true,
        message: 'Already a member of this organization',
        alreadyMember: true,
      })
    }

    // Add user to organization
    const { error: joinError } = await supabaseAdmin
      .from('user_joined_organizations')
      .insert({
        user_id: userId,
        organization_id: invitation.organization_id,
      })

    if (joinError) {
      console.error('Error adding user to organization:', joinError)
      return NextResponse.json(
        { error: 'Failed to add user to organization' },
        { status: 500 }
      )
    }

    // Update invitation status
    const { error: updateError } = await supabaseAdmin
      .from('org_invitations')
      .update({
        status: 'accepted',
        accepted_by_user_id: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)

    if (updateError) {
      console.error('Error updating invitation status:', updateError)
      // Don't fail - user was already added to org
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the organization',
      organizationId: invitation.organization_id,
    })

  } catch (error: any) {
    console.error('Accept invitation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
