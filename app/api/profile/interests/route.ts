import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering
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

// Generate cleansed query from survey data (same logic as SurveyForm)
function generateCleansedQuery(formData: any): string {
  const cleansed: string[] = []
  
  // Career fields - repeat 3 times for strong emphasis (most important)
  if (formData.careerFields && formData.careerFields.length > 0) {
    const careerFieldsStr = formData.careerFields.join(', ')
    cleansed.push(careerFieldsStr)
    cleansed.push(careerFieldsStr) // Repeat 1
    cleansed.push(careerFieldsStr) // Repeat 2
  }
  
  // Engineering types - if selected, add them to the cleansed query
  if (formData.engineeringTypes && formData.engineeringTypes.length > 0) {
    const engineeringTypesStr = formData.engineeringTypes.join(', ')
    cleansed.push(engineeringTypesStr)
    cleansed.push(engineeringTypesStr) // Repeat for emphasis
  }
  
  // Activities - repeat 2 times for emphasis (important)
  if (formData.activities && formData.activities.length > 0) {
    const activitiesStr = formData.activities.join(', ')
    cleansed.push(activitiesStr)
    cleansed.push(activitiesStr) // Repeat once for emphasis
  }
  
  // Hobbies - include but don't repeat (moderately important)
  if (formData.hobbies) {
    cleansed.push(formData.hobbies)
  }
  if (formData.additionalHobbies && formData.additionalHobbies.length > 0) {
    cleansed.push(formData.additionalHobbies.join(', '))
  }
  
  // Lives on campus - less important
  const campusStatus = formData.livesOnCampus === 'Yes' ? 'on-campus' : formData.livesOnCampus === 'No' ? 'off-campus' : ''
  if (campusStatus) {
    cleansed.push(campusStatus)
  }
  if (formData.livesOnCampus === 'Yes' && formData.hall) {
    cleansed.push(formData.hall)
  }
  
    // Demographics - include but don't emphasize (filtering only, not for matching)
    if (formData.race) {
      const raceValue = formData.race + (formData.raceOther ? ` (${formData.raceOther})` : '')
      cleansed.push(raceValue)
    }
  
  if (formData.sexuality && formData.sexuality !== 'Straight') {
    if (formData.sexuality === 'Other' && formData.sexualityOther) {
      cleansed.push(formData.sexualityOther)
    } else if (formData.sexuality !== 'Other') {
      cleansed.push(formData.sexuality)
    }
  }
  
  if (formData.gender) {
    if (formData.gender === 'Other' && formData.genderOther) {
      cleansed.push(formData.genderOther)
    } else if (formData.gender !== 'Other') {
      cleansed.push(formData.gender)
    }
  }
  
  // Religion (if interested)
  if (formData.interestedInReligiousOrgs === 'Yes' && formData.religion) {
    cleansed.push(formData.religion === 'Other' ? formData.religionOther : formData.religion)
  }
  
  return cleansed.join(' | ')
}

// PUT - Update user interests
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
    console.log('📝 Received interests update request:', JSON.stringify(body, null, 2))
    
    // Extract user demographic data for eligibility filtering and full profile
    const userDemographics = {
      gender: body.gender || body.genderOther || '',
      race: body.race || body.raceOther || '',
      classification: body.classification || '',
      sexuality: body.sexuality || body.sexualityOther || '',
      careerFields: body.careerFields || [],
      engineeringTypes: body.engineeringTypes || [],
      religion: body.religion === 'Other' ? body.religionOther : (body.religion || ''),
      // Include all other fields for full profile
      livesOnCampus: body.livesOnCampus || '',
      hall: body.hall || '',
      hobbies: body.hobbies || '',
      additionalHobbies: body.additionalHobbies || [],
      activities: body.activities || [],
      interestedInReligiousOrgs: body.interestedInReligiousOrgs || '',
      raceOther: body.raceOther || '',
      sexualityOther: body.sexualityOther || '',
      genderOther: body.genderOther || '',
      religionOther: body.religionOther || ''
    }

    // Generate cleansed query from form data
    const cleansedQuery = generateCleansedQuery(body)
    console.log('🔍 Generated cleansed query:', cleansedQuery)

    // Validate query is not empty
    if (!cleansedQuery || cleansedQuery.trim().length === 0) {
      console.error('❌ Query is empty after generation')
      return NextResponse.json(
        { error: 'Query cannot be empty. Please fill in at least some interests.' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Log admin client status (for debugging)
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log('🔑 Using service role key:', hasServiceKey ? 'Yes' : 'No (falling back to anon key)')
    console.log('📝 Saving interests for user:', user.id, 'Query length:', cleansedQuery.length)

    // Check if record exists first
    const { data: existingData, error: checkError } = await supabaseAdmin
      .from('user_queries')
      .select('id, created_at')
      .eq('user_id', user.id)
      .maybeSingle()

    let upsertData
    let upsertError

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking existing query:', checkError)
      throw checkError
    }

    // Use upsert for atomic create/update (same as submit route)
    const upsertPayload: any = {
      user_id: user.id,
      latest_cleansed_query: cleansedQuery,
      user_demographics: userDemographics,
      updated_at: now
    }
    
    // Only set created_at if this is a new record
    if (!existingData) {
      upsertPayload.created_at = now
    }

    const { data: upsertDataResult, error: upsertErrorResult } = await supabaseAdmin
      .from('user_queries')
      .upsert(upsertPayload, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    upsertData = upsertDataResult
    upsertError = upsertErrorResult

    if (upsertError) {
      console.error('❌ Supabase save error:', upsertError)
      console.error('Error code:', upsertError.code)
      console.error('Error message:', upsertError.message)
      console.error('Error details:', upsertError.details)
      console.error('Error hint:', upsertError.hint)
      console.error('User ID:', user.id)
      console.error('Query to save:', cleansedQuery.substring(0, 100))
      console.error('Has service key:', hasServiceKey)
      
      // If table doesn't exist, log helpful error
      if (upsertError.code === '42P01' || upsertError.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'user_queries table does not exist. Please create the table in Supabase SQL Editor.',
            details: upsertError.message,
            code: upsertError.code
          },
          { status: 500 }
        )
      }
      
      // If RLS policy issue
      if (upsertError.code === '42501' || upsertError.message?.includes('permission denied') || upsertError.message?.includes('new row violates row-level security')) {
        return NextResponse.json(
          { 
            error: 'Permission denied. Check RLS policies and ensure SUPABASE_SERVICE_ROLE_KEY is set correctly in Vercel environment variables.',
            details: upsertError.message,
            code: upsertError.code,
            hasServiceKey: hasServiceKey
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        {
          error: 'Failed to save interests',
          details: upsertError.message,
          code: upsertError.code,
          hint: upsertError.hint
        },
        { status: 500 }
      )
    }

    console.log('✅ Query saved successfully:', upsertData)

    return NextResponse.json({ 
      success: true,
      query: cleansedQuery,
      demographics: userDemographics
    })
  } catch (error: any) {
    console.error('Interests PUT error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update interests' },
      { status: 500 }
    )
  }
}

