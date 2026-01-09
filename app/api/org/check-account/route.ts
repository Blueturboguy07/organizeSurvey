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

    // Check if user exists in Supabase Auth
    let authUserExists = false
    let authUserConfirmed = false
    
    if (orgAccount.email) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
      const authUser = usersData?.users?.find(
        u => u.email?.toLowerCase() === orgAccount.email.toLowerCase()
      )
      if (authUser) {
        authUserExists = true
        // Check if email is confirmed (they clicked the link)
        authUserConfirmed = !!authUser.email_confirmed_at
        
        // ONLY sync email_verified status, NOT user_id
        // user_id is set only when they complete the password setup form
        if (authUserConfirmed && !orgAccount.email_verified) {
          await supabaseAdmin
            .from('org_accounts')
            .update({
              email_verified: true,
            })
            .eq('id', orgAccount.id)
        }
      }
    }

    // has_user (user_id set) means they completed the setup form including password
    // email_verified means they clicked the email link
    // If email_verified but !has_user → they need to complete setup (set password)
    return NextResponse.json({
      exists: true,
      email_verified: orgAccount.email_verified || authUserConfirmed,
      has_user: !!orgAccount.user_id,  // This is the key: only true after password setup
      auth_user_exists: authUserExists,
      auth_user_confirmed: authUserConfirmed,
      needs_password_setup: authUserConfirmed && !orgAccount.user_id,
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

