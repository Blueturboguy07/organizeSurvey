import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Check for pending invitations by email (public endpoint for registration form)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // First, expire any old invitations for this email
    await supabaseAdmin
      .from('org_invitations')
      .update({ status: 'expired' })
      .eq('email', email.toLowerCase().trim())
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())

    // Get all pending invitations for this email
    const { data: invitations, error } = await supabaseAdmin
      .from('org_invitations')
      .select(`
        id,
        name,
        status,
        expires_at,
        organization_id,
        organizations:organization_id (
          id,
          name
        )
      `)
      .eq('email', email.toLowerCase().trim())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())

    if (error) {
      console.error('Error fetching invitations:', error)
      return NextResponse.json(
        { error: 'Failed to check invitations' },
        { status: 500 }
      )
    }

    // Format response
    const formattedInvitations = invitations?.map(inv => ({
      id: inv.id,
      name: inv.name,
      organizationId: inv.organization_id,
      organizationName: (inv.organizations as any)?.name || 'Unknown Organization',
      expiresAt: inv.expires_at,
    })) || []

    return NextResponse.json({
      invitations: formattedInvitations,
      count: formattedInvitations.length,
    })

  } catch (error: any) {
    console.error('Check invitations error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
