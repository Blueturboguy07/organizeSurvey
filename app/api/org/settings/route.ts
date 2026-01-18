import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

// GET: Fetch org settings
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

    // Get org account for this user
    const { data: orgAccount, error: orgAccountError } = await supabase
      .from('org_accounts')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    if (orgAccountError || !orgAccount) {
      return NextResponse.json({ error: 'Not an organization account' }, { status: 403 })
    }

    // Get organization settings
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, is_application_based')
      .eq('id', orgAccount.organization_id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({
      organization_id: org.id,
      name: org.name,
      is_application_based: org.is_application_based ?? false
    })

  } catch (error: any) {
    console.error('Get org settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update org settings
export async function PATCH(request: Request) {
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

    const body = await request.json()
    const { is_application_based } = body

    if (typeof is_application_based !== 'boolean') {
      return NextResponse.json({ error: 'is_application_based must be a boolean' }, { status: 400 })
    }

    // Get org account for this user
    const { data: orgAccount, error: orgAccountError } = await supabase
      .from('org_accounts')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    if (orgAccountError || !orgAccount) {
      return NextResponse.json({ error: 'Not an organization account' }, { status: 403 })
    }

    // Update organization settings
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ is_application_based })
      .eq('id', orgAccount.organization_id)

    if (updateError) {
      console.error('Update org settings error:', updateError)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      is_application_based
    })

  } catch (error: any) {
    console.error('Update org settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
