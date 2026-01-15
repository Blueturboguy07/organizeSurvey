'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import Image from 'next/image'
import Link from 'next/link'

export default function DashboardPage() {
  // Use AuthContext for real-time auth state and user data
  // AuthContext maintains real-time subscriptions to user_profiles and user_queries tables
  // All user data (profile, query) updates automatically when changed elsewhere
  const { 
    user, 
    session,
    loading: authLoading, 
    signOut,
    userProfile,        // Real-time profile data (name, picture, preferences)
    userProfileLoading,
    userQuery,          // Real-time survey query data (interests, demographics)
    userQueryLoading,
    joinedOrgIds        // Real-time joined organizations (for filtering recommendations)
  } = useAuth()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [imageError, setImageError] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Reset image error when profile picture URL changes
  useEffect(() => {
    setImageError(false)
  }, [userProfile?.profile_picture_url])

  // Fetch recommendations when user query is available or joined orgs change
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!user || !userQuery?.latest_cleansed_query || !session) {
        setRecommendations([])
        return
      }

      setRecommendationsLoading(true)
      setRecommendationsError(null)

      try {
        const response = await fetch('/api/recommendations', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch recommendations')
        }

        const data = await response.json()
        setRecommendations(data.recommendations || [])
      } catch (error: any) {
        console.error('Error fetching recommendations:', error)
        setRecommendationsError(error.message || 'Failed to load recommendations')
        setRecommendations([])
      } finally {
        setRecommendationsLoading(false)
      }
    }

    fetchRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userQuery?.latest_cleansed_query, session, Array.from(joinedOrgIds).sort().join(',')])

  // Real-time subscription for selected organization
  useEffect(() => {
    if (!selectedOrg?.id) return

    let channel: RealtimeChannel | null = null

    const setupSubscription = () => {
      channel = supabase
        .channel(`org-detail-${selectedOrg.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'organizations',
            filter: `id=eq.${selectedOrg.id}`
          },
          (payload) => {
            if (payload.new) {
              setSelectedOrg((prev: any) => ({
                ...prev,
                ...payload.new
              }))
              // Also update in recommendations list
              setRecommendations((prev: any[]) =>
                prev.map(org => org.id === selectedOrg.id ? { ...org, ...payload.new } : org)
              )
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
  }, [selectedOrg?.id, supabase])

  // Determine loading state
  const loading = authLoading || userProfileLoading || userQueryLoading

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Determine what to show in My Orgs
  const hasJoinedOrgs = false // TODO: Implement joined orgs tracking
  const hasQuery = !!userQuery?.latest_cleansed_query
  const hasRecommendations = hasQuery

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image 
                src="/logo.png" 
                alt="ORGanize TAMU Logo" 
                width={40}
                height={40}
                className="flex-shrink-0 object-contain"
              />
              <h1 className="text-2xl font-bold text-tamu-maroon">ORGanize TAMU</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {userProfile?.profile_picture_url && !imageError ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200">
                      <Image
                        key={userProfile.profile_picture_url}
                        src={userProfile.profile_picture_url}
                        alt="Profile"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        style={{ aspectRatio: '1 / 1' }}
                        onError={() => {
                          console.error('Failed to load profile picture:', userProfile.profile_picture_url)
                          setImageError(true)
                        }}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </button>

                <AnimatePresence>
                  {showProfileDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                    >
                      <Link
                        href="/profile"
                        onClick={() => setShowProfileDropdown(false)}
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>My Profile</span>
                        </div>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.button
                onClick={signOut}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 text-gray-700 hover:text-tamu-maroon border border-gray-300 rounded-lg font-medium hover:border-tamu-maroon transition-colors"
              >
                Sign Out
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome back{userProfile?.name ? `, ${userProfile.name.split(' ')[0]}` : ''}!
          </h2>
        </motion.div>

        {/* My Orgs - Central Component */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-md p-6 sm:p-8"
        >
          <h3 className="text-2xl font-bold text-gray-800 mb-6">My Orgs</h3>

          {hasJoinedOrgs ? (
            // TODO: Show joined orgs when implemented
            <div className="text-center py-12">
              <p className="text-gray-500">You haven&apos;t joined any organizations yet.</p>
            </div>
          ) : hasRecommendations ? (
            // Show explore button for recommended orgs
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-600 mb-6">We have organization recommendations for you!</p>
              <Link href="/survey?showResults=true">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light"
                >
                  Explore Recommended Orgs
                </motion.button>
              </Link>
            </div>
          ) : hasQuery ? (
            // Has query but no recommendations
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-600 mb-4">No recommendations available yet.</p>
              <Link href="/survey">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light"
                >
                  Take Survey to Get Recommendations
                </motion.button>
              </Link>
            </div>
          ) : (
            // No query - prompt to take survey
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600 mb-4">Complete the survey to discover organizations that match your interests!</p>
              <Link href="/survey">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light"
                >
                  Take Survey
                </motion.button>
              </Link>
            </div>
          )}
        </motion.div>

        {/* Recommended for you Section */}
        {hasQuery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Recommended for you</h3>
            
            {recommendationsLoading ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading recommendations...</p>
              </div>
            ) : recommendationsError ? (
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-600 text-center">Unable to load recommendations. Please try again later.</p>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-600 text-center">No recommendations available at this time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.map((org: any, index: number) => (
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
                          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 break-words">{selectedOrg.name}</h2>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-1 sm:px-3 sm:py-1 bg-white/20 rounded-full text-xs sm:text-sm font-medium">
                              Score: {selectedOrg.relevance_score}
                            </span>
                            <span className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full text-xs">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                              Live
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedOrg(null)}
                          className="text-white hover:text-gray-200 text-2xl sm:text-3xl font-bold flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center"
                          aria-label="Close"
                        >
                          ×
                        </button>
                      </div>

                      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                        {/* Full Bio */}
                        {selectedOrg.full_bio && selectedOrg.full_bio !== 'nan' && (
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold text-tamu-maroon mb-2">About</h3>
                            <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{selectedOrg.full_bio}</p>
                          </div>
                        )}

                        {/* Contact Information */}
                        {(selectedOrg.website || selectedOrg.administrative_contact_info) && (
                          <div className="border-t pt-4">
                            <h3 className="text-base sm:text-lg font-semibold text-tamu-maroon mb-2 sm:mb-3">Contact Information</h3>
                            <div className="space-y-2">
                              {selectedOrg.website && selectedOrg.website !== 'nan' && (
                                <div>
                                  <span className="font-semibold text-gray-700">Website: </span>
                                  <a
                                    href={selectedOrg.website.startsWith('http') ? selectedOrg.website : `https://${selectedOrg.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-tamu-maroon hover:underline"
                                  >
                                    {selectedOrg.website}
                                  </a>
                                </div>
                              )}
                              {selectedOrg.administrative_contact_info && selectedOrg.administrative_contact_info !== 'nan' && (
                                <div>
                                  <span className="font-semibold text-gray-700">Contact: </span>
                                  <span className="text-gray-700">{selectedOrg.administrative_contact_info}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Additional Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t pt-4">
                          {selectedOrg.typical_majors && selectedOrg.typical_majors !== 'nan' && (
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-1">Career Fields</h4>
                              <p className="text-gray-600">{selectedOrg.typical_majors}</p>
                            </div>
                          )}
                          {selectedOrg.typical_activities && selectedOrg.typical_activities !== 'nan' && (
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-1">Typical Activities</h4>
                              <p className="text-gray-600">{selectedOrg.typical_activities}</p>
                            </div>
                          )}
                          {selectedOrg.club_culture_style && selectedOrg.club_culture_style !== 'nan' && (
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-1">Club Culture</h4>
                              <p className="text-gray-600">{selectedOrg.club_culture_style}</p>
                            </div>
                          )}
                          {selectedOrg.meeting_frequency && selectedOrg.meeting_frequency !== 'nan' && (
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-1">Meeting Frequency</h4>
                              <p className="text-gray-600">{selectedOrg.meeting_frequency}</p>
                            </div>
                          )}
                          {selectedOrg.meeting_times && selectedOrg.meeting_times !== 'nan' && (
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-1">Meeting Times</h4>
                              <p className="text-gray-600">{selectedOrg.meeting_times}</p>
                            </div>
                          )}
                          {selectedOrg.meeting_locations && selectedOrg.meeting_locations !== 'nan' && (
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-1">Meeting Locations</h4>
                              <p className="text-gray-600">{selectedOrg.meeting_locations}</p>
                            </div>
                          )}
                          {selectedOrg.dues_required && selectedOrg.dues_required !== 'nan' && (
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-1">Dues Required</h4>
                              <p className="text-gray-600">
                                {selectedOrg.dues_required}
                                {selectedOrg.dues_cost && selectedOrg.dues_cost !== 'nan' && ` - ${selectedOrg.dues_cost}`}
                              </p>
                            </div>
                          )}
                          {selectedOrg.application_required && selectedOrg.application_required !== 'nan' && (
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-1">Application Required</h4>
                              <p className="text-gray-600">{selectedOrg.application_required}</p>
                            </div>
                          )}
                          {selectedOrg.time_commitment && selectedOrg.time_commitment !== 'nan' && (
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-1">Time Commitment</h4>
                              <p className="text-gray-600">{selectedOrg.time_commitment}</p>
                            </div>
                          )}
                          {selectedOrg.member_count && selectedOrg.member_count !== 'nan' && (
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-1">Member Count</h4>
                              <p className="text-gray-600">{selectedOrg.member_count}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  )
}
