'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import Image from 'next/image'
import Link from 'next/link'

interface Member {
  id: string
  userId: string
  joinedAt: string
  email: string
  name: string
  status: 'member'
}

interface Invitation {
  id: string
  email: string
  name: string | null
  status: 'pending' | 'expired' | 'cancelled'
  createdAt: string
  expiresAt: string
}

export default function OrgMembersPage() {
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string>('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  
  // Search/filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members')
  
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Fetch org data and members
  const fetchData = useCallback(async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        router.push('/login')
        return
      }

      if (!user.user_metadata?.is_org_account) {
        router.push('/dashboard')
        return
      }

      // Get org account
      const { data: orgAccount, error: orgAccountError } = await supabase
        .from('org_accounts')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (orgAccountError || !orgAccount) {
        setError('Organization account not found')
        setLoading(false)
        return
      }

      setOrganizationId(orgAccount.organization_id)

      // Get organization name
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgAccount.organization_id)
        .single()
      
      if (org) {
        setOrganizationName(org.name)
      }

      // Fetch members and invitations
      const response = await fetch(`/api/org/members?organizationId=${orgAccount.organization_id}`)
      const data = await response.json()
      
      if (response.ok) {
        setMembers(data.members || [])
        setInvitations(data.invitations || [])
      } else {
        setError(data.error || 'Failed to fetch members')
      }

      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Set up realtime subscriptions
  useEffect(() => {
    if (!organizationId) return

    let membersChannel: RealtimeChannel | null = null
    let invitationsChannel: RealtimeChannel | null = null

    membersChannel = supabase
      .channel(`members-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_joined_organizations',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          fetchData()
        }
      )
      .subscribe()

    invitationsChannel = supabase
      .channel(`invitations-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'org_invitations',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      if (membersChannel) supabase.removeChannel(membersChannel)
      if (invitationsChannel) supabase.removeChannel(invitationsChannel)
    }
  }, [organizationId, supabase, fetchData])

  // Handle sending invitation
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !organizationId) return

    setInviting(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/org/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || null,
          organizationId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      setSuccess(data.message || 'Invitation sent successfully!')
      setInviteEmail('')
      setInviteName('')
      setShowInviteForm(false)
      
      // Refresh data
      fetchData()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  // Handle cancelling invitation
  const handleCancelInvite = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return

    try {
      const response = await fetch(`/api/org/invite?id=${invitationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel invitation')
      }

      setSuccess('Invitation cancelled')
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Handle resending invitation
  const handleResendInvite = async (invitationId: string) => {
    try {
      const response = await fetch('/api/org/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend invitation')
      }

      setSuccess('Invitation resent!')
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Handle removing member
  const handleRemoveMember = async (membershipId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the organization?`)) return

    try {
      const response = await fetch(`/api/org/members?membershipId=${membershipId}&organizationId=${organizationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove member')
      }

      setSuccess('Member removed')
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Filter members and invitations by search term
  const filteredMembers = members.filter(
    m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         m.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredInvitations = invitations.filter(
    i => (i.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
         i.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/org/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <Image 
                  src="/logo.png" 
                  alt="ORGanize TAMU Logo" 
                  width={36}
                  height={36}
                  className="flex-shrink-0 object-contain"
                />
                <div>
                  <h1 className="text-lg font-bold text-tamu-maroon">ORGanize TAMU</h1>
                  <p className="text-xs text-gray-500">Members Management</p>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/org/dashboard"
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-tamu-maroon border border-gray-300 rounded-lg hover:border-tamu-maroon transition-colors"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-tamu-maroon border border-gray-300 rounded-lg hover:border-tamu-maroon transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Messages */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-800"
            >
              {success}
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-800"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{organizationName} Members</h2>
          <p className="text-gray-600 mt-1">Manage your organization&apos;s members and invitations</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{members.length}</p>
                <p className="text-sm text-gray-500">Active Members</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{invitations.length}</p>
                <p className="text-sm text-gray-500">Pending Invitations</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
          >
            <button
              onClick={() => setShowInviteForm(true)}
              className="w-full h-full flex items-center gap-3 text-left hover:bg-gray-50 rounded-lg transition-colors -m-4 p-4"
            >
              <div className="w-10 h-10 rounded-full bg-tamu-maroon/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-tamu-maroon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-tamu-maroon">Invite Member</p>
                <p className="text-xs text-gray-500">Send an invitation email</p>
              </div>
            </button>
          </motion.div>
        </div>

        {/* Invite Form Modal */}
        <AnimatePresence>
          {showInviteForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowInviteForm(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Invite New Member</h3>
                  <button
                    onClick={() => setShowInviteForm(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Send an invitation email to add a new member to your organization.
                </p>

                <form onSubmit={handleInvite} className="space-y-4">
                  <div>
                    <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      id="inviteEmail"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      placeholder="member@tamu.edu"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-2 focus:ring-tamu-maroon/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="inviteName" className="block text-sm font-medium text-gray-700 mb-1">
                      Name (optional)
                    </label>
                    <input
                      id="inviteName"
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-2 focus:ring-tamu-maroon/20"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInviteForm(false)}
                      className="flex-1 px-4 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={inviting || !inviteEmail.trim()}
                      className={`flex-1 px-4 py-3 bg-tamu-maroon text-white rounded-lg font-medium transition-all ${
                        inviting || !inviteEmail.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-tamu-maroon-light'
                      }`}
                    >
                      {inviting ? 'Sending...' : 'Send Invitation'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search and Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('members')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'members'
                      ? 'bg-white text-tamu-maroon shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Members ({members.length})
                </button>
                <button
                  onClick={() => setActiveTab('invitations')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'invitations'
                      ? 'bg-white text-tamu-maroon shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Pending ({invitations.length})
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-auto">
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="divide-y divide-gray-100">
            {activeTab === 'members' && (
              <>
                {filteredMembers.length === 0 ? (
                  <div className="p-8 text-center">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-gray-500">
                      {searchTerm ? 'No members match your search' : 'No members yet'}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={() => setShowInviteForm(true)}
                        className="mt-3 text-sm text-tamu-maroon hover:underline"
                      >
                        Invite your first member
                      </button>
                    )}
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-tamu-maroon/10 flex items-center justify-center">
                            <span className="text-tamu-maroon font-semibold">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{member.name}</p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </span>
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                            Member
                          </span>
                          <button
                            onClick={() => handleRemoveMember(member.id, member.name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove member"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </>
            )}

            {activeTab === 'invitations' && (
              <>
                {filteredInvitations.length === 0 ? (
                  <div className="p-8 text-center">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-500">
                      {searchTerm ? 'No invitations match your search' : 'No pending invitations'}
                    </p>
                    <button
                      onClick={() => setShowInviteForm(true)}
                      className="mt-3 text-sm text-tamu-maroon hover:underline"
                    >
                      Send an invitation
                    </button>
                  </div>
                ) : (
                  filteredInvitations.map((invitation) => {
                    const isExpired = new Date(invitation.expiresAt) < new Date()
                    return (
                      <motion.div
                        key={invitation.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">
                                {invitation.name || invitation.email}
                              </p>
                              {invitation.name && (
                                <p className="text-sm text-gray-500">{invitation.email}</p>
                              )}
                              <p className="text-xs text-gray-400">
                                Sent {new Date(invitation.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isExpired ? (
                              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                Expired
                              </span>
                            ) : (
                              <>
                                <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                                  Pending
                                </span>
                                <span className="text-xs text-gray-400">
                                  Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                                </span>
                              </>
                            )}
                            <button
                              onClick={() => handleResendInvite(invitation.id)}
                              className="p-1.5 text-gray-400 hover:text-tamu-maroon hover:bg-tamu-maroon/10 rounded-lg transition-colors"
                              title="Resend invitation"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleCancelInvite(invitation.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Cancel invitation"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </>
            )}
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Invited members will receive an email with a link to create their account.
            Once they sign up, they&apos;ll automatically join your organization.
          </p>
        </div>
      </main>
    </div>
  )
}
