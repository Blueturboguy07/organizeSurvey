import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    
    // Verify the user token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Get dashboard access for this user
    const { data: dashboardAccess, error: accessError } = await supabaseAdmin
      .from('org_dashboard_access')
      .select('organization_id')
      .eq('user_id', user.id)

    if (accessError) {
      // Table might not exist yet
      console.log('Dashboard access table may not exist:', accessError.message)
      return NextResponse.json({ orgs: [] })
    }

    if (!dashboardAccess || dashboardAccess.length === 0) {
      return NextResponse.json({ orgs: [] })
    }

    const orgIds = dashboardAccess.map(a => a.organization_id)

    // Get organization details
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .in('id', orgIds)

    if (orgsError) {
      console.error('Error fetching orgs:', orgsError)
      return NextResponse.json({ orgs: [] })
    }

    // Get member details (role and title) for each org
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('organization_id, role, title')
      .eq('user_id', user.id)
      .in('organization_id', orgIds)

    if (membershipError) {
      console.error('Error fetching memberships:', membershipError)
    }

    // Combine the data
    const result = orgs?.map(org => {
      const membership = memberships?.find(m => m.organization_id === org.id)
      return {
        id: org.id,
        name: org.name,
        role: membership?.role || 'admin',
        title: membership?.title || null,
      }
    }) || []

    return NextResponse.json({ orgs: result })

  } catch (error: any) {
    console.error('Admin orgs error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
