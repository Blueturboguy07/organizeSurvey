'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'

// Scrolling organization names background component
function ScrollingOrgsBackground({ organizations }: { organizations: string[] }) {
  if (organizations.length === 0) return null
  
  // Create multiple rows with different speeds and directions
  const rows = [
    { orgs: organizations.slice(0, Math.ceil(organizations.length / 3)), duration: 60, direction: 'left' },
    { orgs: organizations.slice(Math.ceil(organizations.length / 3), Math.ceil(2 * organizations.length / 3)), duration: 45, direction: 'right' },
    { orgs: organizations.slice(Math.ceil(2 * organizations.length / 3)), duration: 55, direction: 'left' },
  ]
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-white/60 z-10" />
      
      {/* Scrolling rows */}
      <div className="absolute inset-0 flex flex-col justify-center gap-4 opacity-40">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="relative overflow-hidden whitespace-nowrap">
            <div 
              className={`inline-flex gap-8 ${row.direction === 'left' ? 'animate-scroll-left' : 'animate-scroll-right'}`}
              style={{ 
                animationDuration: `${row.duration}s`,
              }}
            >
              {/* Duplicate the content for seamless loop */}
              {[...row.orgs, ...row.orgs].map((org, index) => (
                <span 
                  key={`${rowIndex}-${index}`} 
                  className="text-tamu-maroon/30 text-lg font-medium px-4"
                >
                  {org}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  // Use AuthContext for real-time auth state and user data
  // AuthContext maintains real-time subscriptions to user_profiles and user_queries tables
  // All user data (profile, query) updates automatically when changed elsewhere
  const { 
    user, 
    loading: authLoading, 
    signOut,
    userProfile,        // Real-time profile data (name, picture, preferences)
    userProfileLoading,
    userQuery,          // Real-time survey query data (interests, demographics)
    userQueryLoading
  } = useAuth()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [imageError, setImageError] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [organizationNames, setOrganizationNames] = useState<string[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Fetch organization names for the scrolling background
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('name')
          .limit(100)
        
        if (error) {
          console.error('Error fetching organizations:', error)
          return
        }
        
        if (data) {
          // Shuffle the names for variety
          const names = data.map(org => org.name).sort(() => Math.random() - 0.5)
          setOrganizationNames(names)
        }
      } catch (err) {
        console.error('Failed to fetch organizations:', err)
      }
    }
    
    fetchOrganizations()
  }, [supabase])

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

        {/* My Orgs - Central Component with scrolling org names background */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative rounded-lg shadow-md overflow-hidden"
        >
          {/* Scrolling organizations background */}
          <ScrollingOrgsBackground organizations={organizationNames} />
          
          {/* Main content */}
          <div className="relative z-20 bg-white/90 backdrop-blur-sm p-6 sm:p-8">
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
          </div>
        </motion.div>
      </main>
    </div>
  )
}
