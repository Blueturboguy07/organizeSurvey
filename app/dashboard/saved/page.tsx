'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import DashboardLayout from '@/components/DashboardLayout'
import { createClientComponentClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

export default function SavedPage() {
  const { user, session, loading: authLoading, refreshSavedOrgs, refreshJoinedOrgs } = useAuth()
  const [organizations, setOrganizations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<string>('not connected')
  const supabase = createClientComponentClient()

  // Fetch saved organizations
  const fetchSavedOrgs = useCallback(async () => {
    if (!user || !session) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('🟢 Saved: Fetching saved organizations...')
      const response = await fetch('/api/organizations/saved', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch saved organizations')
      }

      const data = await response.json()
      console.log('🟢 Saved: Full API response:', JSON.stringify(data))
      console.log('🟢 Saved: Got', data.organizations?.length || 0, 'organizations')
      console.log('🟢 Saved: Debug info:', data.debug)
      setDebugInfo({ ...data.debug, fetchTime: new Date().toISOString(), responseStatus: response.status })
      setOrganizations(data.organizations || [])
    } catch (err: any) {
      console.error('🟢 Saved: Error fetching:', err)
      setError(err.message || 'Failed to load organizations')
      setOrganizations([])
    } finally {
      setLoading(false)
    }
  }, [user, session])

  // Initial fetch
  useEffect(() => {
    fetchSavedOrgs()
  }, [fetchSavedOrgs])

  // Set up real-time subscription directly on this page
  useEffect(() => {
    if (!user) return

    let channel: RealtimeChannel | null = null

    const setupSubscription = () => {
      console.log('🟢 Saved: Setting up real-time subscription...')
      channel = supabase
        .channel(`saved_orgs_page_${user.id}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'saved_organizations',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🟢 Saved: Real-time update received:', payload.eventType)
            // Refetch when changes occur
            fetchSavedOrgs()
          }
        )
        .subscribe((status) => {
          console.log('🟢 Saved: Subscription status:', status)
          setRealtimeStatus(status)
        })
    }

    setupSubscription()

    return () => {
      if (channel) {
        console.log('🟢 Saved: Cleaning up subscription')
        supabase.removeChannel(channel)
      }
    }
  }, [user, supabase, fetchSavedOrgs])

  const handleUnsave = async (orgId: string | null, orgName: string) => {
    if (!session) return

    const loadingKey = orgId || orgName
    setActionLoading(loadingKey)
    
    try {
      console.log('🟢 Saved: Unsaving organization:', orgName)
      const url = orgId 
        ? `/api/organizations/save?organizationId=${orgId}`
        : `/api/organizations/save?organizationName=${encodeURIComponent(orgName)}`
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to unsave organization')
      }

      console.log('🟢 Saved: Unsaved successfully, refreshing...')
      
      // Update AuthContext
      await refreshSavedOrgs()
      
      // Update local state immediately
      setOrganizations(prev => prev.filter(org => {
        if (orgId) return org.id !== orgId && org.id !== `saved-${orgId}`
        return org.name.toLowerCase() !== orgName.toLowerCase()
      }))
      setSelectedOrg(null)
    } catch (err: any) {
      console.error('🟢 Saved: Error unsaving:', err)
      alert('Failed to unsave organization. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleJoin = async (orgId: string) => {
    if (!session) return

    setActionLoading(orgId)
    try {
      console.log('🟢 Saved: Joining organization:', orgId)
      const response = await fetch('/api/organizations/join', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId: orgId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to join organization')
      }

      console.log('🟢 Saved: Joined successfully, refreshing...')
      
      // Update AuthContext
      await refreshJoinedOrgs()
      await refreshSavedOrgs()
      
      // Update local state - remove from saved list
      setOrganizations(prev => prev.filter(org => org.id !== orgId))
      setSelectedOrg(null)
      alert('Successfully joined organization!')
    } catch (err: any) {
      console.error('🟢 Saved: Error joining:', err)
      alert(err.message || 'Failed to join organization. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleManualRefresh = () => {
    fetchSavedOrgs()
  }

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Saved Organizations</h2>
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Debug Panel - Remove in production */}
        <div className="mb-4 p-4 bg-gray-100 rounded-lg text-xs font-mono">
          <div className="font-bold mb-2">Debug Info:</div>
          <div>User ID: {user?.id || 'not logged in'}</div>
          <div>Realtime Status: <span className={realtimeStatus === 'SUBSCRIBED' ? 'text-green-600' : 'text-yellow-600'}>{realtimeStatus}</span></div>
          <div>Organizations Count: {organizations.length}</div>
          <div>API Debug: {JSON.stringify(debugInfo)}</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        ) : organizations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-gray-600 mb-4">You haven&apos;t saved any organizations yet.</p>
            <p className="text-gray-500 text-sm">Save organizations while exploring to keep track of them!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {organizations.map((org: any, index: number) => (
              <motion.div
                key={org.id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 cursor-pointer"
                onClick={() => setSelectedOrg(org)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">{org.name}</h3>
                        {!org.is_on_platform && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                            Not on platform
                          </span>
                        )}
                        {org.auto_joined && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                            Auto-joined
                          </span>
                        )}
                      </div>
                      {org.bio && (
                        <p className="text-gray-700 text-sm leading-relaxed line-clamp-2 mb-2">{org.bio}</p>
                      )}
                      {org.saved_at && (
                        <p className="text-gray-500 text-xs">Saved {new Date(org.saved_at).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {org.is_on_platform && org.id && !org.id.startsWith('saved-') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleJoin(org.id)
                          }}
                          disabled={actionLoading === org.id}
                          className="px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
                        >
                          {actionLoading === org.id ? 'Joining...' : 'Join'}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnsave(org.is_on_platform ? org.id : null, org.name)
                        }}
                        disabled={actionLoading === (org.id || org.name)}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        Unsave
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Organization Detail Modal */}
        <AnimatePresence>
          {selectedOrg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrg(null)}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="sticky top-0 bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light p-6 text-white flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2">{selectedOrg.name}</h2>
                    {!selectedOrg.is_on_platform && (
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                        Not on platform yet
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedOrg(null)}
                    className="text-white hover:text-gray-200 text-3xl font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {selectedOrg.bio && (
                    <div>
                      <h3 className="text-lg font-semibold text-tamu-maroon mb-2">About</h3>
                      <p className="text-gray-700">{selectedOrg.bio}</p>
                    </div>
                  )}

                  {!selectedOrg.is_on_platform && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 text-sm">
                        This organization is not on the platform yet. You&apos;ll be notified when it becomes available!
                      </p>
                    </div>
                  )}

                  <div className="border-t pt-4 flex gap-4">
                    {selectedOrg.is_on_platform && selectedOrg.id && !selectedOrg.id.startsWith('saved-') && (
                      <button
                        onClick={() => handleJoin(selectedOrg.id)}
                        disabled={actionLoading === selectedOrg.id}
                        className="px-6 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
                      >
                        {actionLoading === selectedOrg.id ? 'Joining...' : 'Join Organization'}
                      </button>
                    )}
                    <button
                      onClick={() => handleUnsave(selectedOrg.is_on_platform ? selectedOrg.id : null, selectedOrg.name)}
                      disabled={actionLoading === (selectedOrg.id || selectedOrg.name)}
                      className="px-6 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === (selectedOrg.id || selectedOrg.name) ? 'Removing...' : 'Unsave'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}
