import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Get all members of the organization
    const { data: memberships, error: membersError } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('id, user_id, joined_at')
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: false })

    if (membersError) {
      console.error('Error fetching members:', membersError)
      return NextResponse.json(
        { error: 'Failed to fetch members: ' + membersError.message },
        { status: 500 }
      )
    }

    // Get user profiles for all members
    const userIds = memberships?.map(m => m.user_id) || []
    let userProfiles: Record<string, { email: string; name: string }> = {}
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, name')
        .in('id', userIds)
      
      if (profiles) {
        userProfiles = profiles.reduce((acc, p) => {
          acc[p.id] = { email: p.email, name: p.name }
          return acc
        }, {} as Record<string, { email: string; name: string }>)
      }
    }

    // Combine memberships with profiles
    const members = memberships?.map(m => ({
      ...m,
      user_profiles: userProfiles[m.user_id] || null
    })) || []

    // Get pending invitations (table may not exist yet)
    let invitations: any[] = []
    try {
      const { data: invitationsData, error: invitationsError } = await supabaseAdmin
        .from('org_invitations')
        .select('id, email, name, status, created_at, expires_at')
        .eq('organization_id', organizationId)
        .in('status', ['pending'])
        .order('created_at', { ascending: false })

      if (invitationsError) {
        // Table might not exist yet - this is okay
        console.log('Note: org_invitations query failed (table may not exist):', invitationsError.message)
      } else {
        invitations = invitationsData || []
      }
    } catch (inviteErr) {
      // Silently handle if table doesn't exist
      console.log('Note: org_invitations table may not exist yet')
    }

    // Format the response
    const formattedMembers = members?.map(member => ({
      id: member.id,
      userId: member.user_id,
      joinedAt: member.joined_at,
      email: (member.user_profiles as any)?.email || 'Unknown',
      name: (member.user_profiles as any)?.name || 'Unknown',
      status: 'member' as const,
    })) || []

    const formattedInvitations = invitations.map(invite => ({
      id: invite.id,
      email: invite.email,
      name: invite.name,
      status: invite.status as 'pending',
      createdAt: invite.created_at,
      expiresAt: invite.expires_at,
    }))

    return NextResponse.json({
      members: formattedMembers,
      invitations: formattedInvitations,
      totalMembers: formattedMembers.length,
      pendingInvitations: formattedInvitations.length,
    })

  } catch (error: any) {
    console.error('Get members error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Remove a member from the organization
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const membershipId = searchParams.get('membershipId')
    const organizationId = searchParams.get('organizationId')

    if (!membershipId || !organizationId) {
      return NextResponse.json(
        { error: 'Membership ID and Organization ID are required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('user_joined_organizations')
      .delete()
      .eq('id', membershipId)
      .eq('organization_id', organizationId)

    if (error) {
      console.error('Error removing member:', error)
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Remove member error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
