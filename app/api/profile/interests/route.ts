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

    // Check if record exists first (use single() like submit route does)
    const { data: existingData, error: checkError } = await supabaseAdmin
      .from('user_queries')
      .select('id, created_at, latest_cleansed_query, user_demographics')
      .eq('user_id', user.id)
      .maybeSingle()

    console.log('🔍 Existing query check:', { 
      existingData: existingData ? {
        id: existingData.id,
        hasQuery: !!existingData.latest_cleansed_query,
        hasDemo: !!existingData.user_demographics
      } : null,
      checkError: checkError?.message,
      errorCode: checkError?.code 
    })

    // If there's an error other than "no rows found", log it but continue
    if (checkError && checkError.code !== 'PGRST116') {
      console.warn('⚠️ Warning checking existing query:', checkError)
    }

    // Use upsert to ensure the record is created/updated atomically
    console.log('📝 Upserting query record for user:', user.id)
    console.log('📝 Data to upsert:', {
      user_id: user.id,
      queryLength: cleansedQuery.length,
      demographics: userDemographics
    })
    
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
    
    const { data: upsertData, error: upsertError } = await supabaseAdmin
      .from('user_queries')
      .upsert(upsertPayload, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    const result = { data: upsertData, error: upsertError }
    
    if (upsertError) {
      console.error('❌ Upsert error:', upsertError)
      console.error('❌ Full error:', JSON.stringify(upsertError, null, 2))
    } else {
      console.log('✅ Upsert successful:', {
        userId: upsertData?.user_id,
        queryLength: upsertData?.latest_cleansed_query?.length,
        hasDemographics: !!upsertData?.user_demographics
      })
    }

    if (result.error) {
      console.error('❌ Interests update error:', result.error)
      console.error('❌ Full error details:', JSON.stringify(result.error, null, 2))
      return NextResponse.json(
        { error: `Failed to update interests: ${result.error.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Log what was actually saved
    console.log('✅ Update/Insert successful. Saved data:', {
      query: cleansedQuery.substring(0, 100) + '...',
      demographics: userDemographics,
      resultData: result.data
    })

    // Small delay to ensure write consistency
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify the update actually persisted by reading it back
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('user_queries')
      .select('latest_cleansed_query, user_demographics')
      .eq('user_id', user.id)
      .maybeSingle()

    if (verifyError) {
      console.warn('⚠️ Verification read failed:', verifyError)
    } else if (!verifyData) {
      console.error('❌ Verification read returned no data - update may not have persisted!')
    } else {
      const queryMatches = verifyData.latest_cleansed_query === cleansedQuery
      const demoMatches = JSON.stringify(verifyData.user_demographics) === JSON.stringify(userDemographics)
      console.log('✅ Verified update persisted:', {
        queryMatches,
        demoMatches,
        savedQuery: cleansedQuery.substring(0, 50) + '...',
        readQuery: verifyData.latest_cleansed_query?.substring(0, 50) + '...',
        savedDemo: userDemographics,
        readDemo: verifyData.user_demographics
      })
      
      if (!queryMatches || !demoMatches) {
        console.error('⚠️ WARNING: Verification shows data mismatch! Update may not have persisted correctly.')
      }
    }

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

