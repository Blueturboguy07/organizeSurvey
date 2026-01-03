import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rateLimit'
import { createClient } from '@supabase/supabase-js'

function validateAndSanitize(body: any) {
  // Honeypot check - if filled, it's a bot
  if (body.website) {
    // Bot detected - return fake success
    return { isBot: true }
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!body.email || !emailRegex.test(body.email)) {
    throw new Error('Invalid email format')
  }

  // Length checks
  if (!body.name || body.name.trim().length < 2 || body.name.length > 100) {
    throw new Error('Name must be between 2 and 100 characters')
  }

  if (body.query && body.query.length > 5000) {
    throw new Error('Query too long')
  }

  // Check for XSS patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
  ]
  
  const textToCheck = `${body.name}${body.email}${body.query || ''}`
  for (const pattern of dangerousPatterns) {
    if (pattern.test(textToCheck)) {
      throw new Error('Invalid characters detected')
    }
  }

  return {
    name: body.name.trim().substring(0, 100),
    email: body.email.toLowerCase().trim(),
    query: body.query?.substring(0, 5000) || '',
    cleansedQuery: body.cleansedQuery?.substring(0, 5000) || ''
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown'
    
    // Check rate limit (5 requests per hour per IP)
    const rateLimit = await checkRateLimit(ip, 5, 3600000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many requests. Please try again later.',
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      )
    }

    // Validate environment variables at runtime
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

    const body = await request.json()
    
    // Validate and sanitize input
    const sanitized = validateAndSanitize(body)
    if (sanitized.isBot) {
      // Fake success for bots
      return NextResponse.json({ success: true }, { status: 200 })
    }

    const { name, email, query, cleansedQuery } = sanitized

    if (!name || !email || !query) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Ensure email matches authenticated user
    const normalizedEmail = email.toLowerCase().trim()
    if (normalizedEmail !== user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email does not match authenticated user' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()

    // Save to user_queries table (upsert by user_id)
    const { data: upsertData, error: upsertError } = await supabaseAdmin
      .from('user_queries')
      .upsert({
        user_id: user.id,
        latest_cleansed_query: cleansedQuery || query,
        updated_at: now
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()

    if (upsertError) {
      console.error('❌ Supabase upsert error:', upsertError)
      console.error('Error code:', upsertError.code)
      console.error('Error message:', upsertError.message)
      console.error('Error details:', upsertError.details)
      console.error('Error hint:', upsertError.hint)
      
      // If table doesn't exist, log helpful error
      if (upsertError.code === '42P01' || upsertError.message?.includes('does not exist')) {
        throw new Error('user_queries table does not exist. Please run CREATE_USER_QUERIES_TABLE.sql in Supabase SQL Editor.')
      }
      throw upsertError
    }

    console.log('✅ Query saved successfully:', upsertData)
    return NextResponse.json({ success: true, data: upsertData })
  } catch (error: any) {
    console.error('Submit error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save data' },
      { status: 500 }
    )
  }
}

