'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'
import Link from 'next/link'

interface DashboardData {
  name: string | null
  email: string | null
  profilePictureUrl: string | null
  query: string | null
  demographics: any
}

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [hasRecommendations, setHasRecommendations] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const loadDashboardData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error('Failed to load dashboard data')
      }

      const profileData = await response.json()
      setData(profileData)

      // Check if user has recommendations available (has a query)
      if (profileData.query) {
        setHasRecommendations(true)
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user, loadDashboardData])


  if (authLoading || loading) {
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
  const hasQuery = !!data?.query

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
                  {data?.profilePictureUrl && !imageError ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200">
                      <Image
                        src={data.profilePictureUrl}
                        alt="Profile"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        style={{ aspectRatio: '1 / 1' }}
                        onError={() => {
                          console.error('Failed to load profile picture:', data.profilePictureUrl)
                          setImageError(true)
                        }}
                        unoptimized={data.profilePictureUrl?.includes('supabase.co')}
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
            Welcome back{data?.name ? `, ${data.name.split(' ')[0]}` : ''}!
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
      </main>
    </div>
  )
}
