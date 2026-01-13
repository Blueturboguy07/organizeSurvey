'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import DashboardLayout from '@/components/DashboardLayout'
import OrganizationModal from '@/components/OrganizationModal'

export default function ExplorePage() {
  const { user, session, userQuery, joinedOrgIds, savedOrgs } = useAuth()
  const [organizations, setOrganizations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)

  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!user || !userQuery?.latest_cleansed_query || !session) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/orgs/explore', {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userQuery?.latest_cleansed_query, session, Array.from(joinedOrgIds).sort().join(','), savedOrgs.length])

  if (!userQuery?.latest_cleansed_query) {
    return (
      <DashboardLayout>
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-600 mb-4">Complete the survey to explore organizations!</p>
          <a
            href="/survey"
            className="inline-block px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light"
          >
            Take Survey
          </a>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Explore Organizations</h2>

        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading organizations...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-center">{error}</p>
          </div>
        ) : organizations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 text-center">No organizations available at this time.</p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-6">Found {organizations.length} organizations matching your interests</p>
            <div className="space-y-3">
              {organizations.map((org: any, index: number) => (
                <motion.div
                  key={org.id || org.name || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + index * 0.03 }}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 cursor-pointer"
                  onClick={() => setSelectedOrg(org)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-xl font-bold text-gray-800">{org.name}</h4>
                          {org.relevance_score && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-tamu-maroon/10 text-tamu-maroon border border-tamu-maroon/20">
                              Match: {org.relevance_score}
                            </span>
                          )}
                        </div>
                        
                        {org.bio_snippet && (
                          <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">{org.bio_snippet}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedOrg(org)
                      }}
                      className="text-tamu-maroon hover:text-tamu-maroon-light font-medium text-sm flex items-center gap-1 mt-2"
                    >
                      View More Details
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </motion.div>

      {selectedOrg && (
        <OrganizationModal
          org={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          relevanceScore={selectedOrg.relevance_score}
        />
      )}
    </DashboardLayout>
  )
}

