import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest) {
  try {
    validateEnvVars()
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Invalid or expired session.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const organization_id = searchParams.get('organization_id')

    if (!organization_id) {
      return NextResponse.json(
        { error: 'Missing organization_id' },
        { status: 400 }
      )
    }

    // Delete the joined organization record
    const { error } = await supabaseAdmin
      .from('user_joined_organizations')
      .delete()
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)

    if (error) {
      console.error('Error leaving organization:', error)
      return NextResponse.json(
        { error: 'Failed to leave organization' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Leave org API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

