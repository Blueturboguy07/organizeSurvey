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
  responses: Record<string, string | string[]> | null
}

interface FormQuestion {
  id: string
  question_text: string
  question_type: 'short_text' | 'long_text' | 'multiple_choice'
  is_required: boolean
  order_index: number
  settings: {
    word_limit?: number
    options?: string[]
    allow_multiple?: boolean
  }
}

const APPLICATION_STATUSES = [
  { value: 'waiting', label: 'Waiting', color: 'bg-orange-100 text-orange-700', dotColor: 'bg-orange-500', icon: '⏳' },
  { value: 'interview', label: 'Interview', color: 'bg-blue-100 text-blue-700', dotColor: 'bg-blue-500', icon: '📅' },
  { value: 'accepted', label: 'Accepted', color: 'bg-green-100 text-green-700', dotColor: 'bg-green-500', icon: '✓' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700', dotColor: 'bg-red-500', icon: '✗' },
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
  
  // Form questions
  const [formQuestions, setFormQuestions] = useState<FormQuestion[]>([])
  
  // Sidebar state
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'interview' | 'accepted' | 'rejected'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'rank' | 'name'>('date')
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  
  // Detail panel state
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [editingRank, setEditingRank] = useState(false)
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
      
      // Fetch form questions for this org
      const { data: formData } = await supabase
        .from('org_forms')
        .select('id')
        .eq('organization_id', orgAccount.organization_id)
        .single()
      
      if (formData) {
        const { data: questionsData } = await supabase
          .from('form_questions')
          .select('*')
          .eq('form_id', formData.id)
          .order('order_index', { ascending: true })
        
        if (questionsData) {
          console.log('📝 Form questions loaded:', questionsData)
          setFormQuestions(questionsData)
        }
      }
      
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
        .select('id, user_id, applicant_name, applicant_email, why_join, status, created_at, status_updated_at, internal_notes, rank, responses')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching applications:', error)
      } else {
        setApplications(data || [])
        // Auto-select first application if none selected
        if (data && data.length > 0 && !selectedApplication) {
          setSelectedApplication(data[0])
        }
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
            // Clear selection if deleted
            if (selectedApplication && selectedApplication.id === payload.old.id) {
              setSelectedApplication(null)
            }
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
        setSaveSuccess('Application accepted!')
      } else {
        setSaveSuccess(`Status updated to ${newStatus}`)
      }
      
      setTimeout(() => setSaveSuccess(''), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to update status')
    }
  }

  // Save internal notes for an application
  const saveInternalNotes = async () => {
    if (!selectedApplication) return
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('applications')
        .update({ internal_notes: notesValue })
        .eq('id', selectedApplication.id)
      
      if (error) {
        console.error('Error saving notes:', error)
        setError('Failed to save notes')
      } else {
        setEditingNotes(false)
        setSaveSuccess('Notes saved')
        setTimeout(() => setSaveSuccess(''), 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save notes')
    }
    setSavingNotes(false)
  }

  // Update candidate rank
  const updateCandidateRank = async () => {
    if (!selectedApplication) return
    setSavingRank(true)
    const rank = rankValue ? parseInt(rankValue) : null
    try {
      const { error } = await supabase
        .from('applications')
        .update({ rank })
        .eq('id', selectedApplication.id)
      
      if (error) {
        console.error('Error updating rank:', error)
        setError('Failed to update rank')
      } else {
        setEditingRank(false)
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

  // When selecting an application, reset editing states
  const handleSelectApplication = (app: Application) => {
    setSelectedApplication(app)
    setEditingNotes(false)
    setEditingRank(false)
    setNotesValue(app.internal_notes || '')
    setRankValue(app.rank?.toString() || '')
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

  const filteredApps = getFilteredApplications()

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 z-40">
        <div className="px-4 sm:px-6 py-3">
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
              {/* Form Builder Toggle */}
              <button
                onClick={() => setShowFormBuilder(!showFormBuilder)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                  showFormBuilder 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="hidden sm:inline">Form Builder</span>
              </button>
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

      {/* Success/Error Toast */}
      <AnimatePresence>
        {(saveSuccess || error) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
              saveSuccess ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {saveSuccess || error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form Builder Panel */}
      <AnimatePresence>
        {showFormBuilder && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-b border-gray-200 overflow-hidden flex-shrink-0"
          >
            <div className="max-w-4xl mx-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Application Form Builder</h2>
                <button
                  onClick={() => setShowFormBuilder(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <FormBuilder organizationId={organizationId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Sidebar Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Applications List */}
        <div className="w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          {/* Sidebar Header - Filters */}
          <div className="p-4 border-b border-gray-100 flex-shrink-0">
            {/* Status Filter Tabs */}
            <div className="flex flex-wrap gap-1 mb-3">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
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
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                      statusFilter === status.value
                        ? status.color
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {count}
                  </button>
                )
              })}
            </div>
            
            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-tamu-maroon bg-gray-50"
            >
              <option value="date">Sort by Date</option>
              <option value="rank">Sort by Rank</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>

          {/* Applications List */}
          <div className="flex-1 overflow-y-auto">
            {applicationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tamu-maroon"></div>
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">
                  {applications.length === 0 
                    ? "No applications yet"
                    : "No applications match filter"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredApps.map((app) => {
                  const statusInfo = APPLICATION_STATUSES.find(s => s.value === app.status) || APPLICATION_STATUSES[0]
                  const isSelected = selectedApplication?.id === app.id
                  return (
                    <motion.div
                      key={app.id}
                      onClick={() => handleSelectApplication(app)}
                      className={`p-4 cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-tamu-maroon/5 border-l-4 border-tamu-maroon' 
                          : 'hover:bg-gray-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Rank Badge */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          app.rank !== null ? 'bg-tamu-maroon/10' : 'bg-gray-100'
                        }`}>
                          {app.rank !== null ? (
                            <span className="text-xs font-bold text-tamu-maroon">#{app.rank}</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={`font-medium truncate ${isSelected ? 'text-tamu-maroon' : 'text-gray-800'}`}>
                              {app.applicant_name}
                            </h4>
                            {app.internal_notes && (
                              <svg className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2z" />
                              </svg>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{app.applicant_email}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`}></span>
                            <span className="text-xs text-gray-500">{statusInfo.label}</span>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-400">
                              {new Date(app.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Application Detail */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {selectedApplication ? (
            <div className="max-w-3xl mx-auto p-6">
              {/* Applicant Header */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-tamu-maroon to-tamu-maroon-light flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">
                        {selectedApplication.applicant_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-800">{selectedApplication.applicant_name}</h2>
                      <p className="text-gray-500">{selectedApplication.applicant_email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Applied {new Date(selectedApplication.created_at).toLocaleDateString()} at {new Date(selectedApplication.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Rank */}
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-medium mb-1">Rank</p>
                    {editingRank ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={rankValue}
                          onChange={(e) => setRankValue(e.target.value)}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-tamu-maroon text-center"
                          placeholder="#"
                          autoFocus
                        />
                        <button
                          onClick={updateCandidateRank}
                          disabled={savingRank}
                          className="p-1.5 bg-tamu-maroon text-white rounded-lg hover:bg-tamu-maroon-light disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditingRank(false)}
                          className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingRank(true)
                          setRankValue(selectedApplication.rank?.toString() || '')
                        }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-lg font-bold rounded-lg hover:bg-gray-200 transition-colors min-w-[60px]"
                      >
                        {selectedApplication.rank !== null ? `#${selectedApplication.rank}` : '—'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <p className="text-sm text-gray-500 font-medium mb-3">Application Status</p>
                <div className="flex flex-wrap gap-2">
                  {APPLICATION_STATUSES.map((status) => {
                    const isActive = selectedApplication.status === status.value
                    return (
                      <button
                        key={status.value}
                        onClick={() => updateApplicationStatus(selectedApplication.id, status.value)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                          isActive
                            ? `${status.color} ring-2 ring-offset-2 ring-gray-300`
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {status.icon} {status.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Application Responses */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <p className="text-sm text-gray-500 font-medium mb-4">Application Responses</p>
                
                {formQuestions.length > 0 ? (
                  <div className="space-y-4">
                    {formQuestions.map((question, index) => {
                      // Get response from the JSON column
                      const responses = selectedApplication.responses || {}
                      const response = responses[question.id]
                      const questionTypeIcon = question.question_type === 'short_text' ? '📝' 
                        : question.question_type === 'long_text' ? '📄' 
                        : '☑️'
                      
                      return (
                        <div key={question.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-sm">{questionTypeIcon}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-700">
                                {index + 1}. {question.question_text}
                                {question.is_required && <span className="text-red-500 ml-1">*</span>}
                              </p>
                              {question.question_type === 'long_text' && question.settings?.word_limit && (
                                <p className="text-xs text-gray-400 mt-0.5">Max {question.settings.word_limit} words</p>
                              )}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 ml-6">
                            {response !== undefined && response !== null && response !== '' ? (
                              question.question_type === 'multiple_choice' ? (
                                <div className="flex flex-wrap gap-2">
                                  {(Array.isArray(response) ? response : [response]).map((opt, i) => (
                                    <span key={i} className="px-2 py-1 bg-tamu-maroon/10 text-tamu-maroon text-sm rounded-md">
                                      {opt}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                                  {typeof response === 'string' ? response : JSON.stringify(response)}
                                </p>
                              )
                            ) : (
                              <span className="text-gray-400 italic text-sm">No response provided</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // Fallback to legacy why_join if no custom questions
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Why they want to join (default question)</p>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {selectedApplication.why_join || <span className="text-gray-400 italic">No response</span>}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Internal Notes */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500 font-medium">Internal Notes</p>
                  <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">Private</span>
                </div>
                {editingNotes ? (
                  <div className="space-y-3">
                    <textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      rows={5}
                      className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-tamu-maroon resize-none"
                      placeholder="Add private notes about this candidate..."
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditingNotes(false)
                          setNotesValue(selectedApplication.internal_notes || '')
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveInternalNotes}
                        disabled={savingNotes}
                        className="px-4 py-2 text-sm font-medium text-white bg-tamu-maroon rounded-lg hover:bg-tamu-maroon-light disabled:opacity-50"
                      >
                        {savingNotes ? 'Saving...' : 'Save Notes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setEditingNotes(true)
                      setNotesValue(selectedApplication.internal_notes || '')
                    }}
                    className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 cursor-pointer hover:border-yellow-200 transition-colors min-h-[100px]"
                  >
                    {selectedApplication.internal_notes ? (
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedApplication.internal_notes}</p>
                    ) : (
                      <p className="text-gray-400 italic">Click to add notes...</p>
                    )}
                  </div>
                )}
              </div>

              {/* Meta */}
              {selectedApplication.status_updated_at && selectedApplication.status_updated_at !== selectedApplication.created_at && (
                <p className="text-xs text-gray-400 mt-4 text-center">
                  Status last updated {new Date(selectedApplication.status_updated_at).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500">Select an application to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Support Contact */}
      <div className="bg-white border-t border-gray-200 py-2 text-center flex-shrink-0">
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
    </div>
  )
}
