import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { checkRateLimit } from '@/lib/rateLimit'

const execFileAsync = promisify(execFile)

// Get search API URL from environment (Render service)
const SEARCH_API_URL = process.env.SEARCH_API_URL

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown'
    
    // Check rate limit (30 searches per minute per IP)
    const rateLimit = await checkRateLimit(ip, 30, 60000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many search requests. Please try again later.',
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { query, userData } = body

    if (!query || !userData) {
      return NextResponse.json(
        { error: 'Missing query or userData' },
        { status: 400 }
      )
    }

    // If SEARCH_API_URL is set, use Render API service
    if (SEARCH_API_URL) {
      try {
        const response = await fetch(`${SEARCH_API_URL}/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, userData }),
          // Add timeout for Render free tier cold starts
          signal: AbortSignal.timeout(60000) // 60 second timeout
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Search API returned ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json({ results: data.results || [] })
      } catch (fetchError: any) {
        console.error('Search API error:', fetchError.message)
        return NextResponse.json(
          { 
            error: fetchError.message || 'Failed to connect to search service',
            code: 'SEARCH_API_ERROR'
          },
          { status: 503 }
        )
      }
    }

    // Fallback: Try local Python execution (for local development)
    let tempFile: string | null = null
    try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'weighted_search.py')
    const csvPath = path.join(process.cwd(), 'final.csv')
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python3')
    
    tempFile = join(tmpdir(), `search_${Date.now()}_${Math.random().toString(36).substring(7)}.json`)
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
    
    if (results.error) {
      return NextResponse.json(
        { error: results.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ results })
    } catch (execError: any) {
    if (tempFile) {
      await unlink(tempFile).catch(() => {})
    }
      
      // Handle Python not found error
      if (execError.code === 'ENOENT' || execError.message?.includes('ENOENT')) {
        return NextResponse.json(
          { 
            error: 'Search API not configured. Please set SEARCH_API_URL environment variable or set up local Python environment.',
            code: 'PYTHON_NOT_AVAILABLE'
          },
          { status: 503 }
        )
      }
      
      throw execError
    }
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

