import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { organizationId } = await request.json()

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Check if org account exists using admin client (bypasses RLS)
    const { data: orgAccount, error } = await supabaseAdmin
      .from('org_accounts')
      .select('id, email, email_verified, user_id')
      .eq('organization_id', organizationId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (account doesn't exist)
      console.error('Error checking org account:', error)
      return NextResponse.json(
        { error: 'Failed to check organization account' },
        { status: 500 }
      )
    }

    if (!orgAccount) {
      return NextResponse.json({
        exists: false,
        email_verified: false,
        has_user: false,
        email: null,
      })
    }

    // Mask the email for privacy
    let maskedEmail = null
    if (orgAccount.email) {
      const [localPart, domain] = orgAccount.email.split('@')
      maskedEmail = localPart.slice(0, 2) + '***@' + domain
    }

    return NextResponse.json({
      exists: true,
      email_verified: orgAccount.email_verified || false,
      has_user: !!orgAccount.user_id,
      email: maskedEmail,
    })

  } catch (error: any) {
    console.error('Check org account error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

