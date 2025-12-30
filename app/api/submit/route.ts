import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rateLimit'

function validateAndSanitize(body: any) {
  // Honeypot check - if filled, it's a bot
  if (body.website) {
    // Bot detected - return fake success
    return { isBot: true }
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(body.email)) {
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
    cleansedQuery: body.cleansedQuery?.substring(0, 5000) || '',
    queryKeywords: Array.isArray(body.queryKeywords) 
      ? body.queryKeywords.slice(0, 100) 
      : []
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
    const body = await request.json()
    
    // Validate and sanitize input
    const sanitized = validateAndSanitize(body)
    if (sanitized.isBot) {
      // Fake success for bots
      return NextResponse.json({ success: true }, { status: 200 })
    }

    const { name, email, query, cleansedQuery, queryKeywords } = sanitized

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

