'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import OrgCard from '@/components/OrgCard'
import Link from 'next/link'

interface SavedOrg {
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
  saved_at: string
  notified_at?: string
  auto_joined_at?: string
}

export default function SavedPage() {
  const { 
    user, 
    session,
    loading: authLoading, 
    savedOrgIds,
    savedOrgIdsLoading,
    userQuery
  } = useAuth()
  const router = useRouter()
  const supabase = createClientComponentClient()
  
  const [savedOrgs, setSavedOrgs] = useState<SavedOrg[]>([])
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [orgsError, setOrgsError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Fetch full org details when saved org IDs change
  useEffect(() => {
    const fetchSavedOrgs = async () => {
      if (!session || savedOrgIds.size === 0) {
        setSavedOrgs([])
        return
      }

      setOrgsLoading(true)
      setOrgsError(null)

      try {
        const response = await fetch('/api/orgs/saved', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch saved organizations')
        }

        const data = await response.json()
        setSavedOrgs(data.organizations || [])
      } catch (error: any) {
        console.error('Error fetching saved orgs:', error)
        setOrgsError(error.message)
      } finally {
        setOrgsLoading(false)
      }
    }

    fetchSavedOrgs()
  }, [session, savedOrgIds])

  // Real-time subscription for organization updates
  useEffect(() => {
    if (savedOrgs.length === 0) return

    const channel = supabase
      .channel('saved-orgs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations'
        },
        (payload) => {
          const updatedOrg = payload.new
          // Use setter function to access current state and avoid stale closure
          setSavedOrgs(prev => {
            const isInSaved = prev.some(org => org.id === updatedOrg.id)
            if (isInSaved) {
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
  }, [savedOrgs.length, supabase])

  const loading = authLoading || savedOrgIdsLoading
  const hasSavedOrgs = savedOrgs.length > 0
  const hasQuery = !!userQuery?.latest_cleansed_query

  // Separate orgs by platform status
  const onPlatformOrgs = savedOrgs.filter(org => org.is_on_platform)
  const notOnPlatformOrgs = savedOrgs.filter(org => !org.is_on_platform)

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
        className="mb-8"
      >
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Saved Organizations</h2>
        <p className="text-gray-600">
          {hasSavedOrgs 
            ? `You've saved ${savedOrgs.length} organization${savedOrgs.length !== 1 ? 's' : ''} for later`
            : 'Save organizations you want to join later or when they come on the platform'}
        </p>
      </motion.div>

      {orgsLoading ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tamu-maroon mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading saved organizations...</p>
        </div>
      ) : orgsError ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-red-600">{orgsError}</p>
        </div>
      ) : !hasSavedOrgs ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-md p-12 text-center"
        >
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No saved organizations</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Save organizations you&apos;re interested in for later. You&apos;ll be notified when organizations you&apos;ve saved join the platform.
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
        </motion.div>
      ) : (
        <div className="space-y-8">
          {/* Organizations on Platform */}
          {onPlatformOrgs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-xl font-bold text-gray-800">Ready to Join</h3>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  {onPlatformOrgs.length} on platform
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                These organizations are on the platform. You can join them now!
              </p>
              <div className="space-y-4">
                {onPlatformOrgs.map((org, index) => (
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
            </motion.div>
          )}

          {/* Organizations not on Platform */}
          {notOnPlatformOrgs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-xl font-bold text-gray-800">Waiting for Platform</h3>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                  {notOnPlatformOrgs.length} not on platform yet
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                These organizations aren't on the platform yet. You'll be notified when they join, and if they don't require an application, you'll be automatically added!
              </p>
              <div className="space-y-4">
                {notOnPlatformOrgs.map((org, index) => (
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
            </motion.div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}

