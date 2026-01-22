'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import Image from 'next/image'
import Link from 'next/link'
import FormBuilder from '@/components/FormBuilder'

interface Application {
  id: string
  user_id: string
  applicant_name: string
  applicant_email: string
  why_join: string
  status: 'waiting' | 'interview' | 'accepted' | 'rejected'
  created_at: string
  status_updated_at: string
  internal_notes: string | null
  rank: number | null
}

const APPLICATION_STATUSES = [
  { value: 'waiting', label: 'Waiting', color: 'bg-orange-100 text-orange-700', icon: '⏳' },
  { value: 'interview', label: 'Interview', color: 'bg-blue-100 text-blue-700', icon: '📅' },
  { value: 'accepted', label: 'Accepted', color: 'bg-green-100 text-green-700', icon: '✓' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700', icon: '✗' },
] as const

export default function OrgApplicationsPage() {
  const [loading, setLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string>('')
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  
  // Applications state
  const [applications, setApplications] = useState<Application[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [showFormBuilder, setShowFormBuilder] = useState(false)
  
  // Application review tools state
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'interview' | 'accepted' | 'rejected'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'rank' | 'name'>('date')
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [editingRank, setEditingRank] = useState<string | null>(null)
  const [rankValue, setRankValue] = useState<string>('')
  const [savingRank, setSavingRank] = useState(false)
  
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Verify user is an org account and get organization info
  const verifyAndFetchOrg = useCallback(async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        router.push('/login')
        return
      }

      if (!user.user_metadata?.is_org_account) {
        router.push('/dashboard')
        return
      }

      const { data: orgAccount, error: orgAccountError } = await supabase
        .from('org_accounts')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (orgAccountError || !orgAccount) {
        setError('Organization account not found')
        setLoading(false)
        return
      }

      // Get org name
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgAccount.organization_id)
        .single()

      setOrganizationId(orgAccount.organization_id)
      setOrganizationName(orgData?.name || 'Organization')
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load')
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    verifyAndFetchOrg()
  }, [verifyAndFetchOrg])

  // Fetch and subscribe to applications (realtime)
  useEffect(() => {
    if (!organizationId) return

    let applicationsChannel: RealtimeChannel | null = null

    const fetchApplications = async () => {
      setApplicationsLoading(true)
      const { data, error } = await supabase
        .from('applications')
        .select('id, user_id, applicant_name, applicant_email, why_join, status, created_at, status_updated_at, internal_notes, rank')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching applications:', error)
      } else {
        setApplications(data || [])
      }
      setApplicationsLoading(false)
    }

    fetchApplications()

    // Subscribe to realtime changes
    applicationsChannel = supabase
      .channel(`applications-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          console.log('📋 Applications realtime update:', payload)
          if (payload.eventType === 'INSERT') {
            setApplications(prev => [payload.new as Application, ...prev])
          } else if (payload.eventType === 'DELETE') {
            setApplications(prev => prev.filter(app => app.id !== payload.old.id))
          } else if (payload.eventType === 'UPDATE') {
            setApplications(prev => prev.map(app => 
              app.id === payload.new.id ? payload.new as Application : app
            ))
            // Update selected application if it's the one being updated
            if (selectedApplication && selectedApplication.id === payload.new.id) {
              setSelectedApplication(payload.new as Application)
            }
          }
        }
      )
      .subscribe()

    return () => {
      if (applicationsChannel) {
        supabase.removeChannel(applicationsChannel)
      }
    }
  }, [organizationId, supabase, selectedApplication])

  // Update application status
  const updateApplicationStatus = async (applicationId: string, newStatus: Application['status']) => {
    if (!organizationId) return
    
    try {
      const { error } = await supabase
        .from('applications')
        .update({ 
          status: newStatus,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)
      
      if (error) {
        console.error('Error updating application status:', error)
        setError('Failed to update application status')
        return
      }
      
      if (newStatus === 'accepted') {
        setSaveSuccess('Application accepted! User can now join the organization.')
      } else {
        setSaveSuccess(`Application status updated to ${newStatus}`)
      }
      
      setTimeout(() => setSaveSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update status')
    }
  }

  // Save internal notes for an application
  const saveInternalNotes = async (applicationId: string, notes: string) => {
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('applications')
        .update({ internal_notes: notes })
        .eq('id', applicationId)
      
      if (error) {
        console.error('Error saving notes:', error)
        setError('Failed to save notes')
      } else {
        setEditingNotes(null)
        setSaveSuccess('Notes saved')
        setTimeout(() => setSaveSuccess(''), 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save notes')
    }
    setSavingNotes(false)
  }

  // Update candidate rank
  const updateCandidateRank = async (applicationId: string, rank: number | null) => {
    setSavingRank(true)
    try {
      const { error } = await supabase
        .from('applications')
        .update({ rank })
        .eq('id', applicationId)
      
      if (error) {
        console.error('Error updating rank:', error)
        setError('Failed to update rank')
      } else {
        setEditingRank(null)
        setSaveSuccess('Rank updated')
        setTimeout(() => setSaveSuccess(''), 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update rank')
    }
    setSavingRank(false)
  }

  // Get filtered and sorted applications
  const getFilteredApplications = () => {
    let filtered = [...applications]
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(app => app.status === statusFilter)
    }
    
    // Apply sort
    switch (sortBy) {
      case 'rank':
        filtered.sort((a, b) => {
          if (a.rank === null && b.rank === null) return 0
          if (a.rank === null) return 1
          if (b.rank === null) return -1
          return a.rank - b.rank
        })
        break
      case 'name':
        filtered.sort((a, b) => a.applicant_name.localeCompare(b.applicant_name))
        break
      case 'date':
      default:
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
    }
    
    return filtered
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Organization not found'}</p>
          <button onClick={() => router.push('/login')} className="text-tamu-maroon hover:underline">
            Return to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/org/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                <Image 
                  src="/logo.png" 
                  alt="ORGanize TAMU Logo" 
                  width={36}
                  height={36}
                  className="flex-shrink-0 object-contain"
                />
                <div>
                  <h1 className="text-lg font-bold text-tamu-maroon">Applications</h1>
                  <p className="text-xs text-gray-500">{organizationName}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-xs text-gray-500 hidden sm:inline">Live</span>
              </div>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-tamu-maroon border border-gray-300 rounded-lg hover:border-tamu-maroon transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Success/Error Messages */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-800"
            >
              {saveSuccess}
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-800"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
          >
            <p className="text-xs text-gray-500 font-medium">Total</p>
            <p className="text-2xl font-bold text-gray-800">{applications.length}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
          >
            <p className="text-xs text-orange-600 font-medium">⏳ Waiting</p>
            <p className="text-2xl font-bold text-orange-600">{applications.filter(a => a.status === 'waiting').length}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
          >
            <p className="text-xs text-blue-600 font-medium">📅 Interview</p>
            <p className="text-2xl font-bold text-blue-600">{applications.filter(a => a.status === 'interview').length}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
          >
            <p className="text-xs text-green-600 font-medium">✓ Accepted</p>
            <p className="text-2xl font-bold text-green-600">{applications.filter(a => a.status === 'accepted').length}</p>
          </motion.div>
        </div>

        {/* Form Builder Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6"
        >
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowFormBuilder(!showFormBuilder)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Application Form Builder</h3>
                <p className="text-xs text-gray-500">
                  Customize the questions applicants need to answer
                </p>
              </div>
            </div>
            <motion.svg
              animate={{ rotate: showFormBuilder ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
          </div>

          <AnimatePresence>
            {showFormBuilder && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-4 pt-4 border-t border-gray-100"
              >
                <FormBuilder organizationId={organizationId} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Applications Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">All Applications</h3>
                <p className="text-xs text-gray-500">
                  {applicationsLoading ? 'Loading...' : `${applications.length} total application${applications.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </div>

          {/* Filter and Sort Controls */}
          <div className="mb-4 pb-4 border-b border-gray-100">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              {/* Status Filter Tabs */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    statusFilter === 'all'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All ({applications.length})
                </button>
                {APPLICATION_STATUSES.map((status) => {
                  const count = applications.filter(a => a.status === status.value).length
                  return (
                    <button
                      key={status.value}
                      onClick={() => setStatusFilter(status.value as typeof statusFilter)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        statusFilter === status.value
                          ? status.color
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status.icon} {status.label} ({count})
                    </button>
                  )
                })}
              </div>
              
              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-tamu-maroon"
                >
                  <option value="date">Date Applied</option>
                  <option value="rank">Rank</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
          </div>

          {/* Applications List */}
          <div className="space-y-2">
            {getFilteredApplications().length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-12">
                {applications.length === 0 
                  ? "No applications yet. When users apply, they'll appear here."
                  : "No applications match the current filter."}
              </p>
            ) : (
              getFilteredApplications().map((app, index) => {
                const currentStatus = APPLICATION_STATUSES.find(s => s.value === app.status) || APPLICATION_STATUSES[0]
                return (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => setSelectedApplication(app)}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-tamu-maroon/30 hover:bg-gray-100 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Rank Badge */}
                        <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                          {app.rank !== null ? (
                            <span className="text-sm font-bold text-tamu-maroon">#{app.rank}</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-800">{app.applicant_name}</h4>
                            {app.internal_notes && (
                              <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0v2h2V8H9zm6 0h-2v2h2V8z" />
                              </svg>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{app.applicant_email}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Applied {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${currentStatus.color}`}>
                          {currentStatus.icon} {currentStatus.label}
                        </span>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-tamu-maroon transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </motion.div>

        {/* Support Contact */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            Need help?{' '}
            <a 
              href="mailto:mannbellani1@tamu.edu" 
              className="text-tamu-maroon hover:underline"
            >
              Contact support
            </a>
          </p>
        </div>
      </main>

      {/* Application Detail Modal */}
      <AnimatePresence>
        {selectedApplication && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedApplication(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-tamu-maroon/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-tamu-maroon">
                      {selectedApplication.applicant_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-800">{selectedApplication.applicant_name}</h2>
                    <p className="text-sm text-gray-500">{selectedApplication.applicant_email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedApplication(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Status & Rank Row */}
                <div className="flex flex-wrap gap-4">
                  {/* Status Section */}
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-xs text-gray-500 font-medium mb-2">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {APPLICATION_STATUSES.map((status) => (
                        <button
                          key={status.value}
                          onClick={() => {
                            updateApplicationStatus(selectedApplication.id, status.value)
                            setSelectedApplication({ ...selectedApplication, status: status.value })
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            selectedApplication.status === status.value
                              ? `${status.color} ring-2 ring-offset-1 ring-gray-300`
                              : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          {status.icon} {status.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Rank Section */}
                  <div className="w-32">
                    <p className="text-xs text-gray-500 font-medium mb-2">Rank</p>
                    {editingRank === selectedApplication.id ? (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={rankValue}
                          onChange={(e) => setRankValue(e.target.value)}
                          className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-tamu-maroon"
                          placeholder="#"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            const newRank = rankValue ? parseInt(rankValue) : null
                            updateCandidateRank(selectedApplication.id, newRank)
                            setSelectedApplication({ ...selectedApplication, rank: newRank })
                          }}
                          disabled={savingRank}
                          className="px-2 py-1.5 bg-tamu-maroon text-white text-xs rounded-lg hover:bg-tamu-maroon-light disabled:opacity-50"
                        >
                          {savingRank ? '...' : '✓'}
                        </button>
                        <button
                          onClick={() => setEditingRank(null)}
                          className="px-2 py-1.5 bg-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-300"
                        >
                          ✗
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingRank(selectedApplication.id)
                          setRankValue(selectedApplication.rank?.toString() || '')
                        }}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        {selectedApplication.rank !== null ? `#${selectedApplication.rank}` : 'Set Rank'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Why They Want to Join */}
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-2">Why they want to join</p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedApplication.why_join}</p>
                  </div>
                </div>

                {/* Internal Notes - Only visible to org */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 font-medium">Internal Notes</p>
                    <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">Only visible to you</span>
                  </div>
                  {editingNotes === selectedApplication.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-tamu-maroon resize-none"
                        placeholder="Add private notes about this candidate..."
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingNotes(null)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            saveInternalNotes(selectedApplication.id, notesValue)
                            setSelectedApplication({ ...selectedApplication, internal_notes: notesValue })
                          }}
                          disabled={savingNotes}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-tamu-maroon rounded-lg hover:bg-tamu-maroon-light disabled:opacity-50"
                        >
                          {savingNotes ? 'Saving...' : 'Save Notes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setEditingNotes(selectedApplication.id)
                        setNotesValue(selectedApplication.internal_notes || '')
                      }}
                      className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 cursor-pointer hover:border-yellow-200 transition-colors min-h-[80px]"
                    >
                      {selectedApplication.internal_notes ? (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedApplication.internal_notes}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Click to add notes...</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Meta Info */}
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Applied on {new Date(selectedApplication.created_at).toLocaleDateString()} at {new Date(selectedApplication.created_at).toLocaleTimeString()}
                    {selectedApplication.status_updated_at && selectedApplication.status_updated_at !== selectedApplication.created_at && (
                      <> · Status updated {new Date(selectedApplication.status_updated_at).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
