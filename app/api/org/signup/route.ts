import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { organizationId, organizationName, email, password } = await request.json()

    if (!organizationId || !email || !password) {
      return NextResponse.json(
        { error: 'Organization ID, email, and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if org account already exists with a user
    const { data: existingAccount } = await supabaseAdmin
      .from('org_accounts')
      .select('id, user_id')
      .eq('organization_id', organizationId)
      .single()

    if (existingAccount?.user_id) {
      return NextResponse.json(
        { error: 'This organization already has an account. Please sign in instead.' },
        { status: 400 }
      )
    }

    // Check if user already exists in auth with this email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === normalizedEmail)

    if (existingUser) {
      // User exists - check if already an org account
      if (existingUser.user_metadata?.is_org_account) {
        return NextResponse.json(
          { error: 'This email is already registered as an organization account' },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: 'This email is already registered. Please use a different email or contact support.' },
        { status: 400 }
      )
    }

    // Build the redirect URL for email verification
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    // Use regular Supabase client for signUp (this sends confirmation email automatically)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: password,
      options: {
        data: {
          is_org_account: true,
          organization_id: organizationId,
          organization_name: organizationName,
        },
        emailRedirectTo: `${baseUrl}/auth/callback?next=/org/dashboard`,
      }
    })

    if (signUpError) {
      console.error('SignUp error:', signUpError)
      return NextResponse.json(
        { error: signUpError.message || 'Failed to create account' },
        { status: 500 }
      )
    }

    if (!signUpData.user) {
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      )
    }

    // Create or update org account record
    if (existingAccount) {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from('org_accounts')
        .update({
          email: normalizedEmail,
          user_id: signUpData.user.id,
          email_verified: false,
        })
        .eq('id', existingAccount.id)

      if (updateError) {
        console.error('Error updating org account:', updateError)
      }
    } else {
      // Create new record
      const { error: insertError } = await supabaseAdmin
        .from('org_accounts')
        .insert({
          organization_id: organizationId,
          email: normalizedEmail,
          user_id: signUpData.user.id,
          email_verified: false,
        })

      if (insertError) {
        console.error('Error creating org account:', insertError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Account created. Please check your email to verify.',
    })

  } catch (error: any) {
    console.error('Org signup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

