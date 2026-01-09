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

    // Check if user exists in Supabase Auth (they might have set up password already)
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
        
        // If auth user exists and is confirmed but org_accounts is out of sync, fix it
        if (authUserConfirmed && (!orgAccount.email_verified || !orgAccount.user_id)) {
          await supabaseAdmin
            .from('org_accounts')
            .update({
              user_id: authUser.id,
              email_verified: true,
              verification_token: null,
              verification_token_expires_at: null,
            })
            .eq('id', orgAccount.id)
          
          // Return updated status
          return NextResponse.json({
            exists: true,
            email_verified: true,
            has_user: true,
            auth_user_exists: true,
            email: maskEmail(orgAccount.email),
          })
        }
      }
    }

    return NextResponse.json({
      exists: true,
      email_verified: orgAccount.email_verified || false,
      has_user: !!orgAccount.user_id,
      auth_user_exists: authUserExists,
      auth_user_confirmed: authUserConfirmed,
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

