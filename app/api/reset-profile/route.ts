import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    validateEnvVars()
    
    // Get auth token from request
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // Verify user authentication
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

    // Clear user's query from user_queries table
    const { error: deleteError } = await supabaseAdmin
      .from('user_queries')
      .delete()
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Reset profile error:', updateError)
      throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Reset profile error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reset profile' },
      { status: 500 }
    )
  }
}

