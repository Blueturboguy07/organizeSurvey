import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, query, cleansedQuery, queryKeywords } = body

    if (!name || !email || !query) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists to preserve firstSeen timestamp
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('first_seen')
      .eq('email', normalizedEmail)
      .single()

    const now = new Date().toISOString()
    const firstSeen = existingUser?.first_seen || now

    // Upsert user data (insert or update)
    // First try to update existing user
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', normalizedEmail)
      .single()

    if (existing) {
      // Update existing user
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          name,
          latest_query: query,
          latest_cleansed_query: cleansedQuery || query,
          latest_query_keywords: queryKeywords || [],
          last_updated: now
        })
        .eq('email', normalizedEmail)

      if (error) {
        console.error('Supabase update error:', error)
        throw error
      }
    } else {
      // Insert new user
      const { error } = await supabaseAdmin
        .from('users')
        .insert({
          email: normalizedEmail,
          name,
          latest_query: query,
          latest_cleansed_query: cleansedQuery || query,
          latest_query_keywords: queryKeywords || [],
          last_updated: now,
          first_seen: firstSeen
        })

      if (error) {
        console.error('Supabase insert error:', error)
        throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Submit error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save data' },
      { status: 500 }
    )
  }
}

