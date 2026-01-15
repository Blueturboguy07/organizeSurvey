'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import DashboardLayout from '@/components/DashboardLayout'
import OrgCard from '@/components/OrgCard'
import Link from 'next/link'

interface JoinedOrg {
  id: string
  name: string
  bio?: string
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
  joined_at: string
}

export default function MyOrgsPage() {
  const { 
    user, 
    session,
    loading: authLoading, 
    userProfile,
    userQuery,
    userQueryLoading,
    joinedOrgIds,
    joinedOrgIdsLoading
  } = useAuth()
  const router = useRouter()
  const [joinedOrgs, setJoinedOrgs] = useState<JoinedOrg[]>([])
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [orgsError, setOrgsError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Fetch full org details when joined org IDs change
  useEffect(() => {
    const fetchJoinedOrgs = async () => {
      if (!session || joinedOrgIds.size === 0) {
        setJoinedOrgs([])
        return
      }

      setOrgsLoading(true)
      setOrgsError(null)

      try {
        const response = await fetch('/api/orgs/joined', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch joined organizations')
        }

        const data = await response.json()
        setJoinedOrgs(data.organizations || [])
      } catch (error: any) {
        console.error('Error fetching joined orgs:', error)
        setOrgsError(error.message)
      } finally {
        setOrgsLoading(false)
      }
    }

    fetchJoinedOrgs()
  }, [session, joinedOrgIds])

  const loading = authLoading || joinedOrgIdsLoading

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

  const hasQuery = !!userQuery?.latest_cleansed_query
  const hasJoinedOrgs = joinedOrgs.length > 0

  return (
    <DashboardLayout>
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Welcome back{userProfile?.name ? `, ${userProfile.name.split(' ')[0]}` : ''}!
        </h2>
        <p className="text-gray-600">
          {hasJoinedOrgs 
            ? `You've joined ${joinedOrgs.length} organization${joinedOrgs.length !== 1 ? 's' : ''}`
            : 'Start exploring and joining organizations that match your interests'}
        </p>
      </motion.div>

      {/* My Organizations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800">My Organizations</h3>
          {!hasQuery && (
            <Link href="/survey">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors"
              >
                Complete Survey
              </motion.button>
            </Link>
          )}
        </div>

        {orgsLoading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tamu-maroon mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your organizations...</p>
          </div>
        ) : orgsError ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <p className="text-red-600">{orgsError}</p>
          </div>
        ) : hasJoinedOrgs ? (
          <div className="space-y-4">
            {joinedOrgs.map((org, index) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <OrgCard org={org} showActions={true} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h4 className="text-xl font-semibold text-gray-700 mb-2">No organizations yet</h4>
            <p className="text-gray-500 mb-6">
              {hasQuery 
                ? "You haven't joined any organizations yet. Explore recommendations to find your perfect match!"
                : "Complete the survey to get personalized organization recommendations."}
            </p>
            <Link href={hasQuery ? "/dashboard/explore" : "/survey"}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-colors"
              >
                {hasQuery ? "Explore Organizations" : "Take Survey"}
              </motion.button>
            </Link>
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  )
}
