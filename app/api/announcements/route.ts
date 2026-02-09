import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET - Fetch announcements for the current student's joined orgs
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all orgs the user is a member of
    const { data: joinedOrgs, error: joinedError } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('organization_id')
      .eq('user_id', user.id)

    if (joinedError) {
      console.error('Error fetching joined orgs:', joinedError)
      return NextResponse.json({ error: 'Failed to fetch joined orgs' }, { status: 500 })
    }

    if (!joinedOrgs || joinedOrgs.length === 0) {
      return NextResponse.json({ announcements: [] })
    }

    const orgIds = joinedOrgs.map(o => o.organization_id)

    // Fetch announcements from those orgs, sorted by most recent
    const { data: announcements, error: annError } = await supabaseAdmin
      .from('org_announcements')
      .select('id, organization_id, title, body, created_at')
      .in('organization_id', orgIds)
      .order('created_at', { ascending: false })
      .limit(50)

    if (annError) {
      console.error('Error fetching announcements:', annError)
      return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
    }

    // Get org names
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .in('id', orgIds)

    const orgNameMap = new Map((orgs || []).map(o => [o.id, o.name]))

    // Attach org name to each announcement
    const enriched = (announcements || []).map(a => ({
      ...a,
      org_name: orgNameMap.get(a.organization_id) || 'Unknown Org'
    }))

    return NextResponse.json({ announcements: enriched })

  } catch (error: any) {
    console.error('Announcements fetch error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
