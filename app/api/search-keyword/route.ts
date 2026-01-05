import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const execFileAsync = promisify(execFile)

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Simple fuzzy matching function using Levenshtein distance
function fuzzyMatch(str1: string, str2: string, threshold: number = 0.8): boolean {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()
  
  // Exact match
  if (s1.includes(s2) || s2.includes(s1)) return true
  
  // Simple Levenshtein distance calculation
  const len1 = s1.length
  const len2 = s2.length
  
  if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.3) return false // Too different in length
  
  const matrix: number[][] = []
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        )
      }
    }
  }
  
  const distance = matrix[len1][len2]
  const maxLen = Math.max(len1, len2)
  const similarity = 1 - (distance / maxLen)
  
  return similarity >= threshold
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keyword } = body

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing keyword' },
        { status: 400 }
      )
    }

    const searchKeyword = keyword.trim().toLowerCase()

    // Use Python script for searching (reuse existing infrastructure)
    const scriptPath = path.join(process.cwd(), 'scripts', 'weighted_search.py')
    const csvPath = path.join(process.cwd(), 'final.csv')
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python3')
    
    // Create a simple query that searches by keyword
    const query = searchKeyword
    const tempFile = join(tmpdir(), `keyword_search_${Date.now()}_${Math.random().toString(36).substring(7)}.json`)
    
    try {
      await writeFile(tempFile, JSON.stringify({ query, userData: {} }), 'utf-8')
      
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

      // Filter results to match name or bio with fuzzy matching
      const filteredResults = (results.results || results || []).filter((org: any) => {
        const name = (org.name || '').toLowerCase()
        const bio = (org.bio_snippet || org.full_bio || '').toLowerCase()
        const searchText = `${name} ${bio}`
        
        // Check for exact substring match first (higher priority)
        if (searchText.includes(searchKeyword)) {
          return true
        }
        
        // Check individual words for fuzzy match
        const keywordWords = searchKeyword.split(/\s+/).filter((w: string) => w.length > 2)
        for (const word of keywordWords) {
          // Check if word appears in name or bio (allowing minor typos)
          if (fuzzyMatch(word, name) || fuzzyMatch(word, bio) || 
              name.includes(word.substring(0, Math.max(3, Math.floor(word.length * 0.7)))) ||
              bio.includes(word.substring(0, Math.max(3, Math.floor(word.length * 0.7))))) {
            return true
          }
        }
        
        return false
      })

      // Sort by relevance score (if available) or alphabetically
      filteredResults.sort((a: any, b: any) => {
        if (a.relevance_score && b.relevance_score) {
          return b.relevance_score - a.relevance_score
        }
        return (a.name || '').localeCompare(b.name || '')
      })

      return NextResponse.json({ results: filteredResults.slice(0, 20) }) // Limit to top 20
    } catch (execError: any) {
      if (tempFile) {
        await unlink(tempFile).catch(() => {})
      }
      
      if (execError.code === 'ENOENT' || execError.message?.includes('ENOENT')) {
        return NextResponse.json(
          { 
            error: 'Search service not available',
            code: 'PYTHON_NOT_AVAILABLE'
          },
          { status: 503 }
        )
      }
      
      throw execError
    }
  } catch (error: any) {
    console.error('Keyword search error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

