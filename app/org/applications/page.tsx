'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import Image from 'next/image'
import Link from 'next/link'
import FormBuilder from '@/components/FormBuilder'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  reviewed: boolean
  interview_message: string | null
}

interface ApplicantDemographics {
  gender: string
  race: string
  classification: string
  sexuality: string
  careerFields: string[]
  engineeringTypes: string[]
  religion: string
}

interface FormQuestion {
  id: string
  question_text: string
  question_type: 'short_text' | 'long_text' | 'multiple_choice' | 'file_upload'
  is_required: boolean
  order_index: number
  settings: {
    word_limit?: number
    options?: string[]
    allow_multiple?: boolean
    accepted_types?: string[]
    max_size_mb?: number
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
  const [applicantDemographics, setApplicantDemographics] = useState<ApplicantDemographics | null>(null)
  const [demographicsLoading, setDemographicsLoading] = useState(false)
  
  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Interview message modal state
  const [showInterviewModal, setShowInterviewModal] = useState(false)
  const [interviewMessage, setInterviewMessage] = useState('')
  const [pendingStatusChange, setPendingStatusChange] = useState<{ appId: string, status: Application['status'] } | null>(null)
  const [sendingNotification, setSendingNotification] = useState(false)
  
  // Application settings state
  const [acceptingApplications, setAcceptingApplications] = useState(true)
  const [applicationDeadline, setApplicationDeadline] = useState<string>('')
  const [applicationsReopenDate, setApplicationsReopenDate] = useState<string>('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  
  const router = useRouter()
  const supabase = createClientComponentClient()
  
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  // Get ranked and unranked applications
  const rankedApps = applications
    .filter(a => a.rank !== null)
    .sort((a, b) => (a.rank || 0) - (b.rank || 0))
  
  const unrankedApps = applications
    .filter(a => a.rank === null)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Verify user is an org account or admin member and get organization info
  const verifyAndFetchOrg = useCallback(async () => {
    console.log('🔍 [verifyAndFetchOrg] Starting verification...')
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      console.log('🔍 [verifyAndFetchOrg] User:', user?.id, user?.email)
      console.log('🔍 [verifyAndFetchOrg] User metadata:', user?.user_metadata)
      
      if (userError || !user) {
        console.log('❌ [verifyAndFetchOrg] No user, redirecting to login')
        router.push('/login')
        return
      }

      let orgId: string | null = null
      let orgAccountData: any = null

      if (user.user_metadata?.is_org_account) {
        console.log('🔍 [verifyAndFetchOrg] User is org account owner')
        // User is the org account owner
        const { data: orgAccount, error: orgAccountError } = await supabase
          .from('org_accounts')
          .select('organization_id, accepting_applications, application_deadline, applications_reopen_date')
          .eq('user_id', user.id)
          .single()

        if (orgAccountError || !orgAccount) {
          console.log('❌ [verifyAndFetchOrg] Org account not found:', orgAccountError)
          setError('Organization account not found')
          setLoading(false)
          return
        }
        
        orgId = orgAccount.organization_id
        orgAccountData = orgAccount
        console.log('✅ [verifyAndFetchOrg] Org account found, orgId:', orgId)
      } else {
        console.log('🔍 [verifyAndFetchOrg] User is NOT org account, checking dashboard access...')
        // Check if user has dashboard access as admin member
        const { data: dashboardAccess, error: dashboardError } = await supabase
          .from('org_dashboard_access')
          .select('organization_id')
          .eq('user_id', user.id)
          .single()

        console.log('🔍 [verifyAndFetchOrg] Dashboard access query result:', dashboardAccess, 'error:', dashboardError)

        if (!dashboardAccess) {
          console.log('❌ [verifyAndFetchOrg] No dashboard access, redirecting to /dashboard')
          router.push('/dashboard')
          return
        }

        orgId = dashboardAccess.organization_id
        console.log('✅ [verifyAndFetchOrg] Dashboard access found, orgId:', orgId)
        
        // Get org account data for this organization
        const { data: orgAccount } = await supabase
          .from('org_accounts')
          .select('accepting_applications, application_deadline, applications_reopen_date')
          .eq('organization_id', orgId)
          .single()
        
        orgAccountData = orgAccount
      }

      if (!orgId) {
        console.log('❌ [verifyAndFetchOrg] No orgId found, redirecting')
        router.push('/dashboard')
        return
      }
      
      console.log('✅ [verifyAndFetchOrg] Final orgId:', orgId)

      // Get org name
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single()

      setOrganizationId(orgId)
      setOrganizationName(orgData?.name || 'Organization')
      
      // Set application settings
      setAcceptingApplications(orgAccountData?.accepting_applications ?? true)
      setApplicationDeadline(orgAccountData?.application_deadline ? new Date(orgAccountData.application_deadline).toISOString().slice(0, 16) : '')
      setApplicationsReopenDate(orgAccountData?.applications_reopen_date ? new Date(orgAccountData.applications_reopen_date).toISOString().slice(0, 16) : '')
      
      // Fetch form questions for this org
      const { data: formData } = await supabase
        .from('org_forms')
        .select('id')
        .eq('organization_id', orgId)
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
      console.log('🔍 [fetchApplications] Starting fetch for orgId:', organizationId)
      setApplicationsLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      console.log('🔍 [fetchApplications] Current user:', user?.id, user?.email)
      console.log('🔍 [fetchApplications] Is org account:', user?.user_metadata?.is_org_account)
      
      const { data, error } = await supabase
        .from('applications')
        .select('id, user_id, applicant_name, applicant_email, why_join, status, created_at, status_updated_at, internal_notes, rank, responses, reviewed, interview_message')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      console.log('🔍 [fetchApplications] Query result - data:', data?.length, 'error:', error)
      
      if (error) {
        console.error('❌ [fetchApplications] Error fetching applications:', error)
      } else {
        console.log('✅ [fetchApplications] Got applications:', data?.length || 0)
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
  const updateApplicationStatus = async (applicationId: string, newStatus: Application['status'], interviewMsg?: string) => {
    if (!organizationId) return
    
    try {
      const updateData: Record<string, any> = { 
        status: newStatus,
        status_updated_at: new Date().toISOString()
      }
      
      // Add interview message if provided
      if (newStatus === 'interview' && interviewMsg) {
        updateData.interview_message = interviewMsg
      }
      
      const { error } = await supabase
        .from('applications')
        .update(updateData)
        .eq('id', applicationId)
      
      if (error) {
        console.error('Error updating application status:', error)
        setError('Failed to update application status')
        return
      }
      
      // Send email notification for accepted, rejected, or interview
      if (['accepted', 'rejected', 'interview'].includes(newStatus)) {
        try {
          const response = await fetch('/api/applications/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              applicationId,
              newStatus,
              organizationName,
              interviewMessage: interviewMsg || null
            })
          })
          
          if (response.ok) {
            console.log(`✅ Email notification sent for ${newStatus}`)
          } else {
            console.error('Failed to send email notification')
          }
        } catch (emailError) {
          console.error('Error sending email notification:', emailError)
          // Don't fail the status update if email fails
        }
      }
      
      if (newStatus === 'accepted') {
        setSaveSuccess('Application accepted! Email sent.')
      } else if (newStatus === 'rejected') {
        setSaveSuccess('Application rejected. Email sent.')
      } else if (newStatus === 'interview') {
        setSaveSuccess('Moved to interview! Email sent.')
      } else {
        setSaveSuccess(`Status updated to ${newStatus}`)
      }
      
      setTimeout(() => setSaveSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update status')
    }
  }
  
  // Handle status change - show modal for interview, otherwise update directly
  const handleStatusChange = (applicationId: string, newStatus: Application['status']) => {
    if (newStatus === 'interview') {
      // Show modal to enter interview message
      setPendingStatusChange({ appId: applicationId, status: newStatus })
      setInterviewMessage('')
      setShowInterviewModal(true)
    } else {
      // Update status directly
      updateApplicationStatus(applicationId, newStatus)
    }
  }
  
  // Confirm interview status with message
  const confirmInterviewStatus = async () => {
    if (!pendingStatusChange) return
    
    setSendingNotification(true)
    await updateApplicationStatus(pendingStatusChange.appId, pendingStatusChange.status, interviewMessage)
    setSendingNotification(false)
    setShowInterviewModal(false)
    setPendingStatusChange(null)
    setInterviewMessage('')
  }

  // Toggle reviewed status
  const toggleReviewed = async (applicationId: string, currentReviewed: boolean) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ reviewed: !currentReviewed })
        .eq('id', applicationId)
      
      if (error) {
        console.error('Error toggling reviewed:', error)
        setError('Failed to update reviewed status')
      }
      // Realtime will handle the state update
    } catch (err: any) {
      setError(err.message || 'Failed to update reviewed status')
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

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    
    if (!over) return
    
    const activeApp = applications.find(a => a.id === active.id)
    if (!activeApp) return
    
    const overId = over.id as string
    
    // Dropping on "unranked" droppable zone
    if (overId === 'unranked-drop-zone') {
      if (activeApp.rank !== null) {
        // Moving from ranked to unranked
        await updateApplicationRank(activeApp.id, null)
        // Reorder remaining ranked apps
        const remainingRanked = rankedApps
          .filter(a => a.id !== activeApp.id)
          .map((a, idx) => ({ id: a.id, rank: idx + 1 }))
        for (const item of remainingRanked) {
          await supabase
            .from('applications')
            .update({ rank: item.rank })
            .eq('id', item.id)
        }
      }
      return
    }
    
    // Dropping on "ranked" droppable zone (not on a specific app)
    if (overId === 'ranked-drop-zone') {
      if (activeApp.rank === null) {
        // Moving from unranked to ranked - add at the end
        const newRank = rankedApps.length + 1
        await updateApplicationRank(activeApp.id, newRank)
      }
      return
    }
    
    // Dropping on another application
    const overApp = applications.find(a => a.id === overId)
    if (!overApp) return
    
    // If active app is unranked and dropping on ranked app
    if (activeApp.rank === null && overApp.rank !== null) {
      // Insert at the position of the over app
      const insertAtRank = overApp.rank
      // Shift all apps at and after this position down
      const appsToShift = rankedApps.filter(a => a.rank !== null && a.rank >= insertAtRank)
      for (const app of appsToShift) {
        await supabase
          .from('applications')
          .update({ rank: (app.rank || 0) + 1 })
          .eq('id', app.id)
      }
      await updateApplicationRank(activeApp.id, insertAtRank)
      return
    }
    
    // Reordering within ranked section
    if (activeApp.rank !== null && overApp.rank !== null && active.id !== over.id) {
      const oldIndex = rankedApps.findIndex(a => a.id === active.id)
      const newIndex = rankedApps.findIndex(a => a.id === over.id)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(rankedApps, oldIndex, newIndex)
        
        // Update ranks in database
        const updates = newOrder.map((app, idx) => ({
          id: app.id,
          rank: idx + 1
        }))
        
        // Optimistically update local state
        setApplications(prev => prev.map(app => {
          const update = updates.find(u => u.id === app.id)
          return update ? { ...app, rank: update.rank } : app
        }))
        
        // Persist to database
        for (const update of updates) {
          await supabase
            .from('applications')
            .update({ rank: update.rank })
            .eq('id', update.id)
        }
      }
    }
  }

  // Helper to update a single application's rank
  const updateApplicationRank = async (applicationId: string, newRank: number | null) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ rank: newRank })
        .eq('id', applicationId)
      
      if (error) {
        console.error('Error updating rank:', error)
        setError('Failed to update rank')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update rank')
    }
  }

  // Update application settings
  const updateApplicationSettings = async (settings: {
    accepting_applications?: boolean
    application_deadline?: string | null
    applications_reopen_date?: string | null
  }) => {
    if (!organizationId) return
    
    setSettingsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const updateData: Record<string, any> = {}
      
      if (settings.accepting_applications !== undefined) {
        updateData.accepting_applications = settings.accepting_applications
      }
      if (settings.application_deadline !== undefined) {
        updateData.application_deadline = settings.application_deadline || null
      }
      if (settings.applications_reopen_date !== undefined) {
        updateData.applications_reopen_date = settings.applications_reopen_date || null
      }
      
      const { error } = await supabase
        .from('org_accounts')
        .update(updateData)
        .eq('user_id', user.id)
      
      if (error) {
        console.error('Error updating settings:', error)
        setError('Failed to update settings')
      } else {
        setSaveSuccess('Settings updated')
        setTimeout(() => setSaveSuccess(''), 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update settings')
    }
    setSettingsLoading(false)
  }

  // Toggle accepting applications
  const toggleAcceptingApplications = async () => {
    const newValue = !acceptingApplications
    setAcceptingApplications(newValue)
    
    // If closing applications, clear deadline. If opening, clear reopen date.
    if (newValue) {
      setApplicationsReopenDate('')
      await updateApplicationSettings({
        accepting_applications: newValue,
        applications_reopen_date: null
      })
    } else {
      setApplicationDeadline('')
      await updateApplicationSettings({
        accepting_applications: newValue,
        application_deadline: null
      })
    }
  }

  // Realtime subscription for applicant demographics
  useEffect(() => {
    if (!selectedApplication) {
      setApplicantDemographics(null)
      return
    }

    const userId = selectedApplication.user_id
    let demographicsChannel: RealtimeChannel | null = null

    const fetchDemographics = async () => {
      setDemographicsLoading(true)
      try {
        const { data, error } = await supabase
          .from('user_queries')
          .select('user_demographics')
          .eq('user_id', userId)
          .single()
        
        if (error) {
          console.log('No demographics found for user:', userId)
          setApplicantDemographics(null)
        } else if (data?.user_demographics) {
          setApplicantDemographics(data.user_demographics as ApplicantDemographics)
        }
      } catch (err) {
        console.error('Error fetching demographics:', err)
      }
      setDemographicsLoading(false)
    }

    fetchDemographics()

    // Subscribe to realtime changes for this user's demographics
    demographicsChannel = supabase
      .channel(`demographics-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_queries',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('👤 Demographics realtime update:', payload)
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newData = payload.new as { user_demographics?: ApplicantDemographics }
            if (newData.user_demographics) {
              setApplicantDemographics(newData.user_demographics)
            }
          } else if (payload.eventType === 'DELETE') {
            setApplicantDemographics(null)
          }
        }
      )
      .subscribe()

    return () => {
      if (demographicsChannel) {
        supabase.removeChannel(demographicsChannel)
      }
    }
  }, [selectedApplication, supabase])

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
              {/* Application Status Toggle */}
              <button
                onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                  showSettingsPanel 
                    ? 'bg-blue-100 text-blue-700' 
                    : acceptingApplications 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${acceptingApplications ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="hidden sm:inline">{acceptingApplications ? 'Open' : 'Closed'}</span>
                <svg className={`w-3 h-3 transition-transform ${showSettingsPanel ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
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

      {/* Application Settings Panel */}
      <AnimatePresence>
        {showSettingsPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-b border-gray-200 flex-shrink-0"
          >
            <div className="max-w-4xl mx-auto p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Toggle Switch */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${!acceptingApplications ? 'text-red-600' : 'text-gray-400'}`}>
                      Closed
                    </span>
                    <button
                      onClick={toggleAcceptingApplications}
                      disabled={settingsLoading}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-tamu-maroon focus:ring-offset-2 ${
                        acceptingApplications ? 'bg-green-500' : 'bg-red-500'
                      } ${settingsLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                          acceptingApplications ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-sm font-medium ${acceptingApplications ? 'text-green-600' : 'text-gray-400'}`}>
                      Open
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {acceptingApplications 
                      ? 'Applications are currently open' 
                      : 'Applications are currently closed'}
                  </p>
                </div>

                {/* Date Inputs */}
                <div className="flex flex-col sm:flex-row gap-4">
                  {acceptingApplications ? (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 whitespace-nowrap">Deadline:</label>
                      <input
                        type="datetime-local"
                        value={applicationDeadline}
                        onChange={(e) => {
                          setApplicationDeadline(e.target.value)
                          updateApplicationSettings({ application_deadline: e.target.value || null })
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      />
                      {applicationDeadline && (
                        <button
                          onClick={() => {
                            setApplicationDeadline('')
                            updateApplicationSettings({ application_deadline: null })
                          }}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="Clear deadline"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 whitespace-nowrap">Reopens:</label>
                      <input
                        type="datetime-local"
                        value={applicationsReopenDate}
                        onChange={(e) => {
                          setApplicationsReopenDate(e.target.value)
                          updateApplicationSettings({ applications_reopen_date: e.target.value || null })
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                      />
                      {applicationsReopenDate && (
                        <button
                          onClick={() => {
                            setApplicationsReopenDate('')
                            updateApplicationSettings({ applications_reopen_date: null })
                          }}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="Clear reopen date"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Status Info */}
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">
                  {acceptingApplications ? (
                    applicationDeadline ? (
                      <>📅 Applications due by <strong>{new Date(applicationDeadline).toLocaleString()}</strong></>
                    ) : (
                      <>✅ Applications are open with no deadline set</>
                    )
                  ) : (
                    applicationsReopenDate ? (
                      <>🔒 Applications closed. Reopening <strong>{new Date(applicationsReopenDate).toLocaleString()}</strong></>
                    ) : (
                      <>🔒 Applications are closed. No reopen date set.</>
                    )
                  )}
                </p>
              </div>
            </div>
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
            className="bg-white border-b border-gray-200 flex-shrink-0 max-h-[60vh] overflow-y-auto"
          >
            <div className="max-w-4xl mx-auto p-6">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 -mt-2 pt-2 z-10">
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
        {/* Left Sidebar - Drag & Drop Applications List */}
        <div className="w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          {/* Sidebar Header */}
          <div className="p-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs text-gray-500 text-center">
              Drag applications to rank them
            </p>
          </div>

          {applicationsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tamu-maroon"></div>
            </div>
          ) : applications.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No applications yet</p>
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Ranked Section (Top Half) */}
                <div className="flex-1 min-h-0 flex flex-col border-b-2 border-tamu-maroon/20">
                  <div className="px-3 py-2 bg-tamu-maroon/5 border-b border-tamu-maroon/10 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-tamu-maroon uppercase tracking-wide">
                        ⭐ Ranked ({rankedApps.length})
                      </span>
                    </div>
                  </div>
                  <DroppableArea id="ranked-drop-zone" className="flex-1 overflow-y-auto">
                    {rankedApps.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-4">
                        <p className="text-xs text-gray-400 text-center">
                          Drag applications here to rank them
                        </p>
                      </div>
                    ) : (
                      <SortableContext
                        items={rankedApps.map(a => a.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="divide-y divide-gray-100">
                          {rankedApps.map((app) => (
                            <SortableApplicationCard
                              key={app.id}
                              app={app}
                              isSelected={selectedApplication?.id === app.id}
                              onSelect={() => handleSelectApplication(app)}
                              onToggleReviewed={() => toggleReviewed(app.id, app.reviewed || false)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    )}
                  </DroppableArea>
                </div>

                {/* Unranked Section (Bottom Half) */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Unranked ({unrankedApps.length})
                    </span>
                  </div>
                  <DroppableArea id="unranked-drop-zone" className="flex-1 overflow-y-auto">
                    {unrankedApps.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-4">
                        <p className="text-xs text-gray-400 text-center">
                          No unranked applications
                        </p>
                      </div>
                    ) : (
                      <SortableContext
                        items={unrankedApps.map(a => a.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="divide-y divide-gray-100">
                          {unrankedApps.map((app) => (
                            <SortableApplicationCard
                              key={app.id}
                              app={app}
                              isSelected={selectedApplication?.id === app.id}
                              onSelect={() => handleSelectApplication(app)}
                              onToggleReviewed={() => toggleReviewed(app.id, app.reviewed || false)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    )}
                  </DroppableArea>
                </div>
              </div>

              {/* Drag Overlay */}
              <DragOverlay>
                {activeId ? (
                  <DragOverlayCard app={applications.find(a => a.id === activeId)!} />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
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
                      {/* Reviewed Checkbox */}
                      <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={selectedApplication.reviewed || false}
                          onChange={() => toggleReviewed(selectedApplication.id, selectedApplication.reviewed || false)}
                          className="w-4 h-4 rounded border-gray-300 text-tamu-maroon focus:ring-tamu-maroon cursor-pointer"
                        />
                        <span className={`text-sm ${selectedApplication.reviewed ? 'text-green-600 font-medium' : 'text-gray-500 group-hover:text-gray-700'}`}>
                          {selectedApplication.reviewed ? '✓ Reviewed' : 'Mark as reviewed'}
                        </span>
                      </label>
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

              {/* Applicant Demographics */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <p className="text-sm text-gray-500 font-medium mb-4">Applicant Profile</p>
                {demographicsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-tamu-maroon"></div>
                  </div>
                ) : applicantDemographics ? (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Classification */}
                    {applicantDemographics.classification && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Classification</p>
                        <p className="text-sm font-medium text-gray-700">{applicantDemographics.classification}</p>
                      </div>
                    )}
                    
                    {/* Gender */}
                    {applicantDemographics.gender && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gender</p>
                        <p className="text-sm font-medium text-gray-700">{applicantDemographics.gender}</p>
                      </div>
                    )}
                    
                    {/* Race/Ethnicity */}
                    {applicantDemographics.race && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Race/Ethnicity</p>
                        <p className="text-sm font-medium text-gray-700">{applicantDemographics.race}</p>
                      </div>
                    )}
                    
                    {/* Religion */}
                    {applicantDemographics.religion && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Religion</p>
                        <p className="text-sm font-medium text-gray-700">{applicantDemographics.religion}</p>
                      </div>
                    )}
                    
                    {/* Sexuality */}
                    {applicantDemographics.sexuality && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sexuality</p>
                        <p className="text-sm font-medium text-gray-700">{applicantDemographics.sexuality}</p>
                      </div>
                    )}
                    
                    {/* Career Fields */}
                    {applicantDemographics.careerFields && applicantDemographics.careerFields.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Career Fields of Interest</p>
                        <div className="flex flex-wrap gap-2">
                          {applicantDemographics.careerFields.map((field, idx) => (
                            <span 
                              key={idx} 
                              className="px-2 py-1 bg-tamu-maroon/10 text-tamu-maroon text-xs font-medium rounded-md"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Engineering Types (if applicable) */}
                    {applicantDemographics.engineeringTypes && applicantDemographics.engineeringTypes.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Engineering Focus</p>
                        <div className="flex flex-wrap gap-2">
                          {applicantDemographics.engineeringTypes.map((type, idx) => (
                            <span 
                              key={idx} 
                              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md"
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-400">No profile data available</p>
                  </div>
                )}
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
                        onClick={() => handleStatusChange(selectedApplication.id, status.value)}
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
                
                {/* Show interview message if exists */}
                {selectedApplication.interview_message && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      <span className="text-sm font-medium text-blue-700">Interview Message Sent</span>
                    </div>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">{selectedApplication.interview_message}</p>
                  </div>
                )}
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
                              ) : question.question_type === 'file_upload' && typeof response === 'string' ? (
                                <FilePreview filePath={response} supabase={supabase} />
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

      {/* Interview Message Modal */}
      <AnimatePresence>
        {showInterviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowInterviewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xl">📅</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Send Interview Invitation</h3>
                    <p className="text-sm text-gray-500">This message will be sent to the applicant via email</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message for the applicant
                </label>
                <textarea
                  value={interviewMessage}
                  onChange={(e) => setInterviewMessage(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Hi! We were impressed with your application and would love to schedule an interview. Please let us know your availability..."
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-2">
                  This message will appear in their email and on their applications dashboard.
                </p>
              </div>
              
              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowInterviewModal(false)
                    setPendingStatusChange(null)
                    setInterviewMessage('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmInterviewStatus}
                  disabled={sendingNotification}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {sendingNotification ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send & Move to Interview
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// File Preview Component for viewing uploaded files
function FilePreview({ 
  filePath, 
  supabase 
}: { 
  filePath: string
  supabase: ReturnType<typeof createClientComponentClient>
}) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const getSignedUrl = async () => {
      try {
        // Create a signed URL for secure access
        const { data, error: urlError } = await supabase.storage
          .from('application-files')
          .createSignedUrl(filePath, 3600) // 1 hour expiry
        
        if (urlError || !data) {
          console.error('Error getting signed URL:', urlError)
          setError(true)
        } else {
          setFileUrl(data.signedUrl)
        }
      } catch (err) {
        console.error('Error:', err)
        setError(true)
      }
      setLoading(false)
    }
    
    getSignedUrl()
  }, [filePath, supabase])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm">Loading file...</span>
      </div>
    )
  }

  if (error || !fileUrl) {
    return (
      <div className="flex items-center gap-2 text-red-500">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span className="text-sm">Unable to load file</span>
      </div>
    )
  }

  const fileName = filePath.split('/').pop() || 'document.pdf'

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
        <div>
          <p className="text-sm font-medium text-gray-700">PDF Document</p>
          <p className="text-xs text-gray-500">{fileName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-sm font-medium text-tamu-maroon border border-tamu-maroon rounded-lg hover:bg-tamu-maroon hover:text-white transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View
        </a>
        <a
          href={fileUrl}
          download={fileName}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>
      </div>
    </div>
  )
}

// Droppable Area Component
function DroppableArea({ 
  id, 
  children, 
  className 
}: { 
  id: string
  children: React.ReactNode
  className?: string 
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  
  return (
    <div 
      ref={setNodeRef} 
      className={`${className} ${isOver ? 'bg-tamu-maroon/5' : ''} transition-colors`}
    >
      {children}
    </div>
  )
}

// Sortable Application Card Component
function SortableApplicationCard({
  app,
  isSelected,
  onSelect,
  onToggleReviewed,
}: {
  app: Application
  isSelected: boolean
  onSelect: () => void
  onToggleReviewed: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const statusInfo = APPLICATION_STATUSES.find(s => s.value === app.status) || APPLICATION_STATUSES[0]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 cursor-pointer transition-all ${
        isDragging ? 'opacity-50 bg-gray-100' : ''
      } ${
        isSelected 
          ? 'bg-tamu-maroon/5 border-l-4 border-tamu-maroon' 
          : 'hover:bg-gray-50 border-l-4 border-transparent'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </div>

        {/* Rank Badge */}
        <div 
          onClick={onSelect}
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            app.rank !== null ? 'bg-tamu-maroon text-white' : 'bg-gray-100'
          }`}
        >
          {app.rank !== null ? (
            <span className="text-xs font-bold">{app.rank}</span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0" onClick={onSelect}>
          <div className="flex items-center gap-1.5">
            <h4 className={`text-sm font-medium truncate ${isSelected ? 'text-tamu-maroon' : 'text-gray-800'}`}>
              {app.applicant_name}
            </h4>
            {app.internal_notes && (
              <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2z" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`}></span>
            <span className="text-xs text-gray-500">{statusInfo.label}</span>
          </div>
        </div>
        
        {/* Reviewed Checkbox */}
        <div 
          className="flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onToggleReviewed()
          }}
        >
          <input
            type="checkbox"
            checked={app.reviewed || false}
            onChange={() => {}}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
            title={app.reviewed ? 'Reviewed' : 'Mark as reviewed'}
          />
        </div>
      </div>
    </div>
  )
}

// Drag Overlay Card (shown while dragging)
function DragOverlayCard({ app }: { app: Application }) {
  const statusInfo = APPLICATION_STATUSES.find(s => s.value === app.status) || APPLICATION_STATUSES[0]
  
  return (
    <div className="p-3 bg-white border-2 border-tamu-maroon rounded-lg shadow-xl">
      <div className="flex items-center gap-2">
        <div className="p-1 text-gray-400">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          app.rank !== null ? 'bg-tamu-maroon text-white' : 'bg-gray-100'
        }`}>
          {app.rank !== null ? (
            <span className="text-xs font-bold">{app.rank}</span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-800 truncate">{app.applicant_name}</h4>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`}></span>
            <span className="text-xs text-gray-500">{statusInfo.label}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
