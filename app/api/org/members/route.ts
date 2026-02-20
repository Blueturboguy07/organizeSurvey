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
      .select('id, user_id, joined_at, role, title')
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
    let userProfiles: Record<string, { email: string; name: string; profile_picture_url: string | null }> = {}
    
    console.log('[Members API] Member user_ids:', userIds)
    
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, name, profile_picture_url')
        .in('id', userIds)
      
      if (profilesError) {
        console.error('[Members API] Error fetching profiles:', profilesError)
      }
      
      console.log('[Members API] Profiles found:', profiles?.length || 0, 'for', userIds.length, 'members')
      console.log('[Members API] Profile IDs returned:', profiles?.map(p => p.id))
      console.log('[Members API] Missing profiles for:', userIds.filter(id => !profiles?.some(p => p.id === id)))
      
      if (profiles) {
        userProfiles = profiles.reduce((acc, p) => {
          acc[p.id] = { email: p.email, name: p.name, profile_picture_url: p.profile_picture_url }
          return acc
        }, {} as Record<string, { email: string; name: string; profile_picture_url: string | null }>)
      }
    }

    // For any members missing profiles, try to get info from auth.users
    const missingProfileIds = userIds.filter(id => !userProfiles[id])
    if (missingProfileIds.length > 0) {
      console.log('[Members API] Fetching auth.users fallback for:', missingProfileIds)
      for (const userId of missingProfileIds) {
        try {
          const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId)
          if (authUser) {
            userProfiles[userId] = {
              email: authUser.email || '',
              name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Member',
              profile_picture_url: null
            }
            console.log('[Members API] Fallback found for', userId, ':', userProfiles[userId].name)
          }
        } catch (err) {
          console.error('[Members API] Fallback failed for', userId, err)
        }
      }
    }

    console.log('[Members API] Final member data:', memberships?.map(m => ({
      user_id: m.user_id,
      role: m.role,
      has_profile: !!userProfiles[m.user_id],
      profile_name: userProfiles[m.user_id]?.name
    })))

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
      profilePicture: (member.user_profiles as any)?.profile_picture_url || null,
      role: (member as any).role || 'member',
      title: (member as any).title || null,
      status: 'member' as const,
    })) || []
    
    console.log('Returning members:', formattedMembers.length)

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

// Update a member's role or title
export async function PATCH(request: Request) {
  try {
    const { membershipId, organizationId, role, title, grantDashboardAccess } = await request.json()

    if (!membershipId || !organizationId) {
      return NextResponse.json(
        { error: 'Membership ID and Organization ID are required' },
        { status: 400 }
      )
    }

    // Validate role if provided
    if (role && !['member', 'officer', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be member, officer, or admin' },
        { status: 400 }
      )
    }

    // Build update object
    const updateData: { role?: string; title?: string } = {}
    if (role !== undefined) updateData.role = role
    if (title !== undefined) updateData.title = title

    // Update the membership
    const { data: updatedMembership, error } = await supabaseAdmin
      .from('user_joined_organizations')
      .update(updateData)
      .eq('id', membershipId)
      .eq('organization_id', organizationId)
      .select('user_id, role')
      .single()

    if (error) {
      console.error('Error updating member:', error)
      return NextResponse.json(
        { error: 'Failed to update member' },
        { status: 500 }
      )
    }

    // Handle dashboard access for admin role
    if (role === 'admin' && grantDashboardAccess && updatedMembership) {
      // Grant dashboard access
      await supabaseAdmin
        .from('org_dashboard_access')
        .upsert({
          user_id: updatedMembership.user_id,
          organization_id: organizationId,
        }, { onConflict: 'user_id,organization_id' })
    } else if (role === 'member' && updatedMembership) {
      // Remove dashboard access when demoting to regular member
      await supabaseAdmin
        .from('org_dashboard_access')
        .delete()
        .eq('user_id', updatedMembership.user_id)
        .eq('organization_id', organizationId)
    }

    return NextResponse.json({ 
      success: true,
      member: updatedMembership 
    })

  } catch (error: any) {
    console.error('Update member error:', error)
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
