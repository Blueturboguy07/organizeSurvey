import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const { email, name, organizationId } = await request.json()

    if (!email || !organizationId) {
      return NextResponse.json(
        { error: 'Email and organization ID are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Get organization details
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .single()

    if (orgError || !organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', (
        await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('email', email.toLowerCase().trim())
          .single()
      ).data?.id || '')
      .single()

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 400 }
      )
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from('org_invitations')
      .select('id, expires_at')
      .eq('organization_id', organizationId)
      .eq('email', email.toLowerCase().trim())
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      // Check if invitation is still valid
      if (new Date(existingInvite.expires_at) > new Date()) {
        return NextResponse.json(
          { error: 'An invitation has already been sent to this email. Please wait for it to expire or cancel it first.' },
          { status: 400 }
        )
      } else {
        // Mark expired invitation
        await supabaseAdmin
          .from('org_invitations')
          .update({ status: 'expired' })
          .eq('id', existingInvite.id)
      }
    }

    // Generate unique invite token
    const inviteToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('org_invitations')
      .insert({
        organization_id: organizationId,
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        invite_token: inviteToken,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invitation:', inviteError)
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      )
    }

    // Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const inviteUrl = `${baseUrl}/register?invite=${inviteToken}`

    // Check if user already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email.toLowerCase().trim())

    if (existingUser) {
      // User already has an account - send email notification about the invite
      // They can accept by logging in
      const { error: emailError } = await supabaseAdmin.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        {
          redirectTo: `${baseUrl}/dashboard?acceptInvite=${inviteToken}`,
        }
      )

      if (emailError) {
        console.error('Error sending notification email:', emailError)
        // Don't fail the whole request, invite is still created
      }

      return NextResponse.json({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          name: invitation.name,
          status: invitation.status,
          expires_at: invitation.expires_at,
        },
        message: 'Invitation created. User already has an account - they will see the invite when they log in.',
        userExists: true,
      })
    } else {
      // New user - send invite email
      const { error: inviteEmailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email.toLowerCase().trim(),
        {
          data: {
            invited_to_org: organizationId,
            invite_token: inviteToken,
            org_name: organization.name,
            invited_name: name?.trim() || undefined,
          },
          redirectTo: inviteUrl,
        }
      )

      if (inviteEmailError) {
        console.error('Error sending invite email:', inviteEmailError)
        // Clean up the invitation if email fails
        await supabaseAdmin
          .from('org_invitations')
          .delete()
          .eq('id', invitation.id)
        
        return NextResponse.json(
          { error: 'Failed to send invitation email: ' + inviteEmailError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          name: invitation.name,
          status: invitation.status,
          expires_at: invitation.expires_at,
        },
        message: 'Invitation email sent successfully.',
        userExists: false,
      })
    }

  } catch (error: any) {
    console.error('Invite member error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Cancel an invitation
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('id')

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('org_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId)

    if (error) {
      console.error('Error cancelling invitation:', error)
      return NextResponse.json(
        { error: 'Failed to cancel invitation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Cancel invitation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
