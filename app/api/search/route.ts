import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const execFileAsync = promisify(execFile)

export async function POST(request: NextRequest) {
  let tempFile: string | null = null
  
  try {
    const body = await request.json()
    const { query, userData } = body

    if (!query || !userData) {
      return NextResponse.json(
        { error: 'Missing query or userData' },
        { status: 400 }
      )
    }

    // Check if we're on Vercel (production) or local
    const isVercel = process.env.VERCEL === '1'
    
    if (isVercel) {
      // On Vercel: call the Python serverless function
      const pythonApiUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/search`
        : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/api/search`
        : '/api/search'
      
      try {
        const response = await fetch(pythonApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, userData }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Python API error' }))
          return NextResponse.json(
            { error: error.error || 'Search failed' },
            { status: response.status }
          )
        }

        const data = await response.json()
        return NextResponse.json({ results: data.results || [] })
      } catch (fetchError: any) {
        console.error('Failed to call Python API:', fetchError)
        return NextResponse.json(
          { error: `Failed to call search service: ${fetchError.message}` },
          { status: 500 }
        )
      }
    } else {
      // Local development: use Python directly
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
    }
  } catch (error: any) {
    if (tempFile) {
      await unlink(tempFile).catch(() => {})
    }
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

