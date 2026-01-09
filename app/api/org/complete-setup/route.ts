import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user from the Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get organization info from user metadata
    const organizationId = user.user_metadata?.organization_id
    const verificationToken = user.user_metadata?.verification_token

    if (!organizationId && !verificationToken && !user.email) {
      return NextResponse.json(
        { error: 'No organization information found' },
        { status: 400 }
      )
    }

    // Try to update org_accounts using admin client (bypasses RLS)
    let updated = false

    // Strategy 1: Update by verification_token
    if (verificationToken && !updated) {
      const { data, error } = await supabaseAdmin
        .from('org_accounts')
        .update({
          user_id: user.id,
          email_verified: true,
          verification_token: null,
          verification_token_expires_at: null,
        })
        .eq('verification_token', verificationToken)
        .select()

      if (!error && data && data.length > 0) {
        updated = true
        console.log('Updated org_accounts by verification_token')
      }
    }

    // Strategy 2: Update by organization_id
    if (organizationId && !updated) {
      const { data, error } = await supabaseAdmin
        .from('org_accounts')
        .update({
          user_id: user.id,
          email_verified: true,
          verification_token: null,
          verification_token_expires_at: null,
        })
        .eq('organization_id', organizationId)
        .select()

      if (!error && data && data.length > 0) {
        updated = true
        console.log('Updated org_accounts by organization_id')
      }
    }

    // Strategy 3: Update by email
    if (user.email && !updated) {
      const { data, error } = await supabaseAdmin
        .from('org_accounts')
        .update({
          user_id: user.id,
          email_verified: true,
          verification_token: null,
          verification_token_expires_at: null,
        })
        .eq('email', user.email.toLowerCase())
        .select()

      if (!error && data && data.length > 0) {
        updated = true
        console.log('Updated org_accounts by email')
      }
    }

    if (!updated) {
      console.error('Failed to update org_accounts - no matching record found')
      return NextResponse.json(
        { error: 'Could not find organization account to update' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Organization account setup completed',
    })

  } catch (error: any) {
    console.error('Complete setup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

