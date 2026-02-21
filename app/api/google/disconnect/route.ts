import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCalendarClient } from '@/lib/googleCalendar'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try to delete the managed calendar from Google
    try {
      const client = await getCalendarClient(user.id)
      if (client) {
        await client.calendar.calendars.delete({ calendarId: client.calendarId })
      }
    } catch (e: any) {
      // Calendar may already be deleted - that's fine
      console.log('[Google Disconnect] Calendar delete:', e.message)
    }

    // Remove tokens from DB
    await supabaseAdmin
      .from('google_calendar_tokens')
      .delete()
      .eq('user_id', user.id)

    // Clean up google_event_id_map references for this user across all events
    // This is best-effort; stale mappings don't cause issues
    console.log(`[Google Disconnect] Disconnected user ${user.id}`)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Google Disconnect] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
