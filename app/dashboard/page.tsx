'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import DashboardLayout from '@/components/DashboardLayout'
import OrgCard from '@/components/OrgCard'
import OrgChat from '@/components/OrgChat'
import Link from 'next/link'

interface JoinedOrg {
  id: string
  name: string
  bio?: string
  website?: string
  typical_majors?: string
  typical_activities?: string
  club_culture_style?: string
  meeting_frequency?: string
  meeting_times?: string
  meeting_locations?: string
  dues_required?: string
  dues_cost?: string
  application_required?: string
  time_commitment?: string
  member_count?: string
  administrative_contact_info?: string
  is_on_platform?: boolean
  application_required_bool?: boolean
  joined_at: string
}

interface PendingInvitation {
  id: string
  organizationId: string
  organizationName: string
  organizationBio: string | null
  organizationType: string | null
  invitedAs: string | null
  createdAt: string
  expiresAt: string
}

export default function MyOrgsPage() {
  const { 
    user, 
    session,
    loading: authLoading, 
    userProfile,
    userQuery,
    userQueryLoading,
    joinedOrgIds,
    joinedOrgIdsLoading
  } = useAuth()
  const router = useRouter()
  const [joinedOrgs, setJoinedOrgs] = useState<JoinedOrg[]>([])
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [orgsError, setOrgsError] = useState<string | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  
  // Pending invitations state
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
  const [invitationsLoading, setInvitationsLoading] = useState(false)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Fetch pending invitations
  const fetchInvitations = useCallback(async () => {
    if (!session) return
    
    setInvitationsLoading(true)
    try {
      const response = await fetch('/api/user/invitations', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setPendingInvitations(data.invitations || [])
      }
    } catch (error) {
      console.error('Error fetching invitations:', error)
    } finally {
      setInvitationsLoading(false)
    }
  }, [session])

  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

  // Handle accept/decline invitation
  const handleInvitationResponse = async (invitationId: string, action: 'accept' | 'decline') => {
    if (!session) return
    
    setRespondingTo(invitationId)
    try {
      const response = await fetch('/api/user/invitations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invitationId, action }),
      })

      if (response.ok) {
        // Remove from list
        setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId))
        
        // If accepted, refresh joined orgs
        if (action === 'accept') {
          // Trigger a refetch of joined orgs by updating joinedOrgIds
          window.location.reload() // Simple refresh to update all data
        }
      }
    } catch (error) {
      console.error('Error responding to invitation:', error)
    } finally {
      setRespondingTo(null)
    }
  }

  // Fetch full org details when joined org IDs change
  useEffect(() => {
    const fetchJoinedOrgs = async () => {
      if (!session || joinedOrgIds.size === 0) {
        setJoinedOrgs([])
        return
      }

      setOrgsLoading(true)
      setOrgsError(null)

      try {
        const response = await fetch('/api/orgs/joined', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch joined organizations')
        }

        const data = await response.json()
        setJoinedOrgs(data.organizations || [])
      } catch (error: any) {
        console.error('Error fetching joined orgs:', error)
        setOrgsError(error.message)
      } finally {
        setOrgsLoading(false)
      }
    }

    fetchJoinedOrgs()
  }, [session, joinedOrgIds])

  const loading = authLoading || joinedOrgIdsLoading

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!user) {
    return null
  }

  const hasQuery = !!userQuery?.latest_cleansed_query
  const hasJoinedOrgs = joinedOrgs.length > 0

  return (
    <DashboardLayout>
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Welcome back{userProfile?.name ? `, ${userProfile.name.split(' ')[0]}` : ''}!
        </h2>
        <p className="text-gray-600">
          {hasJoinedOrgs 
            ? `You've joined ${joinedOrgs.length} organization${joinedOrgs.length !== 1 ? 's' : ''}`
            : 'Start exploring and joining organizations that match your interests'}
        </p>
      </motion.div>

      {/* Pending Invitations */}
      <AnimatePresence>
        {pendingInvitations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8"
          >
            <div className="bg-gradient-to-r from-tamu-maroon/5 to-orange-50 border border-tamu-maroon/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-tamu-maroon/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-tamu-maroon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    You have {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
                  </h3>
                  <p className="text-sm text-gray-600">Organizations want you to join them!</p>
                </div>
              </div>

              <div className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <motion.div
                    key={invitation.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 truncate">
                          {invitation.organizationName}
                        </h4>
                        {invitation.organizationType && (
                          <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full mt-1">
                            {invitation.organizationType}
                          </span>
                        )}
                        {invitation.organizationBio && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {invitation.organizationBio}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Invited {new Date(invitation.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleInvitationResponse(invitation.id, 'decline')}
                          disabled={respondingTo === invitation.id}
                          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          Decline
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleInvitationResponse(invitation.id, 'accept')}
                          disabled={respondingTo === invitation.id}
                          className="px-4 py-2 text-sm bg-tamu-maroon text-white rounded-lg hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
                        >
                          {respondingTo === invitation.id ? 'Joining...' : 'Accept'}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* My Organizations */}
      <AnimatePresence mode="wait">
        {selectedOrgId ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <OrgChat
              orgId={selectedOrgId}
              orgName={joinedOrgs.find(o => o.id === selectedOrgId)?.name || 'Organization'}
              onClose={() => setSelectedOrgId(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">My Organizations</h3>
              {!hasQuery && (
                <Link href="/survey">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors"
                  >
                    Complete Survey
                  </motion.button>
                </Link>
              )}
            </div>

            {orgsLoading ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tamu-maroon mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading your organizations...</p>
              </div>
            ) : orgsError ? (
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <p className="text-red-600">{orgsError}</p>
              </div>
            ) : hasJoinedOrgs ? (
              <div className="space-y-4">
                {joinedOrgs.map((org, index) => (
                  <motion.div
                    key={org.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedOrgId(org.id)}
                    className="cursor-pointer"
                  >
                    <OrgCard org={org} showActions={false} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h4 className="text-xl font-semibold text-gray-700 mb-2">No organizations yet</h4>
                <p className="text-gray-500 mb-6">
                  {hasQuery 
                    ? "You haven't joined any organizations yet. Explore recommendations to find your perfect match!"
                    : "Complete the survey to get personalized organization recommendations."}
                </p>
                <Link href={hasQuery ? "/dashboard/explore" : "/survey"}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-colors"
                  >
                    {hasQuery ? "Explore Organizations" : "Take Survey"}
                  </motion.button>
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}
