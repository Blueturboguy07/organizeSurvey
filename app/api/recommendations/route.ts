import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const execFileAsync = promisify(execFile)

// Get search API URL from environment (Render service)
const SEARCH_API_URL = process.env.SEARCH_API_URL

// Force dynamic rendering - no caching at all
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
  try {
    // Validate environment variables
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

    // Get user's survey query and demographics
    // Create a FRESH Supabase client for this request to avoid any caching
    const freshSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    console.log('🔎 [RecommendationsAPI] Fetching user query for user:', user.id)
    console.log('🔎 [RecommendationsAPI] Using FRESH Supabase client (not singleton)')
    
    const { data: userQuery, error: queryError } = await freshSupabase
      .from('user_queries')
      .select('latest_cleansed_query, user_demographics, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    console.log('🔎 [RecommendationsAPI] Query fetch result:', {
      hasData: !!userQuery,
      queryPreview: userQuery?.latest_cleansed_query?.substring(0, 100) + '...',
      queryLength: userQuery?.latest_cleansed_query?.length,
      updatedAt: userQuery?.updated_at,
      error: queryError?.message || null
    })

    if (queryError && queryError.code !== 'PGRST116') {
      console.error('🔎 [RecommendationsAPI] ❌ Error fetching user query:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch user query' },
        { status: 500 }
      )
    }

    // If user hasn't completed survey, return empty recommendations
    if (!userQuery || !userQuery.latest_cleansed_query) {
      console.log('🔎 [RecommendationsAPI] No query found, returning empty recommendations')
      return NextResponse.json({ recommendations: [] })
    }
    
    console.log('🔎 [RecommendationsAPI] Using query for search:', userQuery.latest_cleansed_query.substring(0, 100) + '...')

    // Get user's joined organizations
    const { data: joinedOrgs, error: joinedOrgsError } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('organization_id')
      .eq('user_id', user.id)

    if (joinedOrgsError) {
      console.error('Error fetching joined organizations:', joinedOrgsError)
      // Continue anyway - assume no joined orgs if table doesn't exist yet
    }

    const joinedOrgIds = new Set(
      (joinedOrgs || []).map((jo: { organization_id: string }) => jo.organization_id)
    )

    // Get user's saved organizations
    const { data: savedOrgs, error: savedOrgsError } = await supabaseAdmin
      .from('user_saved_organizations')
      .select('organization_id')
      .eq('user_id', user.id)

    if (savedOrgsError && savedOrgsError.code !== '42P01') {
      console.error('Error fetching saved organizations:', savedOrgsError)
      // Continue anyway - assume no saved orgs if table doesn't exist yet
    }

    const savedOrgIds = new Set(
      (savedOrgs || []).map((so: { organization_id: string }) => so.organization_id)
    )

    // Prepare user data for search
    const userData = userQuery.user_demographics || {}
    const query = userQuery.latest_cleansed_query

    console.log('🔎 [RecommendationsAPI] ════════════════════════════════════')
    console.log('🔎 [RecommendationsAPI] 📤 QUERY BEING SENT TO SEARCH:')
    console.log('🔎 [RecommendationsAPI] Full query:', query)
    console.log('🔎 [RecommendationsAPI] Query length:', query.length)
    console.log('🔎 [RecommendationsAPI] ════════════════════════════════════')

    // Perform search using the same logic as /api/search
    let searchResults: any[] = []

    // If SEARCH_API_URL is set, use Render API service
    if (SEARCH_API_URL) {
      console.log('🔎 [RecommendationsAPI] Using external SEARCH_API_URL')
      try {
        const response = await fetch(`${SEARCH_API_URL}/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, userData }),
          signal: AbortSignal.timeout(60000) // 60 second timeout
        })

        if (response.ok) {
          const data = await response.json()
          searchResults = data.results || []
        }
      } catch (fetchError: any) {
        console.error('Search API error:', fetchError.message)
        // Fall back to local Python execution
      }
    }

    // Fallback: Try local Python execution (for local development or if API fails)
    if (searchResults.length === 0) {
      let tempFile: string | null = null
      try {
        const scriptPath = path.join(process.cwd(), 'scripts', 'weighted_search.py')
        const csvPath = path.join(process.cwd(), 'final.csv')
        const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python3')
        
        tempFile = join(tmpdir(), `recommendations_${Date.now()}_${Math.random().toString(36).substring(7)}.json`)
        await writeFile(tempFile, JSON.stringify({ query, userData }), 'utf-8')
        
        const pythonPath = existsSync(venvPython) ? venvPython : 'python3'
        const { stdout, stderr } = await execFileAsync(pythonPath, [scriptPath, tempFile, csvPath])

        if (tempFile) {
          await unlink(tempFile).catch(() => {})
        }

        if (stderr && !stderr.includes('WARNING') && !stderr.includes('UserWarning')) {
          console.error('Python script stderr:', stderr)
        }

        const results = JSON.parse(stdout.trim())
        
        if (!results.error) {
          searchResults = results || []
        }
      } catch (execError: any) {
        if (tempFile) {
          await unlink(tempFile).catch(() => {})
        }
        console.error('Error executing Python script:', execError)
      }
    }

    // Get joined and saved organization names as well (for filtering CSV results that might not have IDs)
    let joinedOrgNames = new Set<string>()
    let savedOrgNames = new Set<string>()
    
    const allFilteredIds = [...Array.from(joinedOrgIds), ...Array.from(savedOrgIds)]
    if (allFilteredIds.length > 0) {
      const { data: orgData } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .in('id', allFilteredIds)
      
      if (orgData) {
        for (const org of orgData) {
          if (joinedOrgIds.has(org.id)) {
            joinedOrgNames.add(org.name.toLowerCase().trim())
          }
          if (savedOrgIds.has(org.id)) {
            savedOrgNames.add(org.name.toLowerCase().trim())
          }
        }
      }
    }

    // Get all org_accounts to determine which orgs are on platform
    const { data: orgAccounts } = await freshSupabase
      .from('org_accounts')
      .select('organization_id, email_verified, is_active')
    
    // Create a set of organization IDs that are on platform (verified and active)
    const onPlatformOrgIds = new Set(
      (orgAccounts || [])
        .filter((acc: any) => acc.email_verified && acc.is_active)
        .map((acc: any) => acc.organization_id)
    )

    // Get is_application_based status for all orgs in search results
    const searchOrgIds = searchResults.map((org: any) => org.id).filter(Boolean)
    const applicationBasedOrgIds = new Set<string>()
    
    if (searchOrgIds.length > 0) {
      const { data: orgSettings } = await freshSupabase
        .from('organizations')
        .select('id, is_application_based')
        .in('id', searchOrgIds)
        .eq('is_application_based', true)
      
      if (orgSettings) {
        orgSettings.forEach((org: any) => applicationBasedOrgIds.add(org.id))
      }
    }

    // Filter out joined and saved organizations, and add is_on_platform status
    const recommendations = searchResults
      .filter((org: any) => {
        // Filter out if organization ID matches a joined or saved org
        if (org.id && (joinedOrgIds.has(org.id) || savedOrgIds.has(org.id))) {
          return false
        }
        // Also filter by name (for CSV results that might not have IDs)
        const orgNameLower = org.name?.toLowerCase().trim()
        if (orgNameLower && (joinedOrgNames.has(orgNameLower) || savedOrgNames.has(orgNameLower))) {
          return false
        }
        return true
      })
      .map((org: any) => ({
        ...org,
        // Determine is_on_platform based on org_accounts table
        is_on_platform: org.id ? onPlatformOrgIds.has(org.id) : false,
        // Determine is_application_based from organizations table
        is_application_based: org.id ? applicationBasedOrgIds.has(org.id) : false
      }))

    // Include debug info in response - with no-cache headers
    const response = NextResponse.json({ 
      recommendations,
      _debug: {
        apiUserId: user.id,
        apiUserEmail: user.email,
        fullQuerySentToSearch: query,
        queryUsed: userQuery.latest_cleansed_query.substring(0, 150) + '...',
        queryLength: userQuery.latest_cleansed_query.length,
        queryUpdatedAt: userQuery.updated_at,
        totalResults: searchResults.length,
        filteredResults: recommendations.length,
        usingFreshClient: true,
        timestamp: Date.now()
      }
    })
    
    // Add headers to prevent ANY caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
    
    return response
  } catch (error: any) {
    console.error('Recommendations API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

