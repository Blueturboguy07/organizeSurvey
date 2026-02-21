import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { syncEventToMembers } from '@/lib/googleCalendar'

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

    const { eventId, organizationId, action } = await request.json()

    if (!eventId || !organizationId || !action) {
      return NextResponse.json({ error: 'eventId, organizationId, and action are required' }, { status: 400 })
    }

    if (!['create', 'update', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'action must be create, update, or delete' }, { status: 400 })
    }

    // Fire and don't block - sync in background
    syncEventToMembers(eventId, organizationId, action).catch(err => {
      console.error('[Google Sync] Background sync error:', err.message)
    })

    return NextResponse.json({ success: true, message: 'Sync initiated' })
  } catch (err: any) {
    console.error('[Google Sync] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
