import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { supabaseAdmin } from '@/lib/supabase'
import { getOAuth2Client, initialSyncForUser } from '@/lib/googleCalendar'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // user ID
    const error = searchParams.get('error')

    if (error) {
      console.error('[Google Callback] OAuth error:', error)
      return NextResponse.redirect(new URL('/dashboard/events?google=error', request.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/dashboard/events?google=error', request.url))
    }

    const userId = state

    // Verify user exists
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (!user) {
      return NextResponse.redirect(new URL('/dashboard/events?google=error', request.url))
    }

    // Exchange code for tokens
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('[Google Callback] Missing tokens')
      return NextResponse.redirect(new URL('/dashboard/events?google=error', request.url))
    }

    // Create a secondary calendar "ORGanize Events"
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    let calendarId: string

    // Check if we already have a record (reconnecting)
    const { data: existing } = await supabaseAdmin
      .from('google_calendar_tokens')
      .select('calendar_id')
      .eq('user_id', userId)
      .single()

    if (existing?.calendar_id) {
      // Try to use existing calendar
      try {
        await calendar.calendars.get({ calendarId: existing.calendar_id })
        calendarId = existing.calendar_id
      } catch {
        // Calendar was deleted, create new one
        const newCal = await calendar.calendars.insert({
          requestBody: {
            summary: 'ORGanize Events',
            description: 'Events from your ORGanize Campus organizations',
            timeZone: 'America/Chicago',
          },
        })
        calendarId = newCal.data.id!
      }
    } else {
      // Create fresh calendar
      const newCal = await calendar.calendars.insert({
        requestBody: {
          summary: 'ORGanize Events',
          description: 'Events from your ORGanize Campus organizations',
          timeZone: 'America/Chicago',
        },
      })
      calendarId = newCal.data.id!
    }

    // Store tokens
    await supabaseAdmin
      .from('google_calendar_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date || null,
        calendar_id: calendarId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    // Initial sync: push all future events to the new calendar
    try {
      await initialSyncForUser(userId, calendarId)
    } catch (syncErr: any) {
      console.error('[Google Callback] Initial sync error:', syncErr.message)
    }

    console.log(`[Google Callback] Successfully connected for user ${userId}, calendar ${calendarId}`)

    return NextResponse.redirect(new URL('/dashboard/events?google=connected', request.url))
  } catch (err: any) {
    console.error('[Google Callback] Error:', err)
    return NextResponse.redirect(new URL('/dashboard/events?google=error', request.url))
  }
}
