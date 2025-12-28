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

