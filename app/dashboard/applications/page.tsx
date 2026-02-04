'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { createClientComponentClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { RealtimeChannel } from '@supabase/supabase-js'
import Link from 'next/link'

interface Application {
  id: string
  organization_id: string
  applicant_name: string
  applicant_email: string
  why_join: string
  status: 'waiting' | 'interview' | 'accepted' | 'rejected'
  created_at: string
  status_updated_at: string
  interview_message: string | null
  organization: {
    id: string
    name: string
    bio: string | null
    club_type: string | null
  }
}

const STATUS_CONFIG = {
  waiting: { 
    label: 'Waiting', 
    color: 'bg-orange-100 text-orange-700 border-orange-200', 
    icon: '⏳',
    description: 'Your application is being reviewed'
  },
  interview: { 
    label: 'Interview', 
    color: 'bg-blue-100 text-blue-700 border-blue-200', 
    icon: '📅',
    description: 'You\'ve been selected for an interview!'
  },
  accepted: { 
    label: 'Accepted', 
    color: 'bg-green-100 text-green-700 border-green-200', 
    icon: '✓',
    description: 'Congratulations! You\'ve been accepted'
  },
  rejected: { 
    label: 'Rejected', 
    color: 'bg-red-100 text-red-700 border-red-200', 
    icon: '✗',
    description: 'Unfortunately, your application was not accepted'
  },
}

export default function ApplicationsPage() {
  const { user, session, loading: authLoading, appliedOrgIds, joinedOrgIds, refreshJoinedOrgs } = useAuth()
  const router = useRouter()
  const supabase = createClientComponentClient()
  
  const [joiningOrgId, setJoiningOrgId] = useState<string | null>(null)

  // Handle joining after being accepted
  const handleJoinOrg = async (organizationId: string) => {
    if (!user) return
    
    setJoiningOrgId(organizationId)
    
    try {
      const { error } = await supabase
        .from('user_joined_organizations')
        .insert({
          user_id: user.id,
          organization_id: organizationId
        })
      
      if (error) {
        if (error.code === '23505') {
          // Already joined - just refresh
          console.log('Already a member')
        } else {
          console.error('Error joining:', error)
        }
      }
      
      // Refresh joined orgs to update UI
      await refreshJoinedOrgs()
    } catch (err) {
      console.error('Failed to join:', err)
    } finally {
      setJoiningOrgId(null)
    }
  }
  
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'waiting' | 'interview' | 'accepted' | 'rejected'>('all')

  // Fetch user's applications
  const fetchApplications = useCallback(async () => {
    if (!session) return
    
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: fetchError } = await supabase
        .from('applications')
        .select(`
          id,
          organization_id,
          applicant_name,
          applicant_email,
          why_join,
          status,
          created_at,
          status_updated_at,
          interview_message,
          organization:organizations(id, name, bio, club_type)
        `)
        .order('created_at', { ascending: false })
      
      if (fetchError) {
        console.error('Error fetching applications:', fetchError)
        setError('Failed to load applications')
      } else {
        // Transform the data to handle the nested organization object
        const transformedData = (data || []).map(app => ({
          ...app,
          organization: Array.isArray(app.organization) ? app.organization[0] : app.organization
        })) as Application[]
        setApplications(transformedData)
      }
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Failed to load applications')
    } finally {
      setLoading(false)
    }
  }, [session, supabase])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Fetch applications and set up realtime subscription
  useEffect(() => {
    if (!session || !user) return
    
    fetchApplications()
    
    // Set up realtime subscription for application updates
    const channel: RealtimeChannel = supabase
      .channel(`user-applications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'applications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📋 Application status updated:', payload)
          // Refetch to get full data with organization info
          fetchApplications()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'applications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📋 Application deleted:', payload)
          setApplications(prev => prev.filter(app => app.id !== payload.old.id))
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, user, supabase, fetchApplications])

  // Filter applications
  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true
    return app.status === filter
  })

  // Count by status
  const statusCounts = {
    all: applications.length,
    waiting: applications.filter(a => a.status === 'waiting').length,
    interview: applications.filter(a => a.status === 'interview').length,
    accepted: applications.filter(a => a.status === 'accepted').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  }

  const pageLoading = authLoading || loading

  if (pageLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Applications</h1>
            <p className="text-gray-600 mt-1">Track the status of your organization applications</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs text-gray-500">Real-time updates</span>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'waiting', 'interview', 'accepted', 'rejected'] as const).map((status) => {
            const config = status === 'all' ? null : STATUS_CONFIG[status]
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === status
                    ? status === 'all'
                      ? 'bg-tamu-maroon text-white'
                      : config?.color + ' ring-2 ring-offset-1'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {status === 'all' ? 'All' : `${config?.icon} ${config?.label}`}
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                  {statusCounts[status]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* Applications List */}
        {filteredApplications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {filter === 'all' ? 'No applications yet' : `No ${filter} applications`}
            </h3>
            <p className="text-gray-600 mb-4">
              {filter === 'all' 
                ? 'When you apply to organizations, they\'ll appear here.'
                : `You don't have any applications with "${filter}" status.`}
            </p>
            <Link href="/dashboard/explore">
              <button className="px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors">
                Explore Organizations
              </button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {filteredApplications.map((app, index) => {
                const statusConfig = STATUS_CONFIG[app.status]
                return (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-800 mb-1">
                            {app.organization?.name || 'Unknown Organization'}
                          </h3>
                          {app.organization?.club_type && (
                            <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs mb-2">
                              {app.organization.club_type}
                            </span>
                          )}
                          {app.organization?.bio && app.organization.bio !== 'nan' && (
                            <p className="text-sm text-gray-600 line-clamp-2">{app.organization.bio}</p>
                          )}
                        </div>
                        
                        {/* Status Badge */}
                        <div className="flex-shrink-0">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${statusConfig.color}`}>
                            <span>{statusConfig.icon}</span>
                            <span>{statusConfig.label}</span>
                          </span>
                        </div>
                      </div>
                      
                      {/* Status Description & Action */}
                      <div className={`mt-4 p-3 rounded-lg ${statusConfig.color.replace('text-', 'text-').replace('bg-', 'bg-')}`}>
                        <p className="text-sm font-medium">{statusConfig.description}</p>
                        
                        {/* Show interview message if exists */}
                        {app.status === 'interview' && app.interview_message && (
                          <div className="mt-3 p-3 bg-white/80 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                              </svg>
                              <span className="text-xs font-semibold text-blue-700">Message from {app.organization?.name}:</span>
                            </div>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{app.interview_message}</p>
                          </div>
                        )}
                        
                        {/* Show Join button if accepted and not yet joined */}
                        {app.status === 'accepted' && !joinedOrgIds.has(app.organization_id) && (
                          <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => handleJoinOrg(app.organization_id)}
                            disabled={joiningOrgId === app.organization_id}
                            className="mt-3 w-full px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {joiningOrgId === app.organization_id ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Joining...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Join Now
                              </>
                            )}
                          </motion.button>
                        )}
                        
                        {/* Show "Already Joined" if accepted and joined */}
                        {app.status === 'accepted' && joinedOrgIds.has(app.organization_id) && (
                          <div className="mt-3 flex items-center justify-center gap-2 text-green-700 font-medium">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            You&apos;re now a member!
                          </div>
                        )}
                      </div>
                      
                      {/* Application Details */}
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Applied as</span>
                          <p className="font-medium text-gray-800">{app.applicant_name}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Applied on</span>
                          <p className="font-medium text-gray-800">
                            {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Last Updated */}
                      {app.status !== 'waiting' && app.status_updated_at && (
                        <p className="text-xs text-gray-400 mt-3">
                          Status updated: {new Date(app.status_updated_at).toLocaleDateString()} at {new Date(app.status_updated_at).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

