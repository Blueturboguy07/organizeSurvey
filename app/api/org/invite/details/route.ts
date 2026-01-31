import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Get invitation details by token (public endpoint for pre-filling registration form)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Invite token is required' },
        { status: 400 }
      )
    }

    // Get the invitation with organization details
    const { data: invitation, error } = await supabaseAdmin
      .from('org_invitations')
      .select(`
        id,
        email,
        name,
        status,
        expires_at,
        organization_id,
        organizations:organization_id (
          id,
          name
        )
      `)
      .eq('invite_token', token)
      .single()

    if (error || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'This invitation has already been used or cancelled', status: invitation.status },
        { status: 400 }
      )
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        organizationId: invitation.organization_id,
      },
      organizationName: (invitation.organizations as any)?.name || 'Unknown Organization',
    })

  } catch (error: any) {
    console.error('Get invite details error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
