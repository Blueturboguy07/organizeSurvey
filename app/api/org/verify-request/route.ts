import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const { organizationId, organizationName, email } = await request.json()

    if (!organizationId || !email) {
      return NextResponse.json(
        { error: 'Organization ID and email are required' },
        { status: 400 }
      )
    }

    // Check if org account already exists
    const { data: existingAccount } = await supabaseAdmin
      .from('org_accounts')
      .select('id')
      .eq('organization_id', organizationId)
      .single()

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Organization account already exists' },
        { status: 400 }
      )
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create pending org account with verification token
    const { error: insertError } = await supabaseAdmin
      .from('org_accounts')
      .insert({
        organization_id: organizationId,
        email: email.toLowerCase().trim(),
        verification_token: verificationToken,
        verification_token_expires_at: expiresAt.toISOString(),
        email_verified: false,
      })

    if (insertError) {
      console.error('Error creating org account:', insertError)
      return NextResponse.json(
        { error: 'Failed to create organization account' },
        { status: 500 }
      )
    }

    // Build verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000'
    const verificationUrl = `${baseUrl}/org/verify?token=${verificationToken}`

    // Send verification email via Supabase
    // Using Supabase's built-in email function or a custom solution
    // For now, we'll use Supabase Auth's magic link as a workaround
    // Or you could integrate with SendGrid/Resend/etc.
    
    // Option: Use Supabase Auth to create a user and send magic link
    const { error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      email_confirm: false,
      user_metadata: {
        is_org_account: true,
        organization_id: organizationId,
        organization_name: organizationName,
        verification_token: verificationToken,
      }
    })

    if (authError && !authError.message.includes('already been registered')) {
      console.error('Error creating auth user:', authError)
      // Clean up the org account we just created
      await supabaseAdmin
        .from('org_accounts')
        .delete()
        .eq('organization_id', organizationId)
      
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      )
    }

    // If user already exists, they may have registered as a student
    // We need to handle this case
    if (authError?.message.includes('already been registered')) {
      // Check if this user is already an org account
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
      const user = existingUser.users.find(u => u.email === email.toLowerCase().trim())
      
      if (user?.user_metadata?.is_org_account) {
        return NextResponse.json(
          { error: 'This email is already registered as an organization account' },
          { status: 400 }
        )
      }
      
      // User exists but not as org - send password reset instead
      const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email.toLowerCase().trim(),
        options: {
          redirectTo: `${baseUrl}/org/setup?token=${verificationToken}`,
        }
      })
      
      if (resetError) {
        console.error('Error generating recovery link:', resetError)
      }
    }

    // Generate and send invite link for new org users
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email.toLowerCase().trim(),
      options: {
        redirectTo: `${baseUrl}/org/setup?token=${verificationToken}`,
      }
    })

    if (inviteError && !inviteError.message.includes('already been registered')) {
      console.error('Error generating invite link:', inviteError)
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent',
    })

  } catch (error: any) {
    console.error('Org verification request error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

