'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import Image from 'next/image'
import Link from 'next/link'

interface ChatMessage {
  id: string
  organization_id: string
  channel: string
  user_id: string
  user_name: string
  content: string
  reactions: Record<string, string[]>
  created_at: string
}

interface OrgInfo {
  id: string
  name: string
  bio: string | null
  club_type: string | null
}

interface MemberInfo {
  user_id: string
  name: string
  email: string
  profile_picture_url: string | null
  role: string | null
}

const CHANNELS = [
  { id: 'general', name: 'general', icon: '#', desc: 'General discussion' },
  { id: 'announcements', name: 'announcements', icon: '📢', desc: 'Org announcements' },
  { id: 'events', name: 'events', icon: '📅', desc: 'Upcoming events' },
  { id: 'random', name: 'random', icon: '💬', desc: 'Off-topic chat' },
]

const EMOJI_LIST = ['👍', '❤️', '😂', '🔥', '👀', '🎉', '💯', '😮', '👎', '🤔']
const QUICK_EMOJIS = ['😀', '😂', '😍', '🥺', '😎', '🤔', '😢', '🔥', '❤️', '👍', '👎', '🎉', '💯', '👀', '🙏', '✅', '❌', '💀', '🤝', '👋']

export default function OrgChatPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const { user, session, userProfile, loading: authLoading } = useAuth()
  const supabase = createClientComponentClient()

  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [activeChannel, setActiveChannel] = useState('general')
  const [showMembers, setShowMembers] = useState(true)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  // Fetch org info
  useEffect(() => {
    if (!orgId) return
    const fetchOrg = async () => {
      const { data } = await supabase
        .from('organizations')
        .select('id, name, bio, club_type')
        .eq('id', orgId)
        .single()
      if (!data) { router.push('/dashboard'); return }
      setOrg(data)
      setLoading(false)
    }
    fetchOrg()
  }, [orgId, supabase, router])

  // Fetch members
  useEffect(() => {
    if (!orgId) return
    const fetchMembers = async () => {
      setMembersLoading(true)
      try {
        const res = await fetch(`/api/org/members?organizationId=${orgId}`)
        if (res.ok) {
          const data = await res.json()
          const membersList = (data.members || []).map((m: any) => ({
            user_id: m.user_id,
            name: m.user_profiles?.name || 'Unknown',
            email: m.user_profiles?.email || '',
            profile_picture_url: m.user_profiles?.profile_picture_url || null,
            role: m.role || 'member'
          }))
          setMembers(membersList)
        }
      } catch (err) {
        console.error('Failed to fetch members:', err)
      } finally {
        setMembersLoading(false)
      }
    }
    fetchMembers()
  }, [orgId])

  // Fetch messages for current channel
  const fetchMessages = useCallback(async () => {
    if (!orgId) return
    setMessagesLoading(true)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('organization_id', orgId)
      .eq('channel', activeChannel)
      .order('created_at', { ascending: true })
      .limit(200)

    if (!error && data) {
      setMessages(data)
    }
    setMessagesLoading(false)
  }, [orgId, activeChannel, supabase])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Realtime subscription for messages
  useEffect(() => {
    if (!orgId) return

    const channel: RealtimeChannel = supabase
      .channel(`chat-${orgId}-${activeChannel}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `organization_id=eq.${orgId}`
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          if (newMsg.channel === activeChannel) {
            setMessages(prev => {
              // Skip if we already have it (from optimistic insert) or a temp version
              if (prev.some(m => m.id === newMsg.id)) return prev
              // Replace any temp message from same user with same content
              const withoutTemp = prev.filter(m => 
                !(m.id.startsWith('temp-') && m.user_id === newMsg.user_id && m.content === newMsg.content)
              )
              return [...withoutTemp, newMsg]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `organization_id=eq.${orgId}`
        },
        (payload) => {
          const updated = payload.new as ChatMessage
          if (updated.channel === activeChannel) {
            setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `organization_id=eq.${orgId}`
        },
        (payload) => {
          const deleted = payload.old as { id?: string }
          if (deleted?.id) {
            setMessages(prev => prev.filter(m => m.id !== deleted.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId, activeChannel, supabase])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close emoji picker on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
        setReactionPickerMsgId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Send message (optimistic)
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || !org) return

    const content = newMessage.trim()
    const tempId = `temp-${Date.now()}`
    const now = new Date().toISOString()
    setNewMessage('')

    // Optimistic insert
    const optimisticMsg: ChatMessage = {
      id: tempId,
      organization_id: orgId,
      channel: activeChannel,
      user_id: user.id,
      user_name: userProfile?.name || 'Unknown',
      content,
      reactions: {},
      created_at: now,
    }
    setMessages(prev => [...prev, optimisticMsg])

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        organization_id: orgId,
        channel: activeChannel,
        user_id: user.id,
        user_name: userProfile?.name || 'Unknown',
        content,
        reactions: {}
      })
      .select()
      .single()

    if (error) {
      console.error('Send message error:', error)
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setNewMessage(content)
    } else if (data) {
      // Replace temp message with real one
      setMessages(prev => prev.map(m => m.id === tempId ? data : m))
    }

    inputRef.current?.focus()
  }

  // Delete message (optimistic)
  const deleteMessage = async (msgId: string) => {
    // Optimistic remove
    const removedMsg = messages.find(m => m.id === msgId)
    setMessages(prev => prev.filter(m => m.id !== msgId))
    setHoveredMsgId(null)

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', msgId)

    if (error) {
      console.error('Delete error:', error)
      // Restore on failure
      if (removedMsg) {
        setMessages(prev => [...prev, removedMsg].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ))
      }
    }
  }

  // Toggle reaction (optimistic)
  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!user) return
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return

    const reactions = { ...(msg.reactions || {}) }
    const users = [...(reactions[emoji] || [])]

    if (users.includes(user.id)) {
      reactions[emoji] = users.filter(id => id !== user.id)
      if (reactions[emoji].length === 0) delete reactions[emoji]
    } else {
      reactions[emoji] = [...users, user.id]
    }

    // Optimistic update
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m))
    setReactionPickerMsgId(null)

    const { error } = await supabase
      .from('chat_messages')
      .update({ reactions })
      .eq('id', msgId)

    if (error) {
      console.error('Reaction error:', error)
      // Revert on failure
      setMessages(prev => prev.map(m => m.id === msgId ? msg : m))
    }
  }

  // Insert emoji into message input
  const insertEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji)
    setShowEmojiPicker(false)
    inputRef.current?.focus()
  }

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    if (date.toDateString() === today.toDateString()) return 'Today'
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  }

  // Group messages by date
  const getDateKey = (dateStr: string) => new Date(dateStr).toDateString()

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }
  if (!user || !org) return null

  const currentChannel = CHANNELS.find(c => c.id === activeChannel) || CHANNELS[0]

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0 z-30">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain" />
              <span className="text-lg font-bold text-tamu-maroon hidden sm:block">ORGanize</span>
            </Link>
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-semibold text-gray-800 truncate">{org.name}</span>
            <span className="text-gray-400 hidden sm:inline">/ {currentChannel.icon} {currentChannel.name}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setShowSidebar(!showSidebar)} className="md:hidden p-2 text-gray-500 hover:text-tamu-maroon rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <button onClick={() => setShowMembers(!showMembers)} className={`hidden md:flex p-2 rounded-lg transition-colors ${showMembers ? 'text-tamu-maroon bg-tamu-maroon/10' : 'text-gray-500 hover:text-tamu-maroon hover:bg-gray-100'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </button>
            <Link href="/dashboard" className="p-2 text-gray-500 hover:text-tamu-maroon rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Channel Sidebar - Desktop */}
        <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col flex-shrink-0">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-tamu-maroon text-sm truncate">{org.name}</h3>
            {org.club_type && <span className="text-xs text-gray-500">{org.club_type}</span>}
          </div>
          <div className="flex-1 overflow-y-auto py-3 px-2">
            <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider px-2 mb-2">Channels</p>
            {CHANNELS.map(ch => (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                  activeChannel === ch.id ? 'bg-tamu-maroon/10 text-tamu-maroon font-semibold' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-base leading-none w-5 text-center">{ch.icon}</span>
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
          <div className="px-3 py-3 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-tamu-maroon flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{(userProfile?.name || 'U')[0].toUpperCase()}</span>
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

        {/* Mobile Sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSidebar(false)} className="fixed inset-0 bg-black/30 z-40 md:hidden" />
              <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed top-14 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-40 flex flex-col md:hidden">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-bold text-tamu-maroon text-sm truncate">{org.name}</h3>
                </div>
                <div className="flex-1 overflow-y-auto py-3 px-2">
                  <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider px-2 mb-2">Channels</p>
                  {CHANNELS.map(ch => (
                    <button key={ch.id} onClick={() => { setActiveChannel(ch.id); setShowSidebar(false) }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${activeChannel === ch.id ? 'bg-tamu-maroon/10 text-tamu-maroon font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <span className="text-base leading-none w-5 text-center">{ch.icon}</span>
                      <span>{ch.name}</span>
                    </button>
                  ))}
                </div>
                {/* Members in mobile sidebar */}
                <div className="border-t border-gray-200 py-3 px-2 max-h-48 overflow-y-auto">
                  <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider px-2 mb-2">Members — {members.length}</p>
                  {members.map(m => (
                    <div key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600">
                      <div className="w-6 h-6 rounded-full bg-tamu-maroon/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-tamu-maroon text-[10px] font-bold">{m.name[0]?.toUpperCase()}</span>
                      </div>
                      <span className="truncate">{m.name}</span>
                    </div>
                  ))}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {messagesLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tamu-maroon"></div>
              </div>
            ) : (
              <>
                {/* Channel welcome */}
                <div className="mb-6 pb-6 border-b border-gray-100">
                  <div className="w-14 h-14 rounded-full bg-tamu-maroon/10 flex items-center justify-center mb-3">
                    <span className="text-2xl">{currentChannel.icon}</span>
                  </div>
                  <h2 className="text-gray-800 text-xl font-bold">Welcome to {currentChannel.name}!</h2>
                  <p className="text-gray-500 text-sm mt-1">This is the start of #{currentChannel.name} in {org.name}.</p>
                </div>

                {/* Messages */}
                {messages.map((msg, idx) => {
                  const prevMsg = messages[idx - 1]
                  const showDateDivider = idx === 0 || getDateKey(msg.created_at) !== getDateKey(prevMsg?.created_at)
                  const showHeader = idx === 0 ||
                    prevMsg?.user_id !== msg.user_id ||
                    showDateDivider ||
                    (new Date(msg.created_at).getTime() - new Date(prevMsg?.created_at).getTime()) > 300000

                  const reactions = msg.reactions || {}
                  const reactionEntries = Object.entries(reactions).filter(([, users]) => users.length > 0)
                  const isOwn = msg.user_id === user?.id

                  return (
                    <div key={msg.id}>
                      {showDateDivider && (
                        <div className="flex items-center gap-3 py-3 mt-2">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-gray-400 text-xs font-medium">{formatDate(msg.created_at)}</span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                      )}
                      <div
                        className={`group relative flex gap-3 px-2 -mx-2 rounded-lg transition-colors ${showHeader ? 'mt-4 pt-1' : 'mt-0.5'} hover:bg-gray-50`}
                        onMouseEnter={() => setHoveredMsgId(msg.id)}
                        onMouseLeave={() => { setHoveredMsgId(null); if (reactionPickerMsgId === msg.id) {} }}
                      >
                        {/* Avatar or timestamp gutter */}
                        {showHeader ? (
                          <div className="w-9 h-9 rounded-full bg-tamu-maroon flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-sm font-bold">{msg.user_name[0]?.toUpperCase()}</span>
                          </div>
                        ) : (
                          <div className="w-9 flex-shrink-0 flex items-center justify-center">
                            <span className="text-gray-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">{formatTime(msg.created_at)}</span>
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          {showHeader && (
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="text-tamu-maroon font-semibold text-sm">{msg.user_name}</span>
                              <span className="text-gray-400 text-xs">{formatTime(msg.created_at)}</span>
                            </div>
                          )}
                          <p className="text-gray-700 text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>

                          {/* Reactions */}
                          {reactionEntries.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {reactionEntries.map(([emoji, users]) => (
                                <button
                                  key={emoji}
                                  onClick={() => toggleReaction(msg.id, emoji)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                                    users.includes(user?.id || '')
                                      ? 'bg-tamu-maroon/10 border-tamu-maroon/30 text-tamu-maroon'
                                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-medium">{users.length}</span>
                                </button>
                              ))}
                              {/* Add reaction button */}
                              <button
                                onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Hover action bar */}
                        {hoveredMsgId === msg.id && (
                          <div className="absolute -top-3 right-2 flex items-center bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                            <button
                              onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                              className="p-1.5 text-gray-400 hover:text-tamu-maroon hover:bg-gray-50 transition-colors"
                              title="React"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                            {isOwn && (
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Reaction picker */}
                        {reactionPickerMsgId === msg.id && (
                          <div ref={emojiPickerRef} className="absolute -top-10 right-2 bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex gap-1 z-20">
                            {EMOJI_LIST.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-lg"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Message Input */}
          <div className="px-4 sm:px-6 pb-4 flex-shrink-0 relative">
            {/* Emoji Picker */}
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  ref={emojiPickerRef}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full mb-2 right-4 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-20"
                >
                  <p className="text-xs text-gray-400 font-medium mb-2">Emojis</p>
                  <div className="grid grid-cols-10 gap-1">
                    {QUICK_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSend}>
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:border-tamu-maroon/40 focus-within:ring-2 focus-within:ring-tamu-maroon/10 transition-all">
                <button type="button" className="p-3 text-gray-400 hover:text-tamu-maroon transition-colors flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
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
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-1.5 transition-colors rounded-md ${showEmojiPicker ? 'text-tamu-maroon bg-tamu-maroon/10' : 'text-gray-400 hover:text-tamu-maroon'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                  {newMessage.trim() && (
                    <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} type="submit" className="p-1.5 bg-tamu-maroon text-white rounded-lg hover:bg-tamu-maroon-light transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
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
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white border-l border-gray-200 overflow-hidden flex-shrink-0 hidden md:block"
            >
              <div className="w-[220px] h-full overflow-y-auto">
                <div className="p-4">
                  <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-3">
                    Members — {members.length}
                  </p>
                  {membersLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-tamu-maroon"></div>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {members.map(m => (
                        <div key={m.user_id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="relative flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-tamu-maroon flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{m.name[0]?.toUpperCase()}</span>
                            </div>
                            {m.user_id === user?.id && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-gray-700 text-sm truncate">{m.name}</p>
                            {m.role && m.role !== 'member' && (
                              <span className="text-[10px] text-tamu-maroon font-medium uppercase">{m.role}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
