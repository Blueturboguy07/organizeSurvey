'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import DashboardLayout from '@/components/DashboardLayout'
import OrganizationModal from '@/components/OrganizationModal'

export default function MyOrgsPage() {
  const { user, session, joinedOrgIds } = useAuth()
  const supabase = createClientComponentClient()
  const [joinedOrgs, setJoinedOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)

  useEffect(() => {
    const fetchJoinedOrgs = async () => {
      if (!user || !session) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/orgs/joined', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          setJoinedOrgs(data.joined_orgs || [])
        }
      } catch (error) {
        console.error('Error fetching joined orgs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchJoinedOrgs()
  }, [user, session, joinedOrgIds])

  // Real-time subscription for joined orgs
  useEffect(() => {
    if (!user) return

    let channel: RealtimeChannel | null = null

    const setupSubscription = () => {
      channel = supabase
        .channel(`my-orgs-realtime-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_joined_organizations',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            // Refetch when changes occur
            if (session) {
              fetch('/api/orgs/joined', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
              })
                .then(res => res.json())
                .then(data => setJoinedOrgs(data.joined_orgs || []))
            }
          }
        )
        .subscribe()
    }

    setupSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user, session, supabase])

  const handleLeaveOrg = async (organizationId: string) => {
    if (!session) return

    const confirmed = confirm('Are you sure you want to leave this organization?')
    if (!confirmed) return

    try {
      const response = await fetch(`/api/orgs/leave?organization_id=${organizationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        setJoinedOrgs(prev => prev.filter(jo => jo.organization?.id !== organizationId))
      }
    } catch (error) {
      console.error('Error leaving org:', error)
      alert('Failed to leave organization')
    }
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-3xl font-bold text-gray-800 mb-6">My Organizations</h2>

        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your organizations...</p>
          </div>
        ) : joinedOrgs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-600 mb-4">You haven&apos;t joined any organizations yet.</p>
            <p className="text-gray-500 text-sm">Explore organizations to find ones that match your interests!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {joinedOrgs.map((jo: any, index: number) => {
              const org = jo.organization
              if (!org) return null

              return (
                <motion.div
                  key={jo.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 cursor-pointer"
                  onClick={() => setSelectedOrg(org)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-gray-800 mb-2">{org.name}</h4>
                        {org.bio && (
                          <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">{org.bio}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <span className="text-xs text-gray-500">
                        Joined {new Date(jo.joined_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleLeaveOrg(org.id)
                        }}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Leave
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {selectedOrg && (
        <OrganizationModal
          org={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          isJoined={true}
        />
      )}
    </DashboardLayout>
  )
}

