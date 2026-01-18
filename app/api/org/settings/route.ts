import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// GET: Fetch org settings
export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get org account for this user
    const { data: orgAccount, error: orgAccountError } = await supabase
      .from('org_accounts')
      .select('organization_id')
      .eq('user_id', user.id)
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
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      .eq('user_id', user.id)
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

