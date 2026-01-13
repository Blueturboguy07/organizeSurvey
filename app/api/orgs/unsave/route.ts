import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest) {
  try {
    validateEnvVars()
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

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

    const { searchParams } = new URL(request.url)
    const saved_org_id = searchParams.get('id')

    if (!saved_org_id) {
      return NextResponse.json(
        { error: 'Missing saved_org_id' },
        { status: 400 }
      )
    }

    // Delete the saved organization
    const { error } = await supabaseAdmin
      .from('saved_organizations')
      .delete()
      .eq('id', saved_org_id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error unsaving organization:', error)
      return NextResponse.json(
        { error: 'Failed to unsave organization' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unsave org API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

