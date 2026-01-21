import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Validate TAMU email
    const tamuEmailRegex = /^[a-zA-Z0-9._%+-]+@(tamu\.edu|email\.tamu\.edu)$/i
    if (!tamuEmailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please use a valid Texas A&M University email address (@tamu.edu or @email.tamu.edu)' },
        { status: 400 }
      )
    }

    // Validate password strength
    const hasLength = password.length >= 8
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)

    if (!hasLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
      return NextResponse.json(
        { error: 'Password does not meet all requirements' },
        { status: 400 }
      )
    }

    // Check if user already exists in auth with this email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === normalizedEmail)

    if (existingUser) {
      // Check if user is verified (has confirmed their email)
      const isVerified = !!existingUser.email_confirmed_at

      if (isVerified) {
        // User exists and is verified - can't overwrite
        return NextResponse.json(
          { error: 'This email is already registered. Please sign in or use forgot password.' },
          { status: 400 }
        )
      }

      // User exists but is NOT verified - delete them to allow re-registration
      console.log(`Deleting unverified user: ${existingUser.id}`)
      
      // Delete user profile first (if exists)
      await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('id', existingUser.id)

      // Delete the auth user
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
      
      if (deleteError) {
        console.error('Error deleting unverified user:', deleteError)
        return NextResponse.json(
          { error: 'Failed to process registration. Please try again.' },
          { status: 500 }
        )
      }
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
          name: name.trim(),
        },
        emailRedirectTo: `${baseUrl}/auth/callback`,
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

    // Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: signUpData.user.id,
        email: normalizedEmail,
        name: name.trim(),
      })

    if (profileError && !profileError.message.includes('duplicate')) {
      console.error('Profile creation error:', profileError)
    }

    return NextResponse.json({
      success: true,
      message: 'Account created. Please check your email to verify.',
      userId: signUpData.user.id,
    })

  } catch (error: any) {
    console.error('User signup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
