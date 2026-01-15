'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import DashboardLayout from '@/components/DashboardLayout'
import { useRouter } from 'next/navigation'

export default function ExplorePage() {
  const { user, session, loading: authLoading, userQuery, joinedOrgIds, savedOrgIds, savedOrgNames, refreshJoinedOrgs, refreshSavedOrgs } = useAuth()
  const router = useRouter()
  const [organizations, setOrganizations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!user || !session) {
        setLoading(false)
        return
      }

      if (!userQuery?.latest_cleansed_query) {
        setLoading(false)
        setError('Please complete the survey first to see recommendations.')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/explore', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch organizations')
        }

        const data = await response.json()
        setOrganizations(data.organizations || [])
      } catch (err: any) {
        console.error('Error fetching organizations:', err)
        setError(err.message || 'Failed to load organizations')
      } finally {
        setLoading(false)
      }
    }

    fetchOrganizations()
  }, [user, session, userQuery])

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

      // Refresh joined orgs and remove from list
      await refreshJoinedOrgs()
      setOrganizations(prev => prev.filter(org => org.id !== orgId))
      setSelectedOrg(null)
    } catch (err: any) {
      console.error('Error joining organization:', err)
      alert(err.message || 'Failed to join organization. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSave = async (orgId: string | null, orgName: string) => {
    if (!session) return

    setActionLoading(orgId || orgName)
    try {
      const response = await fetch('/api/organizations/save', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId: orgId || null, organizationName: orgName }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save organization')
      }

      const data = await response.json()
      
      // Refresh saved orgs and remove from list
      await refreshSavedOrgs()
      if (orgId) {
        setOrganizations(prev => prev.filter(org => org.id !== orgId))
      } else {
        setOrganizations(prev => prev.filter(org => org.name !== orgName))
      }
      setSelectedOrg(null)

      if (data.autoJoined) {
        await refreshJoinedOrgs()
        alert('Organization saved and automatically joined!')
      } else if (orgId) {
        alert('Organization saved!')
      } else {
        alert('Organization saved! You\'ll be notified when it\'s available on the platform.')
      }
    } catch (err: any) {
      console.error('Error saving organization:', err)
      alert(err.message || 'Failed to save organization. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const isJoined = (orgId: string | null) => orgId ? joinedOrgIds.has(orgId) : false
  const isSaved = (orgId: string | null, orgName: string) => {
    if (orgId && savedOrgIds.has(orgId)) return true
    return savedOrgNames.has(orgName.toLowerCase().trim())
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
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Explore Organizations</h2>

        {!userQuery?.latest_cleansed_query ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600 mb-4">Complete the survey to discover organizations that match your interests!</p>
            <button
              onClick={() => router.push('/survey')}
              className="px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light"
            >
              Take Survey
            </button>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        ) : organizations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">No organizations found. Try updating your survey responses.</p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-6">Found {organizations.length} organizations matching your interests</p>
            <div className="space-y-4">
              {organizations.map((org: any, index: number) => {
                const orgJoined = isJoined(org.id)
                const orgSaved = isSaved(org.id, org.name)
                
                return (
                  <motion.div
                    key={org.id || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 cursor-pointer"
                    onClick={() => setSelectedOrg(org)}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-800">{org.name}</h3>
                            {org.relevance_score && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-tamu-maroon/10 text-tamu-maroon border border-tamu-maroon/20">
                                Match: {org.relevance_score}
                              </span>
                            )}
                          </div>
                          {org.bio && (
                            <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">{org.bio}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {org.id && !orgJoined && !orgSaved && (
                            <>
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSave(org.id, org.name)
                                }}
                                disabled={actionLoading === org.id}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === org.id ? 'Saving...' : 'Save'}
                              </button>
                            </>
                          )}
                          {orgSaved && (
                            <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium text-sm">
                              Saved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </>
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
                      {selectedOrg.relevance_score && (
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                          Match: {selectedOrg.relevance_score}
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

                    {(selectedOrg.website || selectedOrg.administrative_contact_info) && (
                      <div className="border-t pt-4">
                        <h3 className="text-lg font-semibold text-tamu-maroon mb-2">Contact</h3>
                        {selectedOrg.website && (
                          <a href={selectedOrg.website} target="_blank" rel="noopener noreferrer" className="text-tamu-maroon hover:underline">
                            {selectedOrg.website}
                          </a>
                        )}
                      </div>
                    )}

                    <div className="border-t pt-4 flex gap-4">
                      {selectedOrg.id && !isJoined(selectedOrg.id) && !isSaved(selectedOrg.id, selectedOrg.name) && (
                        <>
                          <button
                            onClick={() => handleJoin(selectedOrg.id)}
                            disabled={actionLoading === selectedOrg.id}
                            className="px-6 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
                          >
                            {actionLoading === selectedOrg.id ? 'Joining...' : 'Join Organization'}
                          </button>
                          <button
                            onClick={() => handleSave(selectedOrg.id, selectedOrg.name)}
                            disabled={actionLoading === selectedOrg.id}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === selectedOrg.id ? 'Saving...' : 'Save for Later'}
                          </button>
                        </>
                      )}
                      {isSaved(selectedOrg.id, selectedOrg.name) && (
                        <span className="px-6 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                          Saved
                        </span>
                      )}
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

