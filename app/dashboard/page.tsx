'use client'

import { useState, useEffect, useRef } from 'react'
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

interface Organization {
  name: string
  bio?: string
  bio_snippet?: string
  website?: string
  [key: string]: any
}

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [recommendedOrgs, setRecommendedOrgs] = useState<Organization[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

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

  const loadDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load dashboard data')
      }

      const profileData = await response.json()
      setData(profileData)

      // If user has a query, try to load recommended orgs
      if (profileData.query) {
        loadRecommendedOrgs(profileData.query, profileData.demographics)
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadRecommendedOrgs = async (query: string, demographics: any) => {
    setLoadingOrgs(true)
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          userData: demographics || {}
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.results && result.results.length > 0) {
          setRecommendedOrgs(result.results.slice(0, 6)) // Show top 6 recommendations
        }
      }
    } catch (err) {
      console.error('Failed to load recommended orgs:', err)
    } finally {
      setLoadingOrgs(false)
    }
  }

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
  const hasRecommendedOrgs = recommendedOrgs.length > 0
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
                  {data?.profilePictureUrl ? (
                    <Image
                      src={data.profilePictureUrl}
                      alt="Profile"
                      width={40}
                      height={40}
                      className="rounded-full object-cover border-2 border-gray-200"
                    />
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

          {loadingOrgs ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tamu-maroon"></div>
            </div>
          ) : hasJoinedOrgs ? (
            // TODO: Show joined orgs when implemented
            <div className="text-center py-12">
              <p className="text-gray-500">You haven't joined any organizations yet.</p>
            </div>
          ) : hasRecommendedOrgs ? (
            // Show recommended orgs
            <div>
              <p className="text-gray-600 mb-6">Recommended for you:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedOrgs.map((org, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <h4 className="font-semibold text-gray-800 mb-2">{org.name}</h4>
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {org.bio_snippet || org.bio || 'No description available.'}
                    </p>
                    {org.website && (
                      <a
                        href={org.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-tamu-maroon hover:underline mt-2 inline-block"
                      >
                        Visit website →
                      </a>
                    )}
                  </motion.div>
                ))}
              </div>
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
