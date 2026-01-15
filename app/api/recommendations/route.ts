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

// Force dynamic rendering
export const dynamic = 'force-dynamic'

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
    const { data: userQuery, error: queryError } = await supabaseAdmin
      .from('user_queries')
      .select('latest_cleansed_query, user_demographics')
      .eq('user_id', user.id)
      .single()

    if (queryError && queryError.code !== 'PGRST116') {
      console.error('Error fetching user query:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch user query' },
        { status: 500 }
      )
    }

    // If user hasn't completed survey, return empty recommendations
    if (!userQuery || !userQuery.latest_cleansed_query) {
      return NextResponse.json({ recommendations: [] })
    }

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

    // Prepare user data for search
    const userData = userQuery.user_demographics || {}
    const query = userQuery.latest_cleansed_query

    // Perform search using the same logic as /api/search
    let searchResults: any[] = []

    // If SEARCH_API_URL is set, use Render API service
    if (SEARCH_API_URL) {
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

    // Get joined organization names as well (for filtering CSV results that might not have IDs)
    let joinedOrgNames = new Set<string>()
    if (joinedOrgIds.size > 0) {
      const { data: orgData } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .in('id', Array.from(joinedOrgIds))
      
      if (orgData) {
        joinedOrgNames = new Set(orgData.map((org: any) => org.name.toLowerCase().trim()))
      }
    }

    // Filter out joined organizations and limit to top 20
    const recommendations = searchResults
      .filter((org: any) => {
        // Filter out if organization ID matches a joined org
        if (org.id && joinedOrgIds.has(org.id)) {
          return false
        }
        // Also filter by name (for CSV results that might not have IDs)
        if (org.name && joinedOrgNames.has(org.name.toLowerCase().trim())) {
          return false
        }
        return true
      })
      .slice(0, 20) // Top 20

    return NextResponse.json({ recommendations })
  } catch (error: any) {
    console.error('Recommendations API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

