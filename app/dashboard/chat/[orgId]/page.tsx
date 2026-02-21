'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import Image from 'next/image'
import Link from 'next/link'
import EventsCalendar from '@/components/EventsCalendar'

interface ChatMessage {
  id: string
  organization_id: string
  channel: string
  user_id: string
  user_name: string
  content: string
  reactions: Record<string, string[]>
  attachment_url?: string | null
  attachment_name?: string | null
  attachment_type?: string | null
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

interface ChannelInfo {
  id: string
  name: string
  icon: string
  desc: string
  isDefault?: boolean
  dbId?: string
}

const DEFAULT_CHANNELS: ChannelInfo[] = [
  { id: 'general', name: 'general', icon: '#', desc: 'General discussion', isDefault: true },
  { id: 'announcements', name: 'announcements', icon: '📢', desc: 'Org announcements', isDefault: true },
  { id: 'events', name: 'events', icon: '📅', desc: 'Upcoming events', isDefault: true },
  { id: 'random', name: 'random', icon: '💬', desc: 'Off-topic chat', isDefault: true },
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOrgAccount, setIsOrgAccount] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [channels, setChannels] = useState<ChannelInfo[]>(DEFAULT_CHANNELS)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDesc, setNewChannelDesc] = useState('')
  const [creatingChannel, setCreatingChannel] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // Check admin status: org account owner, or admin/officer role
  useEffect(() => {
    if (!orgId || !user) return
    const checkAdmin = async () => {
      // Check if org account owner (may 406 if RLS blocks, that's fine)
      try {
        const { data: orgAcct } = await supabase
          .from('org_accounts')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', orgId)
          .maybeSingle()
        
        if (orgAcct) {
          setIsOrgAccount(true)
          setIsAdmin(true)
          return
        }
      } catch {
        // RLS blocks non-org users from reading org_accounts — expected
      }

      // Check member role directly via DB
      try {
        const { data: membership } = await supabase
          .from('user_joined_organizations')
          .select('role')
          .eq('user_id', user.id)
          .eq('organization_id', orgId)
          .maybeSingle()

        if (membership && (membership.role === 'officer' || membership.role === 'admin')) {
          setIsAdmin(true)
        }
      } catch {
        // RLS may block — expected for some users
      }
    }
    checkAdmin()
  }, [orgId, user, supabase])

  // Fetch members for sidebar display
  useEffect(() => {
    if (!orgId) return
    const fetchMembers = async () => {
      setMembersLoading(true)
      try {
        const res = await fetch(`/api/org/members?organizationId=${orgId}&_t=${Date.now()}`)
        if (res.ok) {
          const data = await res.json()
          console.log('[Chat] Raw members API response:', JSON.stringify(data.members?.slice(0, 5), null, 2))

          const membersList = (data.members || []).map((m: any) => ({
            user_id: m.userId || m.user_id,
            name: m.name || m.user_profiles?.name || 'Unknown',
            email: m.email || m.user_profiles?.email || '',
            profile_picture_url: m.profilePicture || m.user_profiles?.profile_picture_url || null,
            role: m.role || 'member'
          }))

          setMembers(membersList)
        } else {
          const errText = await res.text()
          console.error('[Chat] Members API error:', res.status, errText)
        }
      } catch (err) {
        console.error('Failed to fetch members:', err)
      } finally {
        setMembersLoading(false)
      }
    }
    fetchMembers()
  }, [orgId])

  // Fetch custom channels for this org
  const fetchChannels = useCallback(async () => {
    if (!orgId) return
    const { data } = await supabase
      .from('org_channels')
      .select('id, name, icon, description')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })

    const custom: ChannelInfo[] = (data || []).map(ch => ({
      id: ch.name,
      name: ch.name,
      icon: ch.icon || '#',
      desc: ch.description || '',
      dbId: ch.id,
    }))
    setChannels([...DEFAULT_CHANNELS, ...custom])
  }, [orgId, supabase])

  useEffect(() => { fetchChannels() }, [fetchChannels])

  // Realtime for channel changes
  useEffect(() => {
    if (!orgId) return
    const ch = supabase
      .channel(`channels-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'org_channels', filter: `organization_id=eq.${orgId}` }, () => fetchChannels())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [orgId, supabase, fetchChannels])

  // Create channel
  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !user) return
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!name) return
    if (channels.some(c => c.name === name)) { setShowCreateChannel(false); return }

    setCreatingChannel(true)
    const { error } = await supabase
      .from('org_channels')
      .insert({ organization_id: orgId, name, icon: '#', description: newChannelDesc.trim() || null, created_by: user.id })

    if (!error) {
      setNewChannelName('')
      setNewChannelDesc('')
      setShowCreateChannel(false)
      fetchChannels()
    } else {
      console.error('Create channel error:', error)
    }
    setCreatingChannel(false)
  }

  // Delete channel
  const handleDeleteChannel = async (dbId: string) => {
    const { error } = await supabase.from('org_channels').delete().eq('id', dbId)
    if (!error) {
      setActiveChannel('general')
      fetchChannels()
    }
  }

  // Fetch messages for current channel
  const fetchMessages = useCallback(async (showLoader = true) => {
    if (!orgId) return
    if (showLoader) setMessagesLoading(true)
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
    if (showLoader) setMessagesLoading(false)
  }, [orgId, activeChannel, supabase])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Page Visibility API - refetch when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMessages(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchMessages])

  // Background polling fallback - catch missed updates every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMessages(false)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  // Realtime subscription for messages with error handling & reconnection
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
              if (prev.some(m => m.id === newMsg.id)) return prev
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
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Chat] Realtime subscribed: ${orgId}/${activeChannel}`)
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[Chat] Realtime error: ${status}`, err)
          // Refetch to catch up on any missed messages
          fetchMessages(false)
        }
        if (status === 'CLOSED') {
          console.log(`[Chat] Realtime closed: ${orgId}/${activeChannel}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId, activeChannel, supabase, fetchMessages])

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

  // Upload file to Supabase storage
  const uploadFile = async (file: File): Promise<{ url: string; name: string; type: string } | null> => {
    const fileExt = file.name.split('.').pop()
    const filePath = `${orgId}/${activeChannel}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, file)

    if (error) {
      console.error('File upload error:', error)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(filePath)

    return {
      url: urlData.publicUrl,
      name: file.name,
      type: file.type,
    }
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert('File must be under 10MB')
      return
    }
    setPendingFile(file)
    inputRef.current?.focus()
  }

  // Send message (optimistic)
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && !pendingFile) || !user || !org) return

    const content = newMessage.trim() || (pendingFile ? `📎 ${pendingFile.name}` : '')
    const tempId = `temp-${Date.now()}`
    const now = new Date().toISOString()
    const fileToUpload = pendingFile
    setNewMessage('')
    setPendingFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''

    // Optimistic insert
    const optimisticMsg: ChatMessage = {
      id: tempId,
      organization_id: orgId,
      channel: activeChannel,
      user_id: user.id,
      user_name: userProfile?.name || 'Unknown',
      content,
      reactions: {},
      attachment_name: fileToUpload?.name || null,
      attachment_type: fileToUpload?.type || null,
      created_at: now,
    }
    setMessages(prev => [...prev, optimisticMsg])

    // Upload file if present
    let attachment: { url: string; name: string; type: string } | null = null
    if (fileToUpload) {
      setUploading(true)
      attachment = await uploadFile(fileToUpload)
      setUploading(false)
    }

    const insertData: any = {
      organization_id: orgId,
      channel: activeChannel,
      user_id: user.id,
      user_name: userProfile?.name || 'Unknown',
      content: newMessage.trim() || (attachment ? `📎 ${attachment.name}` : content),
      reactions: {},
    }

    if (attachment) {
      insertData.attachment_url = attachment.url
      insertData.attachment_name = attachment.name
      insertData.attachment_type = attachment.type
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Send message error:', error)
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setNewMessage(content)
    } else if (data) {
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

  const currentChannel = channels.find(c => c.id === activeChannel) || channels[0]

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
            <div className="flex items-center justify-between px-2 mb-2">
              <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Channels</p>
              {(isAdmin || isOrgAccount) && (
                <button onClick={() => setShowCreateChannel(true)} className="text-gray-400 hover:text-tamu-maroon transition-colors" title="Add channel">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              )}
            </div>
            {channels.map(ch => (
              <div key={ch.id} className="group flex items-center mb-0.5">
                <button
                  onClick={() => setActiveChannel(ch.id)}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeChannel === ch.id ? 'bg-tamu-maroon/10 text-tamu-maroon font-semibold' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-base leading-none w-5 text-center">{ch.icon}</span>
                  <span className="truncate">{ch.name}</span>
                </button>
                {!ch.isDefault && ch.dbId && (isAdmin || isOrgAccount) && (
                  <button
                    onClick={() => handleDeleteChannel(ch.dbId!)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                    title="Delete channel"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}

            {/* Create channel inline form */}
            <AnimatePresence>
              {showCreateChannel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-2 px-1"
                >
                  <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                    <input
                      type="text"
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                      placeholder="channel-name"
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-tamu-maroon mb-1.5"
                      autoFocus
                      disabled={creatingChannel}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateChannel(); if (e.key === 'Escape') setShowCreateChannel(false) }}
                    />
                    <input
                      type="text"
                      value={newChannelDesc}
                      onChange={e => setNewChannelDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-tamu-maroon mb-2"
                      disabled={creatingChannel}
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleCreateChannel}
                        disabled={creatingChannel || !newChannelName.trim()}
                        className="flex-1 px-2 py-1 bg-tamu-maroon text-white text-xs rounded font-medium hover:bg-tamu-maroon-light disabled:opacity-50 transition-colors"
                      >
                        {creatingChannel ? '...' : 'Create'}
                      </button>
                      <button
                        onClick={() => { setShowCreateChannel(false); setNewChannelName(''); setNewChannelDesc('') }}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                  {channels.map(ch => (
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
          {activeChannel === 'events' ? (
            <EventsCalendar orgId={orgId} orgName={org.name} isAdmin={isAdmin || isOrgAccount} sessionToken={session?.access_token} />
          ) : (
          <>
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
                  const canDelete = isOwn || isAdmin

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
                              {(() => {
                                const member = members.find(m => m.user_id === msg.user_id)
                                const role = member?.role
                                if (role === 'admin' || role === 'officer') {
                                  return (
                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                      role === 'admin' ? 'bg-tamu-maroon/10 text-tamu-maroon' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {role}
                                    </span>
                                  )
                                }
                                // Check if this user is the org account
                                if (!member && isOrgAccount && msg.user_id === user?.id) {
                                  return <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-tamu-maroon/10 text-tamu-maroon">org</span>
                                }
                                return null
                              })()}
                              <span className="text-gray-400 text-xs">{formatTime(msg.created_at)}</span>
                            </div>
                          )}
                          {msg.content && <p className="text-gray-700 text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>}

                          {/* Attachment */}
                          {msg.attachment_url && (
                            <div className="mt-1.5">
                              {msg.attachment_type?.startsWith('image/') ? (
                                <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block">
                                  <img 
                                    src={msg.attachment_url} 
                                    alt={msg.attachment_name || 'Image'} 
                                    className="max-w-xs max-h-64 rounded-lg border border-gray-200 hover:border-tamu-maroon/40 transition-colors cursor-pointer"
                                  />
                                </a>
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-tamu-maroon/40 hover:bg-gray-100 transition-colors text-sm"
                                >
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  <span className="text-tamu-maroon font-medium truncate max-w-[200px]">{msg.attachment_name || 'Download'}</span>
                                </a>
                              )}
                            </div>
                          )}

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
                            {canDelete && (
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title={isOwn ? 'Delete' : 'Delete (Admin)'}
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
            {activeChannel === 'announcements' && !isAdmin && !isOrgAccount ? (
              <div className="flex items-center justify-center py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Only admins and org accounts can post in announcements
              </div>
            ) : (
            <>
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

            {/* Pending file preview */}
            {pendingFile && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {pendingFile.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(pendingFile)} alt="" className="h-16 rounded border border-gray-200" />
                ) : (
                  <span className="text-sm text-gray-700 truncate">{pendingFile.name}</span>
                )}
                <span className="text-xs text-gray-400">({(pendingFile.size / 1024).toFixed(0)}KB)</span>
                <button
                  onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="ml-auto p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.pptx,.zip"
            />

            <form onSubmit={handleSend}>
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:border-tamu-maroon/40 focus-within:ring-2 focus-within:ring-tamu-maroon/10 transition-all">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-gray-400 hover:text-tamu-maroon transition-colors flex-shrink-0"
                  title="Attach file"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={uploading ? 'Uploading file...' : `Message #${activeChannel}`}
                  className="flex-1 bg-transparent text-gray-800 text-sm py-3 outline-none placeholder-gray-400"
                  disabled={uploading}
                />
                <div className="flex items-center gap-1 pr-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-1.5 transition-colors rounded-md ${showEmojiPicker ? 'text-tamu-maroon bg-tamu-maroon/10' : 'text-gray-400 hover:text-tamu-maroon'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                  {(newMessage.trim() || pendingFile) && (
                    <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} type="submit" disabled={uploading} className="p-1.5 bg-tamu-maroon text-white rounded-lg hover:bg-tamu-maroon-light transition-colors disabled:opacity-50">
                      {uploading ? (
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      )}
                    </motion.button>
                  )}
                </div>
              </div>
            </form>
            </>
            )}
          </div>
          </>
          )}
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
                  {/* Admins/Officers section */}
                  {(() => {
                    const admins = members.filter(m => m.role === 'admin' || m.role === 'officer')
                    const regularMembers = members.filter(m => m.role !== 'admin' && m.role !== 'officer')
                    
                    return membersLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-tamu-maroon"></div>
                      </div>
                    ) : (
                      <>
                        {admins.length > 0 && (
                          <>
                            <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2">
                              Staff — {admins.length}
                            </p>
                            <div className="space-y-0.5 mb-4">
                              {admins.map(m => (
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
                                    <span className={`text-[10px] font-bold uppercase ${
                                      m.role === 'admin' ? 'text-tamu-maroon' : 'text-blue-600'
                                    }`}>{m.role}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2">
                          Members — {regularMembers.length}
                        </p>
                        <div className="space-y-0.5">
                          {regularMembers.map(m => (
                            <div key={m.user_id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                              <div className="relative flex-shrink-0">
                                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-gray-600 text-xs font-bold">{m.name[0]?.toUpperCase()}</span>
                                </div>
                                {m.user_id === user?.id && (
                                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-gray-700 text-sm truncate">{m.name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
