import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Get the user from auth header or session
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    } else {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    // Fetch saved organizations with full org details
    const { data, error } = await supabase
      .from('user_saved_organizations')
      .select(`
        id,
        saved_at,
        notified_at,
        auto_joined_at,
        organization_id,
        organizations (
          id,
          name,
          bio,
          website,
          typical_majors,
          typical_activities,
          club_culture_style,
          meeting_frequency,
          meeting_times,
          meeting_locations,
          dues_required,
          dues_cost,
          application_required,
          time_commitment,
          member_count,
          administrative_contact_info,
          is_on_platform,
          application_required_bool
        )
      `)
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })

    if (error) {
      console.error('Error fetching saved organizations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get org_accounts to determine which orgs are on platform
    const { data: orgAccounts } = await supabase
      .from('org_accounts')
      .select('organization_id, email_verified, is_active')
    
    const onPlatformOrgIds = new Set(
      (orgAccounts || [])
        .filter((acc: any) => acc.email_verified && acc.is_active)
        .map((acc: any) => acc.organization_id)
    )

    // Flatten the response and add is_on_platform based on org_accounts
    const savedOrgs = (data || []).map((item: any) => ({
      ...item.organizations,
      saved_at: item.saved_at,
      notified_at: item.notified_at,
      auto_joined_at: item.auto_joined_at,
      save_record_id: item.id,
      // Override is_on_platform based on org_accounts table
      is_on_platform: item.organizations?.id ? onPlatformOrgIds.has(item.organizations.id) : false
    }))

    return NextResponse.json({ organizations: savedOrgs })
  } catch (error: any) {
    console.error('Error in saved orgs API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

