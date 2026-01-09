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
        auth_user_exists: false,
        email: null,
      })
    }

    // has_user (user_id set) means they completed the setup form including password
    // If !has_user → they need to complete setup (set password)
    return NextResponse.json({
      exists: true,
      email_verified: orgAccount.email_verified || false,
      has_user: !!orgAccount.user_id,  // This is the key: only true after password setup
      needs_password_setup: !orgAccount.user_id,  // No user_id means they need to set password
      email: maskEmail(orgAccount.email),
    })

  } catch (error: any) {
    console.error('Check org account error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

function maskEmail(email: string | null): string | null {
  if (!email) return null
  const [localPart, domain] = email.split('@')
  return localPart.slice(0, 2) + '***@' + domain
}

