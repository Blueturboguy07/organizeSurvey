'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import DashboardLayout from '@/components/DashboardLayout'

export default function SavedPage() {
  const { user, session, loading: authLoading, refreshSavedOrgs, refreshJoinedOrgs, savedOrgIdsVersion } = useAuth()
  const [organizations, setOrganizations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    const fetchSavedOrgs = async () => {
      if (!user || !session) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
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
        console.log('Saved organizations data:', data)
        setOrganizations(data.organizations || [])
      } catch (err: any) {
        console.error('Error fetching saved organizations:', err)
        setError(err.message || 'Failed to load organizations')
        setOrganizations([])
      } finally {
        setLoading(false)
      }
    }

    fetchSavedOrgs()
  }, [user, session, refreshSavedOrgs, savedOrgIdsVersion]) // Refetch when saved orgs change (version increments on change)

  const handleUnsave = async (orgId: string | null, orgName: string) => {
    if (!session) return

    setActionLoading(orgId || orgName)
    try {
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

      // Refresh saved orgs from context - this will trigger the useEffect to refetch
      await refreshSavedOrgs()
      setSelectedOrg(null)
    } catch (err: any) {
      console.error('Error unsaving organization:', err)
      alert('Failed to unsave organization. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleJoin = async (orgId: string) => {
    if (!session) return

    setActionLoading(orgId)
    try {
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

      // Refresh joined and saved orgs - this will trigger the useEffect to refetch
      await refreshJoinedOrgs()
      await refreshSavedOrgs()
      setSelectedOrg(null)
      alert('Successfully joined organization!')
    } catch (err: any) {
      console.error('Error joining organization:', err)
      alert(err.message || 'Failed to join organization. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  if (authLoading || loading) {
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
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Saved Organizations</h2>

        {error ? (
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
                      {org.is_on_platform && org.id && (
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
                          handleUnsave(org.id, org.name)
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
            <>
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
                      {selectedOrg.is_on_platform && selectedOrg.id && (
                        <button
                          onClick={() => handleJoin(selectedOrg.id)}
                          disabled={actionLoading === selectedOrg.id}
                          className="px-6 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
                        >
                          {actionLoading === selectedOrg.id ? 'Joining...' : 'Join Organization'}
                        </button>
                      )}
                      <button
                        onClick={() => handleUnsave(selectedOrg.id, selectedOrg.name)}
                        disabled={actionLoading === (selectedOrg.id || selectedOrg.name)}
                        className="px-6 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === (selectedOrg.id || selectedOrg.name) ? 'Removing...' : 'Unsave'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}

