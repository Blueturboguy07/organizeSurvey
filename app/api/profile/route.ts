import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// GET - Load user profile
export async function GET(request: NextRequest) {
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

    // Get user query from user_queries table
    const { data: userQuery, error: profileError } = await supabaseAdmin
      .from('user_queries')
      .select('latest_cleansed_query')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError)
      // If table doesn't exist, return null (user hasn't saved query yet)
      if (profileError.code === '42P01' || profileError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          query: null
        })
      }
      return NextResponse.json(
        { error: 'Failed to load profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      query: userQuery?.latest_cleansed_query || null
    })
  } catch (error: any) {
    console.error('Profile GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load profile' },
      { status: 500 }
    )
  }
}

