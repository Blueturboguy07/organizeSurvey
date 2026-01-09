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

    // Get the org account to find the email
    const { data: orgAccount, error: fetchError } = await supabaseAdmin
      .from('org_accounts')
      .select('email')
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !orgAccount?.email) {
      return NextResponse.json(
        { error: 'Organization account not found' },
        { status: 404 }
      )
    }

    const email = orgAccount.email

    // Build the redirect URL for after password reset
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    // Send password recovery email (this will let them set a password)
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${baseUrl}/org/setup`,
      }
    )

    if (resetError) {
      console.error('Error sending reset email:', resetError)
      return NextResponse.json(
        { error: 'Failed to send setup link: ' + resetError.message },
        { status: 500 }
      )
    }

    // Mask the email for privacy
    const [localPart, domain] = email.split('@')
    const maskedEmail = localPart.slice(0, 2) + '***@' + domain

    return NextResponse.json({
      success: true,
      email: maskedEmail,
      message: 'Setup link sent',
    })

  } catch (error: any) {
    console.error('Send setup link error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

