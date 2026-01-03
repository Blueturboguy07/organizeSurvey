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

    // Get user profile - just the query
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('latest_cleansed_query, name, email')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json(
        { error: 'Failed to load profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      query: userProfile?.latest_cleansed_query || null,
      name: userProfile?.name || null,
      email: userProfile?.email || null
    })
  } catch (error: any) {
    console.error('Profile GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load profile' },
      { status: 500 }
    )
  }
}

