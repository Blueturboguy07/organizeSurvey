'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'

interface Announcement {
  id: string
  organization_id: string
  title: string
  body: string
  created_at: string
  org_name: string
}

export default function NotificationBell() {
  const { session, joinedOrgIds } = useAuth()
  const supabase = createClientComponentClient()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  // Load last-read timestamp from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('announcements_last_read')
    if (stored) setLastReadAt(stored)
  }, [])

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    if (!session) return

    setLoading(true)
    try {
      const res = await fetch('/api/announcements', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAnnouncements(data.announcements || [])
        
        // Count unread
        const storedTime = localStorage.getItem('announcements_last_read')
        if (storedTime) {
          const count = (data.announcements || []).filter(
            (a: Announcement) => new Date(a.created_at) > new Date(storedTime)
          ).length
          setUnreadCount(count)
        } else {
          setUnreadCount((data.announcements || []).length)
        }
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err)
    } finally {
      setLoading(false)
    }
  }, [session])

  // Fetch on mount and when joinedOrgIds change
  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements, joinedOrgIds.size])

  // Realtime subscription for new announcements
  useEffect(() => {
    if (joinedOrgIds.size === 0) return

    const channel = supabase
      .channel('announcements-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'org_announcements'
        },
        (payload) => {
          const newAnn = payload.new as any
          // Only care if it's from an org we're in
          if (joinedOrgIds.has(newAnn.organization_id)) {
            // Refetch to get org name
            fetchAnnouncements()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, joinedOrgIds, fetchAnnouncements])

  // Mark all as read when sidebar opens
  const handleOpen = () => {
    setSidebarOpen(true)
    const now = new Date().toISOString()
    localStorage.setItem('announcements_last_read', now)
    setLastReadAt(now)
    setUnreadCount(0)
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
  }

  // Latest announcement preview (most recent one)
  const latest = announcements.length > 0 ? announcements[0] : null
  const hasUnread = unreadCount > 0

  return (
    <>
      {/* Bell + Preview */}
      <div className="relative flex items-center gap-2">
        <button
          ref={bellRef}
          onClick={handleOpen}
          className="relative p-2 text-gray-500 hover:text-tamu-maroon transition-colors rounded-lg hover:bg-gray-100"
          aria-label="Notifications"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {hasUnread && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </button>

        {/* Preview of latest announcement (only when unread) */}
        {hasUnread && latest && !sidebarOpen && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleOpen}
            className="hidden sm:flex items-center gap-2 max-w-xs bg-tamu-maroon/5 border border-tamu-maroon/10 rounded-lg px-3 py-1.5 hover:bg-tamu-maroon/10 transition-colors text-left"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-tamu-maroon truncate">{latest.org_name}</p>
              <p className="text-xs text-gray-600 truncate">{latest.title}</p>
            </div>
          </motion.button>
        )}
      </div>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/30 z-50"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <h2 className="text-lg font-bold text-white">Announcements</h2>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Announcements List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tamu-maroon"></div>
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <svg className="w-16 h-16 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <p className="text-gray-500 font-medium">No announcements yet</p>
                    <p className="text-gray-400 text-sm mt-1">Announcements from your organizations will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {announcements.map((ann, idx) => {
                      const isNew = lastReadAt ? new Date(ann.created_at) > new Date(lastReadAt) : true
                      return (
                        <motion.div
                          key={ann.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className={`px-5 py-4 hover:bg-gray-50 transition-colors ${isNew ? 'bg-tamu-maroon/5' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-tamu-maroon">{ann.org_name}</span>
                                {isNew && (
                                  <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                                )}
                              </div>
                              <h4 className="text-sm font-semibold text-gray-800 mb-1">{ann.title}</h4>
                              <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">{ann.body}</p>
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                              {timeAgo(ann.created_at)}
                            </span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
