import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

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

    // Check if user is already a member (by checking if their email exists in profiles and is joined)
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (existingProfile) {
      const { data: existingMember } = await supabaseAdmin
        .from('user_joined_organizations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', existingProfile.id)
        .single()

      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 400 }
        )
      }
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
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

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

    // Send invitation email via Resend
    const registerUrl = 'https://organizecampus.com/register'
    let emailSent = false
    
    try {
      const { error: emailError } = await resend.emails.send({
        from: 'ORGanize Campus <noreply@organizecampus.com>',
        to: email.toLowerCase().trim(),
        subject: `You've been invited to join ${organization.name} on ORGanize Campus`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #500000 0%, #732222 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">ORGanize Campus</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #333; margin-top: 0;">You've been invited!</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                ${name ? `Hi ${name},` : 'Hi there,'}<br><br>
                <strong>${organization.name}</strong> has invited you to join their organization on ORGanize Campus.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${registerUrl}" style="background: #500000; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Create Your Account
                </a>
              </div>
              <p style="color: #666; font-size: 14px; line-height: 1.6;">
                Simply sign up with this email address (<strong>${email.toLowerCase().trim()}</strong>) and you'll automatically be added to ${organization.name}.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">
                This invitation expires in 30 days. If you didn't expect this email, you can safely ignore it.
              </p>
            </div>
          </div>
        `,
      })

      if (emailError) {
        console.error('Error sending invite email:', emailError)
      } else {
        emailSent = true
      }
    } catch (emailErr) {
      console.error('Failed to send email:', emailErr)
      // Don't fail the whole request - invite is still created
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
      emailSent,
      message: emailSent 
        ? `Invitation email sent to ${invitation.email}` 
        : `Invitation created for ${invitation.email}. Email could not be sent - they can still sign up at organizecampus.com/register`,
      registerUrl,
    })

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
