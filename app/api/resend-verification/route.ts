import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { email, type } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    
    // Build the redirect URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === normalizedEmail)

    if (!existingUser) {
      // Don't reveal whether the email exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a verification link has been sent.',
      })
    }

    // Check if already verified
    if (existingUser.email_confirmed_at) {
      return NextResponse.json(
        { error: 'This email is already verified. You can sign in.' },
        { status: 400 }
      )
    }

    // Determine the redirect URL based on account type
    const isOrgAccount = existingUser.user_metadata?.is_org_account
    const redirectUrl = isOrgAccount 
      ? `${baseUrl}/auth/callback?next=/org/dashboard`
      : `${baseUrl}/auth/callback`

    // Use the Supabase client to resend verification email
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectUrl,
      }
    })

    if (resendError) {
      console.error('Resend verification error:', resendError)
      
      // Check if it's a rate limit error
      if (resendError.message?.toLowerCase().includes('rate') || 
          resendError.message?.toLowerCase().includes('limit')) {
        return NextResponse.json(
          { error: 'Please wait a minute before requesting another verification email.' },
          { status: 429 }
        )
      }
      
      return NextResponse.json(
        { error: resendError.message || 'Failed to resend verification email' },
        { status: 500 }
      )
    }

    // Mask the email for privacy in response
    const [localPart, domain] = normalizedEmail.split('@')
    const maskedEmail = localPart.slice(0, 2) + '***@' + domain

    return NextResponse.json({
      success: true,
      email: maskedEmail,
      message: 'Verification email sent successfully.',
    })

  } catch (error: any) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

