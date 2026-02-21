'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

interface OrgEvent {
  id: string
  organization_id: string
  title: string
  description: string | null
  location: string | null
  start_time: string
  end_time: string
  all_day: boolean
  color: string
  org_name?: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function AllEventsPage() {
  const { user, session, loading: authLoading, joinedOrgIds } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  const [events, setEvents] = useState<OrgEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<OrgEvent | null>(null)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(true)
  const [googleConnecting, setGoogleConnecting] = useState(false)
  const [googleMessage, setGoogleMessage] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  // Check Google Calendar connection status
  useEffect(() => {
    if (!user) return
    const checkGoogle = async () => {
      const { data } = await supabase
        .from('google_calendar_tokens')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      setGoogleConnected(!!data)
      setGoogleLoading(false)
    }
    checkGoogle()
  }, [user, supabase])

  // Handle redirect params from OAuth callback
  useEffect(() => {
    const googleParam = searchParams.get('google')
    if (googleParam === 'connected') {
      setGoogleConnected(true)
      setGoogleMessage('Google Calendar connected! Your org events will sync automatically.')
      setTimeout(() => setGoogleMessage(''), 5000)
    } else if (googleParam === 'error') {
      setGoogleMessage('Failed to connect Google Calendar. Please try again.')
      setTimeout(() => setGoogleMessage(''), 5000)
    }
  }, [searchParams])

  const connectGoogle = async () => {
    if (!session) return
    setGoogleConnecting(true)
    try {
      const res = await fetch('/api/google/auth', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setGoogleMessage(data.error || 'Failed to start Google auth')
        setGoogleConnecting(false)
      }
    } catch {
      setGoogleMessage('Failed to connect. Please try again.')
      setGoogleConnecting(false)
    }
  }

  const disconnectGoogle = async () => {
    if (!session) return
    setGoogleConnecting(true)
    try {
      const res = await fetch('/api/google/disconnect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (res.ok) {
        setGoogleConnected(false)
        setGoogleMessage('Google Calendar disconnected.')
        setTimeout(() => setGoogleMessage(''), 3000)
      }
    } catch {
      setGoogleMessage('Failed to disconnect.')
    } finally {
      setGoogleConnecting(false)
    }
  }

  const fetchAllEvents = useCallback(async () => {
    if (joinedOrgIds.size === 0) { setEvents([]); setLoading(false); return }

    const orgIds = Array.from(joinedOrgIds)

    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    start.setDate(start.getDate() - 7)
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    end.setDate(end.getDate() + 7)

    const { data: eventsData, error } = await supabase
      .from('org_events')
      .select('*')
      .in('organization_id', orgIds)
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time', { ascending: true })

    if (error) { console.error('Events fetch error:', error); setLoading(false); return }

    // Get org names
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds)

    const orgMap = new Map((orgs || []).map(o => [o.id, o.name]))

    const enriched = (eventsData || []).map(e => ({
      ...e,
      org_name: orgMap.get(e.organization_id) || 'Unknown Org'
    }))

    setEvents(enriched)
    setLoading(false)
  }, [joinedOrgIds, currentDate, supabase])

  useEffect(() => { fetchAllEvents() }, [fetchAllEvents])

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const goToday = () => setCurrentDate(new Date())

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

  const getEventsForDate = (date: Date) =>
    events.filter(e => {
      const ed = new Date(e.start_time)
      return ed.getFullYear() === date.getFullYear() && ed.getMonth() === date.getMonth() && ed.getDate() === date.getDate()
    })

  const formatTime = (s: string) => new Date(s).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  // Calendar grid
  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const today = new Date()

  const calendarDays: Date[] = []
  for (let i = 0; i < firstDay; i++)
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), -firstDay + i + 1))
  for (let i = 1; i <= daysInMonth; i++)
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i))
  const remaining = 42 - calendarDays.length
  for (let i = 1; i <= remaining; i++)
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i))

  // Upcoming for list view
  const upcoming = events
    .filter(e => new Date(e.start_time) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  // Group upcoming by date
  const groupedUpcoming = upcoming.reduce((acc, e) => {
    const key = new Date(e.start_time).toDateString()
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {} as Record<string, OrgEvent[]>)

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!user) return null

  return (
    <DashboardLayout>
      {/* Google Calendar message */}
      <AnimatePresence>
        {googleMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-4 px-4 py-3 rounded-lg text-sm ${googleMessage.includes('Failed') || googleMessage.includes('error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}
          >
            {googleMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-1">Events</h2>
            <p className="text-gray-600">All upcoming events from your organizations</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Google Calendar button */}
            {!googleLoading && (
              googleConnected ? (
                <button
                  onClick={disconnectGoogle}
                  disabled={googleConnecting}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg font-medium border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {googleConnecting ? 'Disconnecting...' : 'Google Calendar Synced'}
                </button>
              ) : (
                <button
                  onClick={connectGoogle}
                  disabled={googleConnecting}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {googleConnecting ? 'Connecting...' : 'Sync to Google Calendar'}
                </button>
              )
            )}
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${view === 'calendar' ? 'bg-tamu-maroon text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${view === 'list' ? 'bg-tamu-maroon text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
            >
              List
            </button>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tamu-maroon mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading events...</p>
        </div>
      ) : joinedOrgIds.size === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h4 className="text-xl font-semibold text-gray-700 mb-2">No events yet</h4>
          <p className="text-gray-500">Join organizations to see their events here.</p>
        </div>
      ) : view === 'calendar' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h3 className="text-xl font-bold text-gray-800 min-w-[200px] text-center">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={goToday} className="text-sm text-tamu-maroon font-medium px-3 py-1 rounded-lg hover:bg-tamu-maroon/10 transition-colors">Today</button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((date, idx) => {
                const isCurrentMonth = date.getMonth() === currentDate.getMonth()
                const isToday = date.toDateString() === today.toDateString()
                const dayEvents = getEventsForDate(date)

                return (
                  <div key={idx} className={`min-h-[90px] sm:min-h-[110px] border-b border-r border-gray-100 p-1 ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}`}>
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-tamu-maroon text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className="w-full text-left px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium truncate block hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: ev.color + '20', color: ev.color }}
                        >
                          <span className="hidden sm:inline">{ev.org_name?.split(' ')[0]}: </span>
                          {ev.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      ) : (
        /* List View */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {Object.keys(groupedUpcoming).length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-500">No upcoming events from your organizations.</p>
            </div>
          ) : (
            Object.entries(groupedUpcoming).map(([dateStr, dayEvents]) => (
              <div key={dateStr}>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </h4>
                <div className="space-y-2">
                  {dayEvents.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="w-full flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-tamu-maroon/30 hover:shadow-sm transition-all text-left"
                    >
                      <div className="w-1.5 h-12 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: ev.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-gray-800">{ev.title}</p>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {!ev.all_day ? formatTime(ev.start_time) + ' - ' + formatTime(ev.end_time) : 'All day'}
                          </span>
                        </div>
                        <p className="text-xs text-tamu-maroon font-medium">{ev.org_name}</p>
                        {ev.location && <p className="text-xs text-gray-400 mt-0.5 truncate">📍 {ev.location}</p>}
                      </div>
                      <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </motion.div>
      )}

      {/* Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-1.5 h-12 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: selectedEvent.color }} />
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-800">{selectedEvent.title}</h3>
                      <p className="text-sm text-tamu-maroon font-medium mt-0.5">{selectedEvent.org_name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(selectedEvent.start_time).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      {!selectedEvent.all_day ? (
                        <p className="text-sm text-gray-500">{formatTime(selectedEvent.start_time)} — {formatTime(selectedEvent.end_time)}</p>
                      ) : (
                        <p className="text-sm text-gray-500">All day</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {selectedEvent.location && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {selectedEvent.location}
                  </div>
                )}

                {selectedEvent.description && (
                  <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">{selectedEvent.description}</p>
                )}

                {/* Add to Google Calendar link */}
                <div className="mt-5 pt-4 border-t border-gray-200">
                  <a
                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedEvent.title)}&dates=${new Date(selectedEvent.start_time).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${new Date(selectedEvent.end_time).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}&details=${encodeURIComponent((selectedEvent.org_name || '') + (selectedEvent.description ? '\n\n' + selectedEvent.description : ''))}&location=${encodeURIComponent(selectedEvent.location || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <path d="M18 3h-1V1h-2v2H9V1H7v2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2zm0 18H6V8h12v13z" fill="currentColor"/>
                    </svg>
                    Add to Google Calendar
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}
