'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import DashboardLayout from '@/components/DashboardLayout'

export default function MyOrgsPage() {
  // Get ALL data from AuthContext - no separate API calls needed
  const { 
    user, 
    session, 
    loading: authLoading, 
    joinedOrganizations, 
    joinedOrgIdsLoading,
    refreshJoinedOrgs 
  } = useAuth()
  
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)
  const [leavingOrgId, setLeavingOrgId] = useState<string | null>(null)

  const handleLeave = async (orgId: string) => {
    if (!session) return

    setLeavingOrgId(orgId)
    try {
      console.log('🔵 MyOrgs: Leaving organization:', orgId)
      const response = await fetch(`/api/organizations/join?organizationId=${orgId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to leave organization')
      }

      console.log('🔵 MyOrgs: Left successfully, refreshing AuthContext...')
      
      // Refresh AuthContext - this will update joinedOrganizations
      await refreshJoinedOrgs()
      setSelectedOrg(null)
    } catch (err: any) {
      console.error('🔵 MyOrgs: Error leaving:', err)
      alert(err.message || 'Failed to leave organization. Please try again.')
    } finally {
      setLeavingOrgId(null)
    }
  }

  const handleManualRefresh = async () => {
    await refreshJoinedOrgs()
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
          <h2 className="text-3xl font-bold text-gray-800">My Organizations</h2>
          <button
            onClick={handleManualRefresh}
            disabled={joinedOrgIdsLoading}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${joinedOrgIdsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Debug Panel */}
        <div className="mb-4 p-4 bg-gray-100 rounded-lg text-xs font-mono">
          <div className="font-bold mb-2">Debug Info:</div>
          <div>User ID: {user?.id || 'not logged in'}</div>
          <div>Loading: {joinedOrgIdsLoading ? 'Yes' : 'No'}</div>
          <div>Organizations from AuthContext: {joinedOrganizations.length}</div>
        </div>

        {joinedOrgIdsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
          </div>
        ) : joinedOrganizations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-600 mb-4">You haven&apos;t joined any organizations yet.</p>
            <p className="text-gray-500 text-sm">Explore organizations to find ones that match your interests!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {joinedOrganizations.map((org, index) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 cursor-pointer"
                onClick={() => setSelectedOrg(org)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{org.name}</h3>
                      {org.bio && (
                        <p className="text-gray-700 text-sm leading-relaxed line-clamp-2 mb-2">{org.bio}</p>
                      )}
                      {org.joined_at && (
                        <p className="text-gray-500 text-xs">Joined {new Date(org.joined_at).toLocaleDateString()}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Are you sure you want to leave this organization?')) {
                          handleLeave(org.id)
                        }
                      }}
                      disabled={leavingOrgId === org.id}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {leavingOrgId === org.id ? 'Leaving...' : 'Leave'}
                    </button>
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
                  <h2 className="text-2xl font-bold">{selectedOrg.name}</h2>
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

                  {selectedOrg.website && (
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold text-tamu-maroon mb-2">Contact</h3>
                      <a href={selectedOrg.website} target="_blank" rel="noopener noreferrer" className="text-tamu-maroon hover:underline">
                        {selectedOrg.website}
                      </a>
                    </div>
                  )}

                  <div className="border-t pt-4 flex gap-4">
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to leave this organization?')) {
                          handleLeave(selectedOrg.id)
                        }
                      }}
                      disabled={leavingOrgId === selectedOrg.id}
                      className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {leavingOrgId === selectedOrg.id ? 'Leaving...' : 'Leave Organization'}
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
