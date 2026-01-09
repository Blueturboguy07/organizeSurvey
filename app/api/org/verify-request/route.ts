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
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const verificationUrl = `${baseUrl}/org/setup?token=${verificationToken}`

    // Check if user already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email.toLowerCase().trim())

    if (existingUser) {
      // User exists - check if already an org account
      if (existingUser.user_metadata?.is_org_account) {
        // Clean up the org account we just created
        await supabaseAdmin
          .from('org_accounts')
          .delete()
          .eq('organization_id', organizationId)
        
        return NextResponse.json(
          { error: 'This email is already registered as an organization account' },
          { status: 400 }
        )
      }
      
      // User exists as student - update their metadata and send magic link
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          ...existingUser.user_metadata,
          is_org_account: true,
          organization_id: organizationId,
          organization_name: organizationName,
          verification_token: verificationToken,
        }
      })

      // Send magic link for existing user
      const { error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email.toLowerCase().trim(),
        options: {
          redirectTo: verificationUrl,
        }
      })

      if (magicLinkError) {
        console.error('Error sending magic link:', magicLinkError)
        // Try recovery link as fallback
        await supabaseAdmin.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
          redirectTo: verificationUrl,
        })
      }
    } else {
      // New user - send invite email (this actually sends the email!)
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email.toLowerCase().trim(),
        {
          data: {
            is_org_account: true,
            organization_id: organizationId,
            organization_name: organizationName,
            verification_token: verificationToken,
          },
          redirectTo: verificationUrl,
        }
      )

      if (inviteError) {
        console.error('Error inviting user:', inviteError)
        // Clean up the org account we just created
        await supabaseAdmin
          .from('org_accounts')
          .delete()
          .eq('organization_id', organizationId)
        
        return NextResponse.json(
          { error: 'Failed to send verification email: ' + inviteError.message },
          { status: 500 }
        )
      }
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

