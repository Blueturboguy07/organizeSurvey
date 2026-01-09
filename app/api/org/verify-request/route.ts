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

    const normalizedEmail = email.toLowerCase().trim()

    // Check if org account already exists
    const { data: existingAccount } = await supabaseAdmin
      .from('org_accounts')
      .select('id, user_id, email_verified')
      .eq('organization_id', organizationId)
      .single()

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Organization account already exists' },
        { status: 400 }
      )
    }

    // Build the redirect URL for password setup
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const setupUrl = `${baseUrl}/org/setup`

    // Check if user already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === normalizedEmail)

    let userId: string

    if (existingUser) {
      // User exists - check if already an org account
      if (existingUser.user_metadata?.is_org_account) {
        return NextResponse.json(
          { error: 'This email is already registered as an organization account' },
          { status: 400 }
        )
      }
      
      // Update existing user's metadata
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          ...existingUser.user_metadata,
          is_org_account: true,
          organization_id: organizationId,
          organization_name: organizationName,
        }
      })
      userId = existingUser.id
    } else {
      // Create new user with email already confirmed (no verification needed)
      // Use a random password - they'll set their own via reset link
      const tempPassword = crypto.randomBytes(32).toString('hex')
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true, // Mark email as verified immediately
        user_metadata: {
          is_org_account: true,
          organization_id: organizationId,
          organization_name: organizationName,
        }
      })

      if (createError || !newUser.user) {
        console.error('Error creating user:', createError)
        return NextResponse.json(
          { error: 'Failed to create user account: ' + (createError?.message || 'Unknown error') },
          { status: 500 }
        )
      }
      userId = newUser.user.id
    }

    // Create org account record (already verified since we'll send password reset)
    const { error: insertError } = await supabaseAdmin
      .from('org_accounts')
      .insert({
        organization_id: organizationId,
        email: normalizedEmail,
        email_verified: true, // Email is verified, they just need to set password
        user_id: null, // Will be set when they complete setup
      })

    if (insertError) {
      console.error('Error creating org account:', insertError)
      return NextResponse.json(
        { error: 'Failed to create organization account' },
        { status: 500 }
      )
    }

    // Send password reset email - this is the ONLY email they'll receive
    // It lets them set their password directly
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: setupUrl,
      }
    )

    if (resetError) {
      console.error('Error sending password reset:', resetError)
      // Clean up on failure
      await supabaseAdmin.from('org_accounts').delete().eq('organization_id', organizationId)
      
      return NextResponse.json(
        { error: 'Failed to send setup email: ' + resetError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Setup email sent',
    })

  } catch (error: any) {
    console.error('Org verification request error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

