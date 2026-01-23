'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import DynamicApplicationForm from '@/components/DynamicApplicationForm'

interface Organization {
  id: string
  name: string
  bio?: string
  bio_snippet?: string
  full_bio?: string
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
  is_application_based?: boolean
  application_required_bool?: boolean
  relevance_score?: number
  joined_at?: string
  saved_at?: string
}

interface OrgCardProps {
  org: Organization
  showScore?: boolean
  showActions?: boolean
  variant?: 'default' | 'compact'
  onOrgUpdate?: (org: Organization) => void
}

export default function OrgCard({ 
  org, 
  showScore = false, 
  showActions = true,
  variant = 'default',
  onOrgUpdate
}: OrgCardProps) {
  const { user, joinedOrgIds, savedOrgIds, appliedOrgIds, joinOrg, leaveOrg, saveOrg, unsaveOrg } = useAuth()
  const supabase = createClientComponentClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [hasCustomForm, setHasCustomForm] = useState(false)
  const [checkingForm, setCheckingForm] = useState(false)

  const isJoined = joinedOrgIds.has(org.id)
  const isSaved = savedOrgIds.has(org.id)
  const isApplied = appliedOrgIds.has(org.id)
  const isOnPlatform = org.is_on_platform === true // Only true if explicitly set to true
  const isApplicationBased = org.is_application_based === true
  const [applicationSuccess, setApplicationSuccess] = useState<string | null>(null)

  // Check if org has a custom form (for application-based orgs)
  useEffect(() => {
    if (!isApplicationBased || !org.id) return
    
    const checkForCustomForm = async () => {
      setCheckingForm(true)
      try {
        const { data: formData } = await supabase
          .from('org_forms')
          .select('id')
          .eq('organization_id', org.id)
          .single()
        
        if (formData) {
          // Check if form has at least one question
          const { count } = await supabase
            .from('form_questions')
            .select('id', { count: 'exact', head: true })
            .eq('form_id', formData.id)
          
          setHasCustomForm((count || 0) > 0)
        } else {
          setHasCustomForm(false)
        }
      } catch (err) {
        setHasCustomForm(false)
      }
      setCheckingForm(false)
    }
    
    checkForCustomForm()
  }, [org.id, isApplicationBased, supabase])


  // Debug: log platform status
  console.log(`🏢 [OrgCard] "${org.name}" - is_on_platform:`, org.is_on_platform, '→ isOnPlatform:', isOnPlatform, 'is_application_based:', isApplicationBased)

  const handleApplyClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setActionError(null)
    setIsApplicationModalOpen(true)
  }

  const handleSubmitApplication = async (data: { name: string; email: string; whyJoin: string; customResponses: Record<string, string | string[]> }) => {
    setActionLoading('apply')
    setActionError(null)
    setApplicationSuccess(null)
    
    const result = await joinOrg(org.id, {
      name: data.name,
      email: data.email,
      whyJoin: data.whyJoin,
      customResponses: data.customResponses
    })
    
    if (!result.success) {
      setActionError(result.error || 'Failed to submit application')
    } else if (result.applied) {
      setApplicationSuccess('Application submitted! The organization will review your request.')
      setIsApplicationModalOpen(false)
    }
    setActionLoading(null)
  }

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setActionLoading('join')
    setActionError(null)
    setApplicationSuccess(null)
    
    const result = await joinOrg(org.id)
    
    if (!result.success) {
      setActionError(result.error || 'Failed to join')
    }
    setActionLoading(null)
  }

  const handleLeave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setActionLoading('leave')
    setActionError(null)
    
    const result = await leaveOrg(org.id)
    
    if (!result.success) {
      setActionError(result.error || 'Failed to leave')
    }
    setActionLoading(null)
  }

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setActionLoading('save')
    setActionError(null)
    
    const result = await saveOrg(org.id)
    
    if (!result.success) {
      setActionError(result.error || 'Failed to save')
    }
    setActionLoading(null)
  }

  const handleUnsave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setActionLoading('unsave')
    setActionError(null)
    
    const result = await unsaveOrg(org.id)
    
    if (!result.success) {
      setActionError(result.error || 'Failed to unsave')
    }
    setActionLoading(null)
  }

  const bioText = org.bio_snippet || org.bio || org.full_bio || ''
  const bioSnippet = bioText.length > 200 ? bioText.slice(0, 200) + '...' : bioText

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 cursor-pointer
          ${variant === 'compact' ? 'p-4' : 'p-6'}
        `}
        onClick={() => setIsModalOpen(true)}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h4 className={`font-bold text-gray-800 ${variant === 'compact' ? 'text-lg' : 'text-xl'}`}>
                {org.name}
              </h4>
              
              {/* Status badges */}
              {isJoined && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Joined
                </span>
              )}
              
              {isSaved && !isJoined && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                  </svg>
                  Saved
                </span>
              )}
              
              {!isOnPlatform && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                  Not on platform
                </span>
              )}
              
              {showScore && org.relevance_score && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-tamu-maroon/10 text-tamu-maroon border border-tamu-maroon/20">
                  Match: {org.relevance_score}
                </span>
              )}
            </div>
            
            {bioSnippet && bioSnippet !== 'nan' && (
              <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">{bioSnippet}</p>
            )}
          </div>
        </div>

        {/* Quick info tags */}
        {variant === 'default' && (
          <div className="flex flex-wrap gap-2 mb-3">
            {org.typical_majors && org.typical_majors !== 'nan' && (
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                {org.typical_majors.length > 50 ? org.typical_majors.slice(0, 50) + '...' : org.typical_majors}
              </span>
            )}
            {org.typical_activities && org.typical_activities !== 'nan' && (
              <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                {org.typical_activities.length > 50 ? org.typical_activities.slice(0, 50) + '...' : org.typical_activities}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            {actionError && (
              <span className="text-xs text-red-600 mr-2">{actionError}</span>
            )}
            {applicationSuccess && (
              <span className="text-xs text-green-600 mr-2">{applicationSuccess}</span>
            )}
            
            {isJoined ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLeave}
                disabled={actionLoading !== null}
                className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'leave' ? 'Leaving...' : 'Leave'}
              </motion.button>
            ) : isApplied || applicationSuccess ? (
              <span className="px-3 py-1.5 text-sm font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg">
                Applied - Waiting
              </span>
            ) : isOnPlatform ? (
              isApplicationBased ? (
                hasCustomForm ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleApplyClick}
                    disabled={actionLoading !== null || checkingForm}
                    className="px-3 py-1.5 text-sm font-medium text-tamu-maroon border border-tamu-maroon rounded-lg hover:bg-tamu-maroon hover:text-white transition-colors disabled:opacity-50"
                  >
                    {checkingForm ? '...' : 'Apply'}
                  </motion.button>
                ) : (
                  <span className="px-3 py-1.5 text-sm font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-lg">
                    {checkingForm ? '...' : 'Apps Coming Soon'}
                  </span>
                )
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleJoin}
                  disabled={actionLoading !== null}
                  className="px-3 py-1.5 text-sm font-medium bg-tamu-maroon text-white rounded-lg hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'join' ? 'Joining...' : 'Join'}
                </motion.button>
              )
            ) : null}
            
            {!isJoined && (
              isSaved ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUnsave}
                  disabled={actionLoading !== null}
                  className="px-3 py-1.5 text-sm font-medium text-yellow-700 border border-yellow-300 rounded-lg hover:bg-yellow-50 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'unsave' ? 'Unsaving...' : 'Unsave'}
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={actionLoading !== null}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'save' ? 'Saving...' : 'Save for later'}
                </motion.button>
              )
            )}

            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsModalOpen(true)
              }}
              className="ml-auto text-tamu-maroon hover:text-tamu-maroon-light font-medium text-sm flex items-center gap-1"
            >
              View Details
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)}
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
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 break-words">{org.name}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {showScore && org.relevance_score && (
                      <span className="px-2 py-1 sm:px-3 sm:py-1 bg-white/20 rounded-full text-xs sm:text-sm font-medium">
                        Score: {org.relevance_score}
                      </span>
                    )}
                    {isJoined && (
                      <span className="px-2 py-1 bg-green-400/30 rounded-full text-xs font-medium">
                        ✓ Joined
                      </span>
                    )}
                    {isSaved && !isJoined && (
                      <span className="px-2 py-1 bg-yellow-400/30 rounded-full text-xs font-medium">
                        ★ Saved
                      </span>
                    )}
                    {!isOnPlatform && (
                      <span className="px-2 py-1 bg-white/10 rounded-full text-xs font-medium">
                        Not on platform
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-white hover:text-gray-200 text-2xl sm:text-3xl font-bold flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                {/* Full Bio */}
                {(org.full_bio || org.bio) && (org.full_bio || org.bio) !== 'nan' && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-tamu-maroon mb-2">About</h3>
                    <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{org.full_bio || org.bio}</p>
                  </div>
                )}

                {/* Actions in Modal */}
                {showActions && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg flex-wrap">
                    {actionError && (
                      <span className="text-sm text-red-600">{actionError}</span>
                    )}
                    {applicationSuccess && (
                      <span className="text-sm text-green-600">{applicationSuccess}</span>
                    )}
                    
                    {isJoined ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleLeave}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === 'leave' ? 'Leaving...' : 'Leave Organization'}
                      </motion.button>
                    ) : isApplied || applicationSuccess ? (
                      <span className="px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg">
                        Applied - Waiting for Review
                      </span>
                    ) : isOnPlatform ? (
                      isApplicationBased ? (
                        hasCustomForm ? (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleApplyClick}
                            disabled={actionLoading !== null || checkingForm}
                            className="px-4 py-2 text-sm font-medium text-tamu-maroon border border-tamu-maroon rounded-lg hover:bg-tamu-maroon hover:text-white transition-colors disabled:opacity-50"
                          >
                            Apply to Join
                          </motion.button>
                        ) : (
                          <span className="px-4 py-2 text-sm font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-lg">
                            {checkingForm ? 'Checking...' : 'Applications Coming Soon'}
                          </span>
                        )
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleJoin}
                          disabled={actionLoading !== null}
                          className="px-4 py-2 text-sm font-medium bg-tamu-maroon text-white rounded-lg hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
                        >
                          {actionLoading === 'join' ? 'Joining...' : 'Join Organization'}
                        </motion.button>
                      )
                    ) : (
                      <span className="text-sm text-gray-500">This organization is not on the platform yet</span>
                    )}
                    
                    {!isJoined && (
                      isSaved ? (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleUnsave}
                          disabled={actionLoading !== null}
                          className="px-4 py-2 text-sm font-medium text-yellow-700 border border-yellow-300 rounded-lg hover:bg-yellow-50 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === 'unsave' ? 'Unsaving...' : 'Unsave'}
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSave}
                          disabled={actionLoading !== null}
                          className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === 'save' ? 'Saving...' : 'Save for Later'}
                        </motion.button>
                      )
                    )}
                  </div>
                )}

                {/* Contact Information */}
                {(org.website || org.administrative_contact_info) && (
                  <div className="border-t pt-4">
                    <h3 className="text-base sm:text-lg font-semibold text-tamu-maroon mb-2 sm:mb-3">Contact Information</h3>
                    <div className="space-y-2">
                      {org.website && org.website !== 'nan' && (
                        <div>
                          <span className="font-semibold text-gray-700">Website: </span>
                          <a
                            href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-tamu-maroon hover:underline"
                          >
                            {org.website}
                          </a>
                        </div>
                      )}
                      {org.administrative_contact_info && org.administrative_contact_info !== 'nan' && (
                        <div>
                          <span className="font-semibold text-gray-700">Contact: </span>
                          <span className="text-gray-700">{org.administrative_contact_info}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t pt-4">
                  {org.typical_majors && org.typical_majors !== 'nan' && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Career Fields</h4>
                      <p className="text-gray-600 text-sm">{org.typical_majors}</p>
                    </div>
                  )}
                  {org.typical_activities && org.typical_activities !== 'nan' && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Typical Activities</h4>
                      <p className="text-gray-600 text-sm">{org.typical_activities}</p>
                    </div>
                  )}
                  {org.club_culture_style && org.club_culture_style !== 'nan' && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Club Culture</h4>
                      <p className="text-gray-600 text-sm">{org.club_culture_style}</p>
                    </div>
                  )}
                  {org.meeting_frequency && org.meeting_frequency !== 'nan' && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Meeting Frequency</h4>
                      <p className="text-gray-600 text-sm">{org.meeting_frequency}</p>
                    </div>
                  )}
                  {org.meeting_times && org.meeting_times !== 'nan' && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Meeting Times</h4>
                      <p className="text-gray-600 text-sm">{org.meeting_times}</p>
                    </div>
                  )}
                  {org.meeting_locations && org.meeting_locations !== 'nan' && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Meeting Locations</h4>
                      <p className="text-gray-600 text-sm">{org.meeting_locations}</p>
                    </div>
                  )}
                  {org.dues_required && org.dues_required !== 'nan' && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Dues Required</h4>
                      <p className="text-gray-600 text-sm">
                        {org.dues_required}
                        {org.dues_cost && org.dues_cost !== 'nan' && ` - ${org.dues_cost}`}
                      </p>
                    </div>
                  )}
                  {org.application_required && org.application_required !== 'nan' && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Application Required</h4>
                      <p className="text-gray-600 text-sm">{org.application_required}</p>
                    </div>
                  )}
                  {org.time_commitment && org.time_commitment !== 'nan' && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Time Commitment</h4>
                      <p className="text-gray-600 text-sm">{org.time_commitment}</p>
                    </div>
                  )}
                  {org.member_count && org.member_count !== 'nan' && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Member Count</h4>
                      <p className="text-gray-600 text-sm">{org.member_count}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Application Form Modal */}
      <AnimatePresence>
        {isApplicationModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsApplicationModalOpen(false)}
            className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light p-4 text-white flex-shrink-0">
                <h2 className="text-xl font-bold">Apply to {org.name}</h2>
                <p className="text-sm text-white/80 mt-1">Fill out the form below to submit your application</p>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                <DynamicApplicationForm
                  organizationId={org.id}
                  organizationName={org.name}
                  onSubmit={handleSubmitApplication}
                  onCancel={() => setIsApplicationModalOpen(false)}
                  loading={actionLoading === 'apply'}
                  error={actionError}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

