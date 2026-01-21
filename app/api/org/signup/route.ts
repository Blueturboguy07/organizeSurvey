import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Generate URL-friendly slug from org name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// Ensure slug is unique by appending a number if needed
async function getUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug
  let counter = 1
  
  while (true) {
    const { data } = await supabaseAdmin
      .from('org_accounts')
      .select('id')
      .eq('slug', slug)
      .single()
    
    if (!data) {
      return slug
    }
    
    slug = `${baseSlug}-${counter}`
    counter++
  }
}

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
      // Check if user is verified (has confirmed their email)
      const isVerified = !!existingUser.email_confirmed_at

      if (isVerified) {
        // User exists and is verified - can't overwrite
        if (existingUser.user_metadata?.is_org_account) {
          return NextResponse.json(
            { error: 'This email is already registered as an organization account. Please sign in.' },
            { status: 400 }
          )
        }
        
        return NextResponse.json(
          { error: 'This email is already registered. Please use a different email or contact support.' },
          { status: 400 }
        )
      }

      // User exists but is NOT verified - delete them to allow re-registration
      console.log(`Deleting unverified org user: ${existingUser.id}`)
      
      // Delete org account record first (if exists)
      await supabaseAdmin
        .from('org_accounts')
        .delete()
        .eq('user_id', existingUser.id)

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

    // Generate unique slug from organization name
    const baseSlug = generateSlug(organizationName || 'organization')
    const uniqueSlug = await getUniqueSlug(baseSlug)

    // Create or update org account record
    if (existingAccount) {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from('org_accounts')
        .update({
          email: normalizedEmail,
          user_id: signUpData.user.id,
          email_verified: false,
          slug: uniqueSlug,
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
          slug: uniqueSlug,
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

