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

    // Fetch joined organizations with full org details
    const { data, error } = await supabase
      .from('user_joined_organizations')
      .select(`
        id,
        joined_at,
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
      .order('joined_at', { ascending: false })

    if (error) {
      console.error('Error fetching joined organizations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Flatten the response to include org details at top level
    const joinedOrgs = (data || []).map((item: any) => ({
      ...item.organizations,
      joined_at: item.joined_at,
      join_record_id: item.id
    }))

    return NextResponse.json({ organizations: joinedOrgs })
  } catch (error: any) {
    console.error('Error in joined orgs API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

