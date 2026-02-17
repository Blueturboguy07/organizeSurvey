'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'

interface Message {
  id: string
  userId: string
  userName: string
  content: string
  timestamp: Date
  isSystem?: boolean
}

interface OrgChatProps {
  orgId: string
  orgName: string
  onClose: () => void
}

export default function OrgChat({ orgId, orgName, onClose }: OrgChatProps) {
  const { userProfile } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [activeChannel, setActiveChannel] = useState('general')
  const [showMembers, setShowMembers] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const channels = [
    { id: 'general', name: 'general', icon: '#' },
    { id: 'announcements', name: 'announcements', icon: '📢' },
    { id: 'events', name: 'events', icon: '📅' },
    { id: 'random', name: 'random', icon: '#' },
  ]

  // Placeholder messages
  useEffect(() => {
    setMessages([
      {
        id: '1',
        userId: 'system',
        userName: 'System',
        content: `Welcome to #${activeChannel}! This is the beginning of the conversation.`,
        timestamp: new Date(),
        isSystem: true,
      }
    ])
  }, [activeChannel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const msg: Message = {
      id: Date.now().toString(),
      userId: 'me',
      userName: userProfile?.name || 'You',
      content: newMessage.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, msg])
    setNewMessage('')
    inputRef.current?.focus()
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (date: Date) => {
    const today = new Date()
    if (date.toDateString() === today.toDateString()) return 'Today'
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-[#313338] rounded-xl overflow-hidden shadow-2xl flex flex-col"
      style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}
    >
      {/* Top Bar */}
      <div className="bg-[#2b2d31] px-4 h-12 flex items-center justify-between border-b border-[#1e1f22] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#80848e] text-lg">#</span>
          <span className="text-white font-semibold truncate">{activeChannel}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className={`p-1.5 rounded transition-colors ${showMembers ? 'text-white bg-[#404249]' : 'text-[#b5bac1] hover:text-white'}`}
            title="Members"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#b5bac1] hover:text-white transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Channel Sidebar */}
        <div className="w-56 bg-[#2b2d31] flex flex-col flex-shrink-0 border-r border-[#1e1f22] hidden md:flex">
          {/* Org Name Header */}
          <div className="px-3 h-12 flex items-center border-b border-[#1e1f22]">
            <h3 className="text-white font-bold text-sm truncate">{orgName}</h3>
          </div>

          {/* Channels */}
          <div className="flex-1 overflow-y-auto pt-3 px-2">
            <p className="text-[#949ba4] text-[11px] font-bold uppercase tracking-wide px-2 mb-1">Text Channels</p>
            {channels.map(channel => (
              <button
                key={channel.id}
                onClick={() => setActiveChannel(channel.id)}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors mb-0.5 ${
                  activeChannel === channel.id
                    ? 'bg-[#404249] text-white'
                    : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]'
                }`}
              >
                <span className="text-base leading-none w-5 text-center">{channel.icon}</span>
                <span className="truncate">{channel.name}</span>
              </button>
            ))}
          </div>

          {/* User Info Bar */}
          <div className="px-2 py-2 bg-[#232428] flex items-center gap-2 border-t border-[#1e1f22]">
            <div className="w-8 h-8 rounded-full bg-tamu-maroon flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {(userProfile?.name || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold truncate">{userProfile?.name || 'User'}</p>
              <p className="text-[#949ba4] text-[10px] truncate">Online</p>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile Channel Selector */}
          <div className="md:hidden flex gap-1 px-3 py-2 bg-[#2b2d31] border-b border-[#1e1f22] overflow-x-auto">
            {channels.map(channel => (
              <button
                key={channel.id}
                onClick={() => setActiveChannel(channel.id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeChannel === channel.id
                    ? 'bg-[#404249] text-white'
                    : 'text-[#949ba4] hover:text-white'
                }`}
              >
                <span>{channel.icon}</span>
                {channel.name}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {/* Channel Welcome */}
            <div className="mb-6">
              <div className="w-16 h-16 rounded-full bg-[#404249] flex items-center justify-center mb-3">
                <span className="text-3xl text-[#80848e]">#</span>
              </div>
              <h2 className="text-white text-2xl font-bold">Welcome to #{activeChannel}!</h2>
              <p className="text-[#949ba4] text-sm mt-1">
                This is the start of the #{activeChannel} channel in {orgName}.
              </p>
              <div className="h-px bg-[#3f4147] mt-4" />
            </div>

            {/* Date Divider */}
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 h-px bg-[#3f4147]" />
              <span className="text-[#949ba4] text-xs font-semibold">{formatDate(new Date())}</span>
              <div className="flex-1 h-px bg-[#3f4147]" />
            </div>

            {/* Messages */}
            {messages.filter(m => !m.isSystem).map((msg, idx) => {
              const showHeader = idx === 0 || 
                messages[idx - 1]?.userId !== msg.userId ||
                (msg.timestamp.getTime() - messages[idx - 1]?.timestamp.getTime()) > 300000

              return (
                <div
                  key={msg.id}
                  className={`group flex gap-3 hover:bg-[#2e3035] rounded px-1 -mx-1 ${showHeader ? 'mt-4 pt-1' : ''}`}
                >
                  {showHeader ? (
                    <div className="w-10 h-10 rounded-full bg-tamu-maroon flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-sm font-bold">
                        {msg.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <div className="w-10 flex-shrink-0 flex items-center justify-center">
                      <span className="text-[#949ba4] text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {showHeader && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-white font-semibold text-sm hover:underline cursor-pointer">
                          {msg.userName}
                        </span>
                        <span className="text-[#949ba4] text-xs">
                          {formatDate(msg.timestamp)} at {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <p className="text-[#dbdee1] text-sm leading-relaxed break-words whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="px-4 pb-4 flex-shrink-0">
            <form onSubmit={handleSend} className="relative">
              <div className="flex items-center bg-[#383a40] rounded-lg">
                {/* Attach Button */}
                <button
                  type="button"
                  className="p-3 text-[#b5bac1] hover:text-[#dbdee1] transition-colors flex-shrink-0"
                >
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
                  className="flex-1 bg-transparent text-[#dbdee1] text-sm py-2.5 outline-none placeholder-[#6d6f78]"
                />

                {/* Emoji/GIF Buttons */}
                <div className="flex items-center gap-1 pr-2 flex-shrink-0">
                  <button
                    type="button"
                    className="p-1.5 text-[#b5bac1] hover:text-[#dbdee1] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  {newMessage.trim() && (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      type="submit"
                      className="p-1.5 text-white bg-tamu-maroon rounded-md hover:bg-tamu-maroon-light transition-colors"
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
        </div>

        {/* Members Sidebar */}
        <AnimatePresence>
          {showMembers && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#2b2d31] border-l border-[#1e1f22] overflow-hidden flex-shrink-0 hidden md:block"
            >
              <div className="p-3 w-60">
                <p className="text-[#949ba4] text-[11px] font-bold uppercase tracking-wide mb-2">
                  Members — coming soon
                </p>
                <div className="space-y-1">
                  {/* Current user */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#35373c] transition-colors">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-tamu-maroon flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {(userProfile?.name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#23a559] rounded-full border-2 border-[#2b2d31]" />
                    </div>
                    <span className="text-[#949ba4] text-sm truncate">{userProfile?.name || 'You'}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
