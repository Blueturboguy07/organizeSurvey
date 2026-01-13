'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import OrganizationModal from '@/components/OrganizationModal'

export default function SavedPage() {
  const { savedOrgs, savedOrgsLoading, session } = useAuth()
  const supabase = createClientComponentClient()
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)
  const [orgsWithData, setOrgsWithData] = useState<any[]>([])

  // Fetch full org data for saved orgs that are linked
  useEffect(() => {
    const fetchOrgData = async () => {
      if (!savedOrgs.length) {
        setOrgsWithData([])
        return
      }

      const linkedOrgIds = savedOrgs
        .filter(so => so.organization_id)
        .map(so => so.organization_id)

      if (linkedOrgIds.length === 0) {
        setOrgsWithData(savedOrgs)
        return
      }

      const { data: orgs } = await supabase
        .from('organizations')
        .select('*')
        .in('id', linkedOrgIds)

      // Merge saved org data with full org data
      const merged = savedOrgs.map(savedOrg => {
        if (savedOrg.organization_id && orgs) {
          const fullOrg = orgs.find(o => o.id === savedOrg.organization_id)
          if (fullOrg) {
            return { ...savedOrg, full_org: fullOrg }
          }
        }
        return savedOrg
      })

      setOrgsWithData(merged)
    }

    fetchOrgData()
  }, [savedOrgs, supabase])

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Saved Organizations</h2>

        {savedOrgsLoading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading saved organizations...</p>
          </div>
        ) : savedOrgs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-gray-600 mb-4">You haven&apos;t saved any organizations yet.</p>
            <p className="text-gray-500 text-sm">Save organizations that aren&apos;t on the platform yet, and you&apos;ll be notified when they join!</p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-6">
              {orgsWithData.some(so => so.organization_id) 
                ? 'Some organizations have joined the platform!' 
                : 'You\'ll be notified when these organizations join the platform'}
            </p>
            <div className="space-y-3">
              {orgsWithData.map((savedOrg: any, index: number) => {
                const orgToShow = savedOrg.full_org || {
                  name: savedOrg.organization_name,
                  bio: savedOrg.organization_bio,
                  full_bio: savedOrg.organization_bio,
                  website: savedOrg.organization_website,
                  administrative_contact_info: savedOrg.organization_contact_info,
                }

                return (
                  <motion.div
                    key={savedOrg.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border ${
                      savedOrg.organization_id ? 'border-green-200' : 'border-gray-200'
                    } cursor-pointer`}
                    onClick={() => setSelectedOrg({
                      ...orgToShow,
                      id: savedOrg.organization_id,
                    })}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-xl font-bold text-gray-800">{savedOrg.organization_name}</h4>
                            {savedOrg.organization_id && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ✓ Linked
                              </span>
                            )}
                          </div>
                          {(savedOrg.full_org?.bio || savedOrg.organization_bio) && (
                            <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">
                              {savedOrg.full_org?.bio || savedOrg.organization_bio}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <span className="text-xs text-gray-500">
                          Saved {new Date(savedOrg.saved_at).toLocaleDateString()}
                          {savedOrg.notified_at && (
                            <span className="ml-2 text-green-600">• Notified {new Date(savedOrg.notified_at).toLocaleDateString()}</span>
                          )}
                        </span>
                        {savedOrg.organization_id ? (
                          <span className="text-xs text-green-600 font-medium">On platform</span>
                        ) : (
                          <span className="text-xs text-tamu-maroon font-medium">Not on platform yet</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </>
        )}
      </motion.div>

      {selectedOrg && (
        <OrganizationModal
          org={selectedOrg}
          onClose={() => setSelectedOrg(null)}
        />
      )}
    </DashboardLayout>
  )
}

