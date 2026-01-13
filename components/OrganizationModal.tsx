'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

interface OrganizationModalProps {
  org: any
  onClose: () => void
  isJoined?: boolean
  relevanceScore?: number
}

export default function OrganizationModal({ org, onClose, isJoined = false, relevanceScore }: OrganizationModalProps) {
  const { user, session, joinedOrgIds, savedOrgs, refreshJoinedOrgs, refreshSavedOrgs } = useAuth()
  const supabase = createClientComponentClient()
  const [orgData, setOrgData] = useState(org)
  const [isJoining, setIsJoining] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const isOrgJoined = orgData.id ? joinedOrgIds.has(orgData.id) : false
  const isOrgSaved = savedOrgs.some(so => so.organization_name.toLowerCase().trim() === orgData.name?.toLowerCase().trim())

  // Real-time subscription for organization updates
  useEffect(() => {
    if (!orgData?.id) return

    let channel: RealtimeChannel | null = null

    const setupSubscription = () => {
      channel = supabase
        .channel(`org-modal-${orgData.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'organizations',
            filter: `id=eq.${orgData.id}`
          },
          (payload) => {
            if (payload.new) {
              setOrgData((prev: any) => ({
                ...prev,
                ...payload.new
              }))
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
  }, [orgData?.id, supabase])

  const handleJoin = async () => {
    if (!session || !orgData.id || isJoining) return

    setIsJoining(true)
    try {
      const response = await fetch('/api/orgs/join', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organization_id: orgData.id }),
      })

      if (response.ok) {
        await refreshJoinedOrgs()
        onClose()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to join organization')
      }
    } catch (error) {
      console.error('Error joining org:', error)
      alert('Failed to join organization')
    } finally {
      setIsJoining(false)
    }
  }

  const handleSave = async () => {
    if (!session || isSaving) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/orgs/save', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_name: orgData.name,
          organization_bio: orgData.full_bio || orgData.bio,
          organization_website: orgData.website,
          organization_contact_info: orgData.administrative_contact_info,
        }),
      })

      if (response.ok) {
        await refreshSavedOrgs()
        alert('Organization saved! You\'ll be notified when it joins the platform.')
        onClose()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to save organization')
      }
    } catch (error) {
      console.error('Error saving org:', error)
      alert('Failed to save organization')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUnsave = async () => {
    if (!session) return

    const savedOrg = savedOrgs.find(so => so.organization_name.toLowerCase().trim() === orgData.name?.toLowerCase().trim())
    if (!savedOrg) return

    try {
      const response = await fetch(`/api/orgs/unsave?id=${savedOrg.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        await refreshSavedOrgs()
        onClose()
      }
    } catch (error) {
      console.error('Error unsaving org:', error)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        >
          <div className="sticky top-0 bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light p-3 sm:p-4 md:p-6 text-white flex justify-between items-start">
            <div className="flex-1 pr-2">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 break-words">{orgData.name}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {relevanceScore && (
                  <span className="px-2 py-1 sm:px-3 sm:py-1 bg-white/20 rounded-full text-xs sm:text-sm font-medium">
                    Score: {relevanceScore}
                  </span>
                )}
                <span className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full text-xs">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  Live
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl sm:text-3xl font-bold flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
            {/* Full Bio */}
            {(orgData.full_bio || orgData.bio) && (orgData.full_bio !== 'nan' && orgData.bio !== 'nan') && (
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-tamu-maroon mb-2">About</h3>
                <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{orgData.full_bio || orgData.bio}</p>
              </div>
            )}

            {/* Contact Information */}
            {(orgData.website || orgData.administrative_contact_info) && (
              <div className="border-t pt-4">
                <h3 className="text-base sm:text-lg font-semibold text-tamu-maroon mb-2 sm:mb-3">Contact Information</h3>
                <div className="space-y-2">
                  {orgData.website && orgData.website !== 'nan' && (
                    <div>
                      <span className="font-semibold text-gray-700">Website: </span>
                      <a
                        href={orgData.website.startsWith('http') ? orgData.website : `https://${orgData.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-tamu-maroon hover:underline"
                      >
                        {orgData.website}
                      </a>
                    </div>
                  )}
                  {orgData.administrative_contact_info && orgData.administrative_contact_info !== 'nan' && (
                    <div>
                      <span className="font-semibold text-gray-700">Contact: </span>
                      <span className="text-gray-700">{orgData.administrative_contact_info}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t pt-4">
              {orgData.typical_majors && orgData.typical_majors !== 'nan' && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Career Fields</h4>
                  <p className="text-gray-600">{orgData.typical_majors}</p>
                </div>
              )}
              {orgData.typical_activities && orgData.typical_activities !== 'nan' && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Typical Activities</h4>
                  <p className="text-gray-600">{orgData.typical_activities}</p>
                </div>
              )}
              {orgData.club_culture_style && orgData.club_culture_style !== 'nan' && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Club Culture</h4>
                  <p className="text-gray-600">{orgData.club_culture_style}</p>
                </div>
              )}
              {orgData.meeting_frequency && orgData.meeting_frequency !== 'nan' && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Meeting Frequency</h4>
                  <p className="text-gray-600">{orgData.meeting_frequency}</p>
                </div>
              )}
              {orgData.meeting_times && orgData.meeting_times !== 'nan' && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Meeting Times</h4>
                  <p className="text-gray-600">{orgData.meeting_times}</p>
                </div>
              )}
              {orgData.meeting_locations && orgData.meeting_locations !== 'nan' && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Meeting Locations</h4>
                  <p className="text-gray-600">{orgData.meeting_locations}</p>
                </div>
              )}
              {orgData.dues_required && orgData.dues_required !== 'nan' && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Dues Required</h4>
                  <p className="text-gray-600">
                    {orgData.dues_required}
                    {orgData.dues_cost && orgData.dues_cost !== 'nan' && ` - ${orgData.dues_cost}`}
                  </p>
                </div>
              )}
              {orgData.application_required && orgData.application_required !== 'nan' && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Application Required</h4>
                  <p className="text-gray-600">{orgData.application_required}</p>
                </div>
              )}
              {orgData.time_commitment && orgData.time_commitment !== 'nan' && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Time Commitment</h4>
                  <p className="text-gray-600">{orgData.time_commitment}</p>
                </div>
              )}
              {orgData.member_count && orgData.member_count !== 'nan' && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Member Count</h4>
                  <p className="text-gray-600">{orgData.member_count}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {!isJoined && (
              <div className="border-t pt-4 flex gap-3">
                {orgData.id ? (
                  // Organization is on platform
                  !isOrgJoined ? (
                    <button
                      onClick={handleJoin}
                      disabled={isJoining}
                      className="flex-1 px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
                    >
                      {isJoining ? 'Joining...' : 'Join Organization'}
                    </button>
                  ) : (
                    <div className="flex-1 px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium text-center">
                      Joined
                    </div>
                  )
                ) : (
                  // Organization not on platform - save it
                  isOrgSaved ? (
                    <button
                      onClick={handleUnsave}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Unsave
                    </button>
                  ) : (
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save Organization'}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

