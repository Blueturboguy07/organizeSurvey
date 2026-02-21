'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'

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
  created_by: string
  created_at: string
}

interface EventsCalendarProps {
  orgId: string
  orgName: string
  isAdmin: boolean
  sessionToken?: string
}

const COLORS = ['#500000', '#1d4ed8', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777']

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function EventsCalendar({ orgId, orgName, isAdmin, sessionToken: propToken }: EventsCalendarProps) {
  const supabase = createClientComponentClient()
  const [events, setEvents] = useState<OrgEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionToken, setSessionToken] = useState(propToken)

  // Ensure we always have a session token for API calls
  useEffect(() => {
    if (propToken) { setSessionToken(propToken); return }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionToken(data.session.access_token)
    })
  }, [propToken, supabase])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week'>('month')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEventModal, setShowEventModal] = useState<OrgEvent | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formStartTime, setFormStartTime] = useState('12:00')
  const [formEndDate, setFormEndDate] = useState('')
  const [formEndTime, setFormEndTime] = useState('13:00')
  const [formAllDay, setFormAllDay] = useState(false)
  const [formColor, setFormColor] = useState('#500000')
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Fetch events for current month range
  const fetchEvents = useCallback(async () => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    start.setDate(start.getDate() - 7)
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    end.setDate(end.getDate() + 7)

    const { data, error } = await supabase
      .from('org_events')
      .select('*')
      .eq('organization_id', orgId)
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time', { ascending: true })

    if (!error && data) setEvents(data)
    setLoading(false)
  }, [orgId, currentDate, supabase])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`events-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'org_events', filter: `organization_id=eq.${orgId}` }, () => {
        fetchEvents()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orgId, supabase, fetchEvents])

  // Calendar helpers
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const goToday = () => setCurrentDate(new Date())

  const getEventsForDate = (date: Date) => {
    return events.filter(e => {
      const eventDate = new Date(e.start_time)
      return eventDate.getFullYear() === date.getFullYear() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getDate() === date.getDate()
    })
  }

  const formatEventTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const openCreateForDate = (date: Date) => {
    if (!isAdmin) return
    const dateStr = date.toISOString().split('T')[0]
    setFormStartDate(dateStr)
    setFormEndDate(dateStr)
    setFormStartTime('12:00')
    setFormEndTime('13:00')
    setFormTitle('')
    setFormDesc('')
    setFormLocation('')
    setFormAllDay(false)
    setFormColor('#500000')
    setFormError('')
    setSelectedDate(date)
    setShowCreateModal(true)
  }

  const handleCreate = async () => {
    if (!formTitle.trim()) { setFormError('Title is required'); return }
    if (!formStartDate || !formEndDate) { setFormError('Dates are required'); return }

    setFormSaving(true)
    setFormError('')

    const startTime = formAllDay
      ? `${formStartDate}T00:00:00`
      : `${formStartDate}T${formStartTime}:00`
    const endTime = formAllDay
      ? `${formEndDate}T23:59:59`
      : `${formEndDate}T${formEndTime}:00`

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {})
        },
        body: JSON.stringify({
          organization_id: orgId,
          title: formTitle.trim(),
          description: formDesc.trim() || null,
          location: formLocation.trim() || null,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          all_day: formAllDay,
          color: formColor,
        })
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Failed to create event')
      } else {
        setShowCreateModal(false)
        fetchEvents()
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create event')
    }
    setFormSaving(false)
  }

  const handleDelete = async (eventId: string) => {
    try {
      const res = await fetch(`/api/events?eventId=${eventId}&organizationId=${orgId}`, {
        method: 'DELETE',
        headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}
      })
      if (res.ok) {
        setShowEventModal(null)
        fetchEvents()
      }
    } catch (err) {
      console.error('Delete event error:', err)
    }
  }

  // Build calendar grid
  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const today = new Date()

  const calendarDays: (Date | null)[] = []
  for (let i = 0; i < firstDay; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), -firstDay + i + 1)
    calendarDays.push(d)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i))
  }
  const remaining = 42 - calendarDays.length
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i))
  }

  // Upcoming events list
  const upcoming = events
    .filter(e => new Date(e.start_time) >= new Date())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-xl font-bold text-gray-800 min-w-[200px] text-center">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={goToday} className="text-sm text-tamu-maroon font-medium px-3 py-1 rounded-lg hover:bg-tamu-maroon/10 transition-colors">Today</button>
          </div>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openCreateForDate(new Date())}
              className="flex items-center gap-2 px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Event
            </motion.button>
          )}
        </div>

        {/* Calendar Grid */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">{d}</div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, idx) => {
              if (!date) return <div key={idx} className="min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-100" />
              const isCurrentMonth = date.getMonth() === currentDate.getMonth()
              const isToday = date.toDateString() === today.toDateString()
              const dayEvents = getEventsForDate(date)

              return (
                <div
                  key={idx}
                  onClick={() => openCreateForDate(date)}
                  className={`min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-100 p-1 transition-colors ${
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                  } ${isAdmin ? 'cursor-pointer hover:bg-tamu-maroon/5' : ''}`}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-tamu-maroon text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <button
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); setShowEventModal(ev) }}
                        className="w-full text-left px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium truncate block transition-opacity hover:opacity-80"
                        style={{ backgroundColor: ev.color + '20', color: ev.color }}
                      >
                        {!ev.all_day && <span className="hidden sm:inline">{formatEventTime(ev.start_time)} </span>}
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

        {/* Upcoming Events */}
        {upcoming.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Upcoming Events</h3>
            <div className="space-y-2">
              {upcoming.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => setShowEventModal(ev)}
                  className="w-full flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-tamu-maroon/30 transition-colors text-left"
                >
                  <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{ev.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(ev.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {!ev.all_day && ` at ${formatEventTime(ev.start_time)}`}
                    </p>
                    {ev.location && <p className="text-xs text-gray-400 truncate">📍 {ev.location}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => !formSaving && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">Create Event</h3>
                {selectedDate && (
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>

              <div className="p-5 space-y-4">
                {formError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. General Meeting"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-tamu-maroon text-sm" disabled={formSaving} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Details about the event..." rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-tamu-maroon text-sm resize-none" disabled={formSaving} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input type="text" value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="e.g. MSC Room 201"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-tamu-maroon text-sm" disabled={formSaving} />
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="allDay" checked={formAllDay} onChange={e => setFormAllDay(e.target.checked)}
                    className="w-4 h-4 text-tamu-maroon border-gray-300 rounded" disabled={formSaving} />
                  <label htmlFor="allDay" className="text-sm text-gray-700">All day event</label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input type="date" value={formStartDate} onChange={e => { setFormStartDate(e.target.value); if (!formEndDate || e.target.value > formEndDate) setFormEndDate(e.target.value) }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-tamu-maroon text-sm" disabled={formSaving} />
                  </div>
                  {!formAllDay && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                      <input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-tamu-maroon text-sm" disabled={formSaving} />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} min={formStartDate}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-tamu-maroon text-sm" disabled={formSaving} />
                  </div>
                  {!formAllDay && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                      <input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-tamu-maroon text-sm" disabled={formSaving} />
                    </div>
                  )}
                </div>

                {/* Color picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setFormColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform ${formColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c }} disabled={formSaving} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
                <button onClick={() => setShowCreateModal(false)} disabled={formSaving}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
                <motion.button onClick={handleCreate} disabled={formSaving || !formTitle.trim()}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="px-5 py-2 bg-tamu-maroon text-white rounded-lg text-sm font-medium hover:bg-tamu-maroon-light transition-colors disabled:opacity-50">
                  {formSaving ? 'Creating...' : 'Create Event'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Event Modal */}
      <AnimatePresence>
        {showEventModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowEventModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-1.5 h-12 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: showEventModal.color }} />
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-800">{showEventModal.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(showEventModal.start_time).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      {!showEventModal.all_day && (
                        <p className="text-sm text-gray-500">
                          {formatEventTime(showEventModal.start_time)} — {formatEventTime(showEventModal.end_time)}
                        </p>
                      )}
                      {showEventModal.all_day && <p className="text-sm text-gray-500">All day</p>}
                    </div>
                  </div>
                  <button onClick={() => setShowEventModal(null)} className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {showEventModal.location && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {showEventModal.location}
                  </div>
                )}

                {showEventModal.description && (
                  <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">{showEventModal.description}</p>
                )}

                {isAdmin && (
                  <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
                    <button
                      onClick={() => handleDelete(showEventModal.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete Event
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
