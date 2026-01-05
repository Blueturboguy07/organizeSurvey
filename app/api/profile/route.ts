import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering (required for request.headers)
export const dynamic = 'force-dynamic'

// Helper function to get authenticated user
async function getAuthenticatedUser(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
    return { user: null, error: 'Unauthorized. Please sign in.' }
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
  if (authError || !user) {
    return { user: null, error: 'Unauthorized. Invalid or expired session.' }
  }

  return { user, error: null }
}

// GET - Load user profile
export async function GET(request: NextRequest) {
  try {
    validateEnvVars()
    
    const { user, error: authError } = await getAuthenticatedUser(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      )
    }

    // Disable caching to ensure fresh data
    const headers = new Headers()
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')

    // Get user profile from user_profiles table (if exists)
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('name, profile_picture_url, email_preferences')
      .eq('id', user.id)
      .single()

    // Get user query from user_queries table
    const { data: userQuery, error: profileError } = await supabaseAdmin
      .from('user_queries')
      .select('latest_cleansed_query, user_demographics')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError)
      // If table doesn't exist, return null (user hasn't saved query yet)
      if (profileError.code === '42P01' || profileError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          name: userProfile?.name || user.user_metadata?.name || null,
          email: user.email,
          profilePictureUrl: userProfile?.profile_picture_url || null,
          emailPreferences: userProfile?.email_preferences || {
            marketing: true,
            updates: true,
            recommendations: true
          },
          query: null,
          demographics: null
        }, { headers })
      }
    }

    console.log('📥 Profile GET - userQuery:', userQuery)

    return NextResponse.json({ 
      name: userProfile?.name || user.user_metadata?.name || null,
      email: user.email,
      profilePictureUrl: userProfile?.profile_picture_url || null,
      emailPreferences: userProfile?.email_preferences || {
        marketing: true,
        updates: true,
        recommendations: true
      },
      query: userQuery?.latest_cleansed_query || null,
      demographics: userQuery?.user_demographics || null
    }, { headers })
  } catch (error: any) {
    console.error('Profile GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load profile' },
      { status: 500 }
    )
  }
}

// PUT - Update user profile
export async function PUT(request: NextRequest) {
  try {
    validateEnvVars()
    
    const { user, error: authError } = await getAuthenticatedUser(request)
    if (authError || !user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, emailPreferences } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (emailPreferences !== undefined) updateData.email_preferences = emailPreferences

    // Check if user profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    let result
    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single()
      
      result = { data, error }
    } else {
      // Create new profile
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email,
          name: name || user.user_metadata?.name || null,
          email_preferences: emailPreferences || {
            marketing: true,
            updates: true,
            recommendations: true
          }
        })
        .select()
        .single()
      
      result = { data, error }
    }

    if (result.error) {
      console.error('Profile update error:', result.error)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      profile: result.data
    })
  } catch (error: any) {
    console.error('Profile PUT error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    )
  }
}

