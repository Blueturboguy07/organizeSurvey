'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'

interface Message {
  id: string
  userId: string
  userName: string
  content: string
  timestamp: Date
  isSystem?: boolean
}

interface OrgInfo {
  id: string
  name: string
  bio: string | null
  club_type: string | null
}

export default function OrgChatPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const { user, session, userProfile, loading: authLoading } = useAuth()
  const supabase = createClientComponentClient()

  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [activeChannel, setActiveChannel] = useState('general')
  const [showMembers, setShowMembers] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const channels = [
    { id: 'general', name: 'general', icon: '#', desc: 'General discussion' },
    { id: 'announcements', name: 'announcements', icon: '📢', desc: 'Org announcements' },
    { id: 'events', name: 'events', icon: '📅', desc: 'Upcoming events' },
    { id: 'random', name: 'random', icon: '💬', desc: 'Off-topic chat' },
  ]

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Fetch org info
  const fetchOrg = useCallback(async () => {
    if (!orgId) return
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, bio, club_type')
        .eq('id', orgId)
        .single()
      
      if (error || !data) {
        router.push('/dashboard')
        return
      }
      setOrg(data)
    } catch {
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }, [orgId, supabase, router])

  useEffect(() => {
    fetchOrg()
  }, [fetchOrg])

  // Set welcome message on channel change
  useEffect(() => {
    setMessages([])
  }, [activeChannel])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const msg: Message = {
      id: Date.now().toString(),
      userId: user?.id || 'me',
      userName: userProfile?.name || 'You',
      content: newMessage.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, msg])
    setNewMessage('')
    inputRef.current?.focus()
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const formatDate = (date: Date) => {
    const today = new Date()
    if (date.toDateString() === today.toDateString()) return 'Today'
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  if (!user || !org) return null

  const currentChannel = channels.find(c => c.id === activeChannel) || channels[0]

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0 z-30">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="flex-shrink-0 object-contain" />
              <span className="text-lg font-bold text-tamu-maroon hidden sm:block">ORGanize</span>
            </Link>
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-semibold text-gray-800 truncate">{org.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="md:hidden p-2 text-gray-500 hover:text-tamu-maroon rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setShowMembers(!showMembers)}
              className={`hidden md:flex p-2 rounded-lg transition-colors ${showMembers ? 'text-tamu-maroon bg-tamu-maroon/10' : 'text-gray-500 hover:text-tamu-maroon hover:bg-gray-100'}`}
              title="Members"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
            <Link
              href="/dashboard"
              className="p-2 text-gray-500 hover:text-tamu-maroon rounded-lg hover:bg-gray-100 transition-colors"
              title="Back to Dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Channel Sidebar - Desktop */}
        <aside className="hidden md:flex w-60 bg-white border-r border-gray-200 flex-col flex-shrink-0">
          {/* Org info */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-tamu-maroon text-sm truncate">{org.name}</h3>
            {org.club_type && (
              <span className="text-xs text-gray-500">{org.club_type}</span>
            )}
          </div>

          {/* Channels */}
          <div className="flex-1 overflow-y-auto py-3 px-2">
            <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider px-2 mb-2">Channels</p>
            {channels.map(channel => (
              <button
                key={channel.id}
                onClick={() => setActiveChannel(channel.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                  activeChannel === channel.id
                    ? 'bg-tamu-maroon/10 text-tamu-maroon font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <span className="text-base leading-none w-5 text-center">{channel.icon}</span>
                <span className="truncate">{channel.name}</span>
              </button>
            ))}
          </div>

          {/* User bar */}
          <div className="px-3 py-3 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-tamu-maroon flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {(userProfile?.name || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-800 text-xs font-semibold truncate">{userProfile?.name || 'User'}</p>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                <span className="text-gray-400 text-[10px]">Online</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {showSidebar && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSidebar(false)}
                className="fixed inset-0 bg-black/30 z-40 md:hidden"
              />
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed top-14 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-40 flex flex-col md:hidden"
              >
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-bold text-tamu-maroon text-sm truncate">{org.name}</h3>
                </div>
                <div className="flex-1 overflow-y-auto py-3 px-2">
                  <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider px-2 mb-2">Channels</p>
                  {channels.map(channel => (
                    <button
                      key={channel.id}
                      onClick={() => { setActiveChannel(channel.id); setShowSidebar(false) }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                        activeChannel === channel.id
                          ? 'bg-tamu-maroon/10 text-tamu-maroon font-semibold'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-base leading-none w-5 text-center">{channel.icon}</span>
                      <span>{channel.name}</span>
                    </button>
                  ))}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Channel header */}
          <div className="px-4 h-12 flex items-center border-b border-gray-100 flex-shrink-0 gap-2">
            <span className="text-tamu-maroon font-medium">{currentChannel.icon}</span>
            <span className="font-semibold text-gray-800 text-sm">{currentChannel.name}</span>
            <span className="hidden sm:inline text-gray-400 text-xs ml-2">{currentChannel.desc}</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {/* Channel welcome */}
            <div className="mb-6 pb-6 border-b border-gray-100">
              <div className="w-14 h-14 rounded-full bg-tamu-maroon/10 flex items-center justify-center mb-3">
                <span className="text-2xl">{currentChannel.icon}</span>
              </div>
              <h2 className="text-gray-800 text-xl font-bold">Welcome to {currentChannel.name}!</h2>
              <p className="text-gray-500 text-sm mt-1">
                This is the start of #{currentChannel.name} in {org.name}. Say hello!
              </p>
            </div>

            {/* Date divider */}
            {messages.length > 0 && (
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-gray-400 text-xs font-medium">{formatDate(new Date())}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}

            {/* Messages list */}
            {messages.map((msg, idx) => {
              const showHeader = idx === 0 ||
                messages[idx - 1]?.userId !== msg.userId ||
                (msg.timestamp.getTime() - messages[idx - 1]?.timestamp.getTime()) > 300000

              return (
                <div
                  key={msg.id}
                  className={`group flex gap-3 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors ${showHeader ? 'mt-5 pt-1' : 'mt-0.5'}`}
                >
                  {showHeader ? (
                    <div className="w-9 h-9 rounded-full bg-tamu-maroon flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-sm font-bold">
                        {msg.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <div className="w-9 flex-shrink-0 flex items-center justify-center">
                      <span className="text-gray-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {showHeader && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-tamu-maroon font-semibold text-sm">{msg.userName}</span>
                        <span className="text-gray-400 text-xs">{formatTime(msg.timestamp)}</span>
                      </div>
                    )}
                    <p className="text-gray-700 text-sm leading-relaxed break-words whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="px-4 sm:px-6 pb-4 flex-shrink-0">
            <form onSubmit={handleSend}>
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:border-tamu-maroon/40 focus-within:ring-2 focus-within:ring-tamu-maroon/10 transition-all">
                <button type="button" className="p-3 text-gray-400 hover:text-tamu-maroon transition-colors flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message #${activeChannel}`}
                  className="flex-1 bg-transparent text-gray-800 text-sm py-3 outline-none placeholder-gray-400"
                />
                <div className="flex items-center gap-1 pr-2 flex-shrink-0">
                  <button type="button" className="p-1.5 text-gray-400 hover:text-tamu-maroon transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  {newMessage.trim() && (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      type="submit"
                      className="p-1.5 bg-tamu-maroon text-white rounded-lg hover:bg-tamu-maroon-light transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </motion.button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </main>

        {/* Members Sidebar - Desktop */}
        <AnimatePresence>
          {showMembers && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white border-l border-gray-200 overflow-hidden flex-shrink-0 hidden md:block"
            >
              <div className="p-4 w-60">
                <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-3">Members</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-tamu-maroon flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {(userProfile?.name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-gray-700 text-sm truncate block">{userProfile?.name || 'You'}</span>
                      <span className="text-gray-400 text-[10px]">Online</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
