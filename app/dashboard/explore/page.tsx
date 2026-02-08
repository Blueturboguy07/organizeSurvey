'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import OrgCard from '@/components/OrgCard'
import Link from 'next/link'

interface RecommendedOrg {
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
  application_required_bool?: boolean
  relevance_score?: number
}

const ACTIVITIES = [
  'Volunteering',
  'Social Events',
  'Projects',
  'Competitions',
  'Workshops',
  'Trips'
]

export default function ExplorePage() {
  const { 
    user, 
    session,
    loading: authLoading, 
    userQuery,
    userQueryLoading,
    joinedOrgIds,
    savedOrgIds
  } = useAuth()
  const router = useRouter()
  const supabase = createClientComponentClient()
  
  const [allResults, setAllResults] = useState<RecommendedOrg[]>([]) // Recommendations from query
  const [allOrgs, setAllOrgs] = useState<RecommendedOrg[]>([]) // All organizations for search
  const [filteredResults, setFilteredResults] = useState<RecommendedOrg[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [allOrgsLoading, setAllOrgsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [allOrgsFetched, setAllOrgsFetched] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Fetch all organizations for search (only once when needed)
  // Uses pagination to fetch ALL orgs (Supabase defaults to 1000 row limit)
  const fetchAllOrgs = useCallback(async () => {
    if (allOrgsFetched || allOrgsLoading) return
    
    setAllOrgsLoading(true)
    try {
      const allOrgsData: RecommendedOrg[] = []
      const PAGE_SIZE = 1000
      let offset = 0
      let hasMore = true

      // Paginate through all results (same as login page)
      while (hasMore) {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name, bio, website, typical_majors, typical_activities, club_culture_style, meeting_frequency, meeting_times, meeting_locations, dues_required, dues_cost, application_required, time_commitment, member_count, administrative_contact_info, is_on_platform, is_application_based')
          .order('name', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)
        
        if (error) {
          console.error('Error fetching orgs page:', error)
          break
        }

        if (data && data.length > 0) {
          allOrgsData.push(...data)
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      console.log(`[ExplorePage] Loaded ${allOrgsData.length} organizations for search`)
      setAllOrgs(allOrgsData)
      setAllOrgsFetched(true)
    } catch (err) {
      console.error('Failed to fetch all orgs:', err)
    } finally {
      setAllOrgsLoading(false)
    }
  }, [supabase, allOrgsFetched, allOrgsLoading])

  // Apply activity filter and search - defined before fetchRecommendations since it's used there
  const applyFilters = useCallback((results: RecommendedOrg[], filter: string, search: string = '') => {
    let filtered = results

    // Apply search filter first
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim()
      filtered = filtered.filter(org => {
        const name = (org.name || '').toLowerCase()
        const bio = (org.bio_snippet || org.bio || org.full_bio || '').toLowerCase()
        const activities = (org.typical_activities || '').toLowerCase()
        const majors = (org.typical_majors || '').toLowerCase()
        const culture = (org.club_culture_style || '').toLowerCase()
        
        return name.includes(searchLower) ||
               bio.includes(searchLower) ||
               activities.includes(searchLower) ||
               majors.includes(searchLower) ||
               culture.includes(searchLower)
      })
    }

    // Then apply activity filter
    if (filter) {
      filtered = filtered.filter(org => {
        const activities = (org.typical_activities || '').toLowerCase()
        const bio = (org.bio_snippet || org.bio || '').toLowerCase()
        const combined = `${activities} ${bio}`.toLowerCase()
        
        switch (filter) {
          case 'Volunteering':
            return combined.includes('volunteer') || combined.includes('service') || activities.includes('volunteering')
          case 'Social Events':
            return combined.includes('social') || combined.includes('networking') || combined.includes('mixer')
          case 'Projects':
            return combined.includes('project') || activities.includes('projects')
          case 'Competitions':
            return combined.includes('competition') || combined.includes('hackathon') || combined.includes('contest')
          case 'Workshops':
            return combined.includes('workshop') || combined.includes('training') || combined.includes('seminar')
          case 'Trips':
            return combined.includes('trip') || combined.includes('travel') || combined.includes('excursion')
          default:
            return true
        }
      })
    }

    setFilteredResults(filtered)
  }, [])

  // Fetch recommendations when user query is available
  const fetchRecommendations = useCallback(async () => {
    console.log('🎯 [ExplorePage] fetchRecommendations called')
    console.log('🎯 [ExplorePage] Current userQuery:', {
      hasQuery: !!userQuery?.latest_cleansed_query,
      queryLength: userQuery?.latest_cleansed_query?.length,
      queryPreview: userQuery?.latest_cleansed_query?.substring(0, 100) + '...',
      hasSession: !!session
    })
    
    if (!userQuery?.latest_cleansed_query || !session) {
      console.log('🎯 [ExplorePage] ⚠️ Missing query or session, clearing results')
      setAllResults([])
      setFilteredResults([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🎯 [ExplorePage] Fetching from /api/recommendations...')
      const response = await fetch('/api/recommendations', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        cache: 'no-store', // Ensure fresh data on every request
      })

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations')
      }

      const data = await response.json()
      const results = data.recommendations || []
      
      console.log('🎯 [ExplorePage] ✅ Received', results.length, 'recommendations')
      console.log('🎯 [ExplorePage] ════════════════════════════════════════════════')
      console.log('🎯 [ExplorePage] ⏰ API Response timestamp:', data._debug?.timestamp, '(', new Date(data._debug?.timestamp).toISOString(), ')')
      console.log('🎯 [ExplorePage] ⏰ Current time:', Date.now())
      console.log('🎯 [ExplorePage] ⏰ Response age (ms):', Date.now() - data._debug?.timestamp)
      console.log('🎯 [ExplorePage] ════════════════════════════════════════════════')
      console.log('🎯 [ExplorePage] 📅 Query updated_at from DB:', data._debug?.queryUpdatedAt)
      console.log('🎯 [ExplorePage] ════════════════════════════════════════════════')
      console.log('🎯 [ExplorePage] 🔴 API QUERY:')
      console.log('🎯 [ExplorePage]', data._debug?.fullQuerySentToSearch)
      console.log('🎯 [ExplorePage] ════════════════════════════════════════════════')
      console.log('🎯 [ExplorePage] 💻 FRONTEND QUERY:')
      console.log('🎯 [ExplorePage]', userQuery?.latest_cleansed_query)
      console.log('🎯 [ExplorePage] ════════════════════════════════════════════════')
      console.log('🎯 [ExplorePage] QUERIES MATCH:', data._debug?.fullQuerySentToSearch === userQuery?.latest_cleansed_query)
      setAllResults(results)
      applyFilters(results, selectedFilter, searchQuery)
    } catch (err: any) {
      console.error('🎯 [ExplorePage] ❌ Error fetching recommendations:', err)
      setError(err.message || 'Failed to load recommendations')
      setAllResults([])
      setFilteredResults([])
    } finally {
      setIsLoading(false)
    }
  }, [userQuery?.latest_cleansed_query, session, applyFilters])

  // Store the current query to detect changes
  const currentQuery = userQuery?.latest_cleansed_query
  
  // Debug log when currentQuery changes
  useEffect(() => {
    console.log('🎯 [ExplorePage] 🔄 currentQuery changed!')
    console.log('🎯 [ExplorePage] New currentQuery preview:', currentQuery?.substring(0, 100) + '...')
    console.log('🎯 [ExplorePage] Query length:', currentQuery?.length)
  }, [currentQuery])

  // Fetch recommendations when query changes (including real-time updates)
  useEffect(() => {
    console.log('🎯 [ExplorePage] useEffect triggered - checking if should fetch')
    console.log('🎯 [ExplorePage] userQueryLoading:', userQueryLoading)
    console.log('🎯 [ExplorePage] hasSession:', !!session)
    console.log('🎯 [ExplorePage] currentQuery preview:', currentQuery?.substring(0, 50) + '...')
    
    if (!userQueryLoading && session) {
      console.log('🎯 [ExplorePage] ✅ Conditions met - calling fetchRecommendations')
      fetchRecommendations()
    } else {
      console.log('🎯 [ExplorePage] ⏳ Conditions not met - waiting...')
    }
  }, [userQueryLoading, currentQuery, session, fetchRecommendations])

  // Reapply filters when allOrgs loads (for search)
  useEffect(() => {
    if (searchQuery.trim() && allOrgs.length > 0) {
      applyFilters(allOrgs, selectedFilter, searchQuery)
    }
  }, [allOrgs, searchQuery, selectedFilter, applyFilters])

  // Filter out joined and saved orgs from results
  const getVisibleResults = useCallback((results: RecommendedOrg[]) => {
    return results.filter(org => 
      !joinedOrgIds.has(org.id) && !savedOrgIds.has(org.id)
    )
  }, [joinedOrgIds, savedOrgIds])

  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter)
    // Use allOrgs when searching, otherwise use recommendations
    const sourceData = searchQuery.trim() ? allOrgs : allResults
    applyFilters(sourceData, filter, searchQuery)
  }

  const handleSearchChange = async (search: string) => {
    setSearchQuery(search)
    
    if (search.trim()) {
      // When searching, fetch all orgs if not already fetched
      if (!allOrgsFetched) {
        await fetchAllOrgs()
        // Note: allOrgs state won't be updated yet here, 
        // the useEffect watching allOrgs will handle filtering
      } else {
        // If orgs already fetched, apply filters immediately
        applyFilters(allOrgs, selectedFilter, search)
      }
    } else {
      // When search is cleared, go back to recommendations
      applyFilters(allResults, selectedFilter, '')
    }
  }

  // Real-time subscription for organization updates
  useEffect(() => {
    if (allResults.length === 0) return

    const channel = supabase
      .channel('explore-orgs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations'
        },
        (payload) => {
          const updatedOrg = payload.new
          // Use setter functions to access current state and avoid stale closures
          setAllResults(prev => {
            const isInResults = prev.some(org => org.id === updatedOrg.id)
            if (isInResults) {
              return prev.map(org => org.id === updatedOrg.id ? { ...org, ...updatedOrg } : org)
            }
            return prev
          })
          setFilteredResults(prev => {
            const isInResults = prev.some(org => org.id === updatedOrg.id)
            if (isInResults) {
              return prev.map(org => org.id === updatedOrg.id ? { ...org, ...updatedOrg } : org)
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [allResults.length, supabase])

  const loading = authLoading || userQueryLoading
  const hasQuery = !!userQuery?.latest_cleansed_query
  const visibleResults = getVisibleResults(filteredResults)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Explore Organizations</h2>
            <p className="text-gray-600">
              {hasQuery 
                ? `Discover organizations that match your interests`
                : 'Complete the survey to get personalized recommendations'}
            </p>
          </div>
          {hasQuery && (
            <Link href="/survey">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 text-tamu-maroon border border-tamu-maroon rounded-lg font-medium hover:bg-tamu-maroon hover:text-white transition-colors"
              >
                Update Preferences
              </motion.button>
            </Link>
          )}
        </div>
      </motion.div>

      {!hasQuery ? (
        /* No Survey Completed */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-md p-12 text-center"
        >
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Complete Your Survey</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Tell us about your interests, career goals, and preferences to get personalized organization recommendations.
          </p>
          <Link href="/survey">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-colors"
            >
              Take Survey
            </motion.button>
          </Link>
        </motion.div>
      ) : (
        <>
          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-4"
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search organizations by name, activities, majors..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-tamu-maroon/20 focus:border-tamu-maroon transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </motion.div>

          {/* Filter Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <p className="text-sm text-gray-600 mb-3">Filter by activity type:</p>
            <div className="flex flex-wrap gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleFilterChange('')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedFilter === ''
                    ? 'bg-tamu-maroon text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All
              </motion.button>
              {ACTIVITIES.map((activity) => (
                <motion.button
                  key={activity}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleFilterChange(activity)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedFilter === activity
                      ? 'bg-tamu-maroon text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {activity}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Results */}
          {(isLoading || allOrgsLoading) ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tamu-maroon mx-auto"></div>
              <p className="mt-4 text-gray-600">
                {allOrgsLoading ? 'Searching all organizations...' : 'Finding organizations for you...'}
              </p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchRecommendations}
                className="text-tamu-maroon hover:underline"
              >
                Try again
              </button>
            </div>
          ) : visibleResults.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {searchQuery || selectedFilter ? 'No matching organizations' : 'No recommendations available'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery
                  ? `No organizations found matching "${searchQuery}". Try a different search term.`
                  : selectedFilter 
                    ? 'Try a different filter or clear the filter to see all recommendations.'
                    : allResults.length > 0 
                      ? "You've already joined or saved all matching organizations!"
                      : 'Try updating your survey preferences to get more recommendations.'}
              </p>
              {(selectedFilter || searchQuery) && (
                <button
                  onClick={() => {
                    handleFilterChange('')
                    handleSearchChange('')
                  }}
                  className="text-tamu-maroon hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  {searchQuery.trim() ? (
                    <>
                      Found {visibleResults.length} organization{visibleResults.length !== 1 ? 's' : ''} matching &quot;{searchQuery}&quot;
                      <span className="text-gray-400 ml-1">(searching all orgs)</span>
                    </>
                  ) : (
                    <>
                      Showing {visibleResults.length} recommendation{visibleResults.length !== 1 ? 's' : ''}
                      {allResults.length !== visibleResults.length && (
                        <span className="text-gray-400 ml-1">
                          ({allResults.length - visibleResults.length} already joined/saved)
                        </span>
                      )}
                    </>
                  )}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Real-time updates
                </div>
              </div>

              <div className="space-y-4">
                {visibleResults.map((org, index) => (
                  <motion.div
                    key={org.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <OrgCard org={org} showScore={!searchQuery.trim()} showActions={true} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}

