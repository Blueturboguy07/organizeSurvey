import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, validateEnvVars } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { organization_name, organization_bio, organization_website, organization_contact_info } = body

    if (!organization_name || !organization_name.trim()) {
      return NextResponse.json(
        { error: 'Missing organization_name' },
        { status: 400 }
      )
    }

    // Check if already saved
    const { data: existing } = await supabaseAdmin
      .from('saved_organizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_name', organization_name.trim())
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Already saved this organization' },
        { status: 400 }
      )
    }

    // Save the organization
    // The database trigger will automatically link organization_id when the org joins the platform
    const { data, error } = await supabaseAdmin
      .from('saved_organizations')
      .insert({
        user_id: user.id,
        organization_name: organization_name.trim(),
        organization_bio: organization_bio || null,
        organization_website: organization_website || null,
        organization_contact_info: organization_contact_info || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving organization:', error)
      return NextResponse.json(
        { error: 'Failed to save organization' },
        { status: 500 }
      )
    }

    // TODO: Send email notification when org joins platform
    // This will be implemented later when email service is set up

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Save org API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
