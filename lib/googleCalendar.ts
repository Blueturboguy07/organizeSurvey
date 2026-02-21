import { google, calendar_v3 } from 'googleapis'
import { supabaseAdmin } from '@/lib/supabase'

const SCOPES = ['https://www.googleapis.com/auth/calendar']

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export function getAuthUrl(state: string) {
  const oauth2Client = getOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  })
}

// Get an authenticated calendar client for a specific user
export async function getCalendarClient(userId: string): Promise<{ calendar: calendar_v3.Calendar; calendarId: string } | null> {
  const { data: tokenRow, error } = await supabaseAdmin
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !tokenRow) return null

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: tokenRow.expiry_date,
  })

  // Auto-refresh: listen for new tokens and persist them
  oauth2Client.on('tokens', async (tokens) => {
    const update: Record<string, any> = { updated_at: new Date().toISOString() }
    if (tokens.access_token) update.access_token = tokens.access_token
    if (tokens.expiry_date) update.expiry_date = tokens.expiry_date
    if (tokens.refresh_token) update.refresh_token = tokens.refresh_token

    await supabaseAdmin
      .from('google_calendar_tokens')
      .update(update)
      .eq('user_id', userId)
  })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  return { calendar, calendarId: tokenRow.calendar_id }
}

// Sync a single org event to all connected members of that org
export async function syncEventToMembers(
  eventId: string,
  organizationId: string,
  action: 'create' | 'update' | 'delete'
) {
  // Get the org event
  const { data: orgEvent } = await supabaseAdmin
    .from('org_events')
    .select('*')
    .eq('id', eventId)
    .single()

  // Get org name
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single()

  const orgName = org?.name || 'Organization'

  // Get all members of the org
  const { data: members } = await supabaseAdmin
    .from('user_joined_organizations')
    .select('user_id')
    .eq('organization_id', organizationId)

  // Also include the org account owner
  const { data: orgAccount } = await supabaseAdmin
    .from('org_accounts')
    .select('user_id')
    .eq('organization_id', organizationId)
    .single()

  const allUserIds = new Set<string>()
  ;(members || []).forEach(m => allUserIds.add(m.user_id))
  if (orgAccount) allUserIds.add(orgAccount.user_id)

  // Get all connected users from this set
  const { data: connectedUsers } = await supabaseAdmin
    .from('google_calendar_tokens')
    .select('user_id, calendar_id')
    .in('user_id', Array.from(allUserIds))

  if (!connectedUsers || connectedUsers.length === 0) return

  const googleEventIdMap: Record<string, string> = orgEvent?.google_event_id_map || {}

  for (const cu of connectedUsers) {
    try {
      const client = await getCalendarClient(cu.user_id)
      if (!client) continue

      if (action === 'delete') {
        const googleEventId = googleEventIdMap[cu.user_id]
        if (googleEventId) {
          try {
            await client.calendar.events.delete({
              calendarId: client.calendarId,
              eventId: googleEventId,
            })
          } catch (e: any) {
            if (e?.code !== 404 && e?.code !== 410) console.error(`[GCal] Delete failed for ${cu.user_id}:`, e.message)
          }
          delete googleEventIdMap[cu.user_id]
        }
      } else if (orgEvent) {
        const eventBody: calendar_v3.Schema$Event = {
          summary: `[${orgName}] ${orgEvent.title}`,
          description: orgEvent.description || undefined,
          location: orgEvent.location || undefined,
          start: orgEvent.all_day
            ? { date: orgEvent.start_time.split('T')[0] }
            : { dateTime: orgEvent.start_time, timeZone: 'America/Chicago' },
          end: orgEvent.all_day
            ? { date: orgEvent.end_time.split('T')[0] }
            : { dateTime: orgEvent.end_time, timeZone: 'America/Chicago' },
        }

        const existingGoogleId = googleEventIdMap[cu.user_id]

        if (action === 'update' && existingGoogleId) {
          try {
            await client.calendar.events.update({
              calendarId: client.calendarId,
              eventId: existingGoogleId,
              requestBody: eventBody,
            })
          } catch (e: any) {
            // If update fails (deleted externally), re-create
            if (e?.code === 404 || e?.code === 410) {
              const created = await client.calendar.events.insert({
                calendarId: client.calendarId,
                requestBody: eventBody,
              })
              if (created.data.id) googleEventIdMap[cu.user_id] = created.data.id
            } else {
              console.error(`[GCal] Update failed for ${cu.user_id}:`, e.message)
            }
          }
        } else {
          // Create
          const created = await client.calendar.events.insert({
            calendarId: client.calendarId,
            requestBody: eventBody,
          })
          if (created.data.id) googleEventIdMap[cu.user_id] = created.data.id
        }
      }
    } catch (err: any) {
      console.error(`[GCal] Sync error for user ${cu.user_id}:`, err.message)
    }
  }

  // Persist the updated mapping (skip if delete and event is gone)
  if (action !== 'delete') {
    await supabaseAdmin
      .from('org_events')
      .update({ google_event_id_map: googleEventIdMap })
      .eq('id', eventId)
  }
}

// Bulk sync all events for a user who just connected (initial sync)
export async function initialSyncForUser(userId: string, calendarId: string) {
  const client = await getCalendarClient(userId)
  if (!client) return

  // Get all orgs the user is in
  const { data: memberships } = await supabaseAdmin
    .from('user_joined_organizations')
    .select('organization_id')
    .eq('user_id', userId)

  const orgIds = (memberships || []).map(m => m.organization_id)

  // Also check if user is an org account
  const { data: orgAccount } = await supabaseAdmin
    .from('org_accounts')
    .select('organization_id')
    .eq('user_id', userId)
    .single()

  if (orgAccount && !orgIds.includes(orgAccount.organization_id)) {
    orgIds.push(orgAccount.organization_id)
  }

  if (orgIds.length === 0) return

  // Get org names
  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name')
    .in('id', orgIds)

  const orgNameMap = new Map((orgs || []).map(o => [o.id, o.name]))

  // Get all future events
  const { data: events } = await supabaseAdmin
    .from('org_events')
    .select('*')
    .in('organization_id', orgIds)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })

  if (!events || events.length === 0) return

  for (const ev of events) {
    try {
      const orgName = orgNameMap.get(ev.organization_id) || 'Organization'
      const eventBody: calendar_v3.Schema$Event = {
        summary: `[${orgName}] ${ev.title}`,
        description: ev.description || undefined,
        location: ev.location || undefined,
        start: ev.all_day
          ? { date: ev.start_time.split('T')[0] }
          : { dateTime: ev.start_time, timeZone: 'America/Chicago' },
        end: ev.all_day
          ? { date: ev.end_time.split('T')[0] }
          : { dateTime: ev.end_time, timeZone: 'America/Chicago' },
      }

      const created = await client.calendar.events.insert({
        calendarId: client.calendarId,
        requestBody: eventBody,
      })

      if (created.data.id) {
        const map = ev.google_event_id_map || {}
        map[userId] = created.data.id
        await supabaseAdmin
          .from('org_events')
          .update({ google_event_id_map: map })
          .eq('id', ev.id)
      }
    } catch (err: any) {
      console.error(`[GCal] Initial sync error for event ${ev.id}:`, err.message)
    }
  }
}
