'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
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
  const [imageError, setImageError] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null)

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map((org: any, index: number) => (
                  <motion.div
                    key={org.id || org.name || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                  >
                    <h4 className="text-xl font-semibold text-gray-800 mb-2">{org.name}</h4>
                    
                    {org.relevance_score && (
                      <div className="mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-tamu-maroon/10 text-tamu-maroon">
                          Match Score: {org.relevance_score}
                        </span>
                      </div>
                    )}

                    {org.bio_snippet && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">{org.bio_snippet}</p>
                    )}

                    {org.typical_majors && org.typical_majors !== 'nan' && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Majors</p>
                        <p className="text-sm text-gray-700">{org.typical_majors}</p>
                      </div>
                    )}

                    {org.typical_activities && org.typical_activities !== 'nan' && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Activities</p>
                        <p className="text-sm text-gray-700">{org.typical_activities}</p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      {org.website && org.website !== 'nan' && (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-4 py-2 text-sm text-center bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Visit Website
                        </a>
                      )}
                      <Link
                        href={`/survey?showResults=true&highlight=${encodeURIComponent(org.name)}`}
                        className="flex-1 px-4 py-2 text-sm text-center bg-tamu-maroon text-white rounded-lg hover:bg-tamu-maroon-light transition-colors"
                      >
                        View Details
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  )
}
