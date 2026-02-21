import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncEventToMembers } from '@/lib/googleCalendar'

// POST - Create an event and sync to Google Calendar
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { organization_id, title, description, location, start_time, end_time, all_day, color } = await request.json()

    if (!organization_id || !title || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user is admin/officer or org account
    const { data: orgAcct } = await supabaseAdmin
      .from('org_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .maybeSingle()

    const { data: membership } = await supabaseAdmin
      .from('user_joined_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .maybeSingle()

    const isAllowed = !!orgAcct || (membership?.role === 'admin' || membership?.role === 'officer')
    if (!isAllowed) return NextResponse.json({ error: 'Not authorized to create events' }, { status: 403 })

    // Insert event
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('org_events')
      .insert({
        organization_id,
        title: title.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        start_time,
        end_time,
        all_day: all_day || false,
        color: color || '#500000',
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Sync to Google Calendar in background
    syncEventToMembers(inserted.id, organization_id, 'create').catch(err => {
      console.error('[Events API] Google sync error on create:', err.message)
    })

    return NextResponse.json({ success: true, event: inserted })
  } catch (err: any) {
    console.error('[Events API] Create error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE - Delete an event and sync to Google Calendar
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const organizationId = searchParams.get('organizationId')

    if (!eventId || !organizationId) {
      return NextResponse.json({ error: 'eventId and organizationId required' }, { status: 400 })
    }

    // Sync delete to Google Calendar BEFORE deleting from DB (need the event data)
    try {
      await syncEventToMembers(eventId, organizationId, 'delete')
    } catch (err: any) {
      console.error('[Events API] Google sync error on delete:', err.message)
    }

    // Delete from DB
    const { error: deleteError } = await supabaseAdmin
      .from('org_events')
      .delete()
      .eq('id', eventId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Events API] Delete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
