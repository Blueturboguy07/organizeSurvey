import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { organizationId, password } = await request.json()

    if (!organizationId || !password) {
      return NextResponse.json(
        { error: 'Organization ID and password are required' },
        { status: 400 }
      )
    }

    // Get org account email using admin client (bypasses RLS)
    const { data: orgAccount, error: fetchError } = await supabaseAdmin
      .from('org_accounts')
      .select('email, user_id, email_verified')
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !orgAccount) {
      return NextResponse.json(
        { error: 'Organization account not found' },
        { status: 404 }
      )
    }

    if (!orgAccount.user_id) {
      return NextResponse.json(
        { error: 'Account setup not complete. Please sign up first.' },
        { status: 400 }
      )
    }

    if (!orgAccount.email_verified) {
      return NextResponse.json(
        { error: 'Please verify your email before signing in.' },
        { status: 400 }
      )
    }

    // Return the email so client can sign in
    return NextResponse.json({
      success: true,
      email: orgAccount.email,
    })

  } catch (error: any) {
    console.error('Org login error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

