'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'
import Link from 'next/link'
import DynamicApplicationForm from '@/components/DynamicApplicationForm'

interface Organization {
  id: string
  name: string
  bio: string | null
  website: string | null
  administrative_contact_info: string | null
  typical_majors: string | null
  typical_activities: string | null
  club_culture_style: string | null
  meeting_frequency: string | null
  meeting_times: string | null
  meeting_locations: string | null
  dues_required: string | null
  dues_cost: string | null
  application_required: string | null
  time_commitment: string | null
  member_count: string | null
  club_type: string | null
  is_application_based: boolean | null
}

export default function PublicOrgPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string
  const supabase = createClientComponentClient()
  
  const { user, session, joinedOrgIds, appliedOrgIds, joinOrg, loading: userAuthLoading } = useAuth()
  
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOnPlatform, setIsOnPlatform] = useState(false)
  
  // Auth/Apply flow states
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [verificationSent, setVerificationSent] = useState(false)
  
  // Application form states
  const [showApplicationForm, setShowApplicationForm] = useState(false)
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applySuccess, setApplySuccess] = useState(false)
  
  // Application settings
  const [acceptingApplications, setAcceptingApplications] = useState(true)
  const [applicationDeadline, setApplicationDeadline] = useState<string | null>(null)
  const [applicationsReopenDate, setApplicationsReopenDate] = useState<string | null>(null)
  const [hasCustomForm, setHasCustomForm] = useState(false)
  
  // User membership info
  const [userRole, setUserRole] = useState<'member' | 'officer' | 'admin' | null>(null)
  const [userTitle, setUserTitle] = useState<string | null>(null)
  
  // Member management states (for officers/admins)
  const [members, setMembers] = useState<any[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'applications'>('info')
  
  // Edit mode for admins
  const [isEditing, setIsEditing] = useState(false)
  const [editedOrg, setEditedOrg] = useState<Partial<Organization>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Fetch organization data
  useEffect(() => {
    const fetchOrg = async () => {
      if (!orgId) return
      
      setLoading(true)
      setError(null)
      
      try {
        // Fetch organization
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single()
        
        if (orgError) {
          setError('Organization not found')
          setLoading(false)
          return
        }
        
        setOrg(orgData)
        
        // Check if on platform and get application settings
        const { data: orgAccount } = await supabase
          .from('org_accounts')
          .select('id, email_verified, is_active, accepting_applications, application_deadline, applications_reopen_date')
          .eq('organization_id', orgId)
          .single()
        
        setIsOnPlatform(orgAccount?.email_verified && orgAccount?.is_active)
        setAcceptingApplications(orgAccount?.accepting_applications ?? true)
        setApplicationDeadline(orgAccount?.application_deadline || null)
        setApplicationsReopenDate(orgAccount?.applications_reopen_date || null)
        
        // Check if org has custom form
        if (orgData.is_application_based && orgAccount?.email_verified && orgAccount?.is_active) {
          const { data: formData } = await supabase
            .from('org_forms')
            .select('id')
            .eq('organization_id', orgId)
            .single()
          
          if (formData) {
            const { count } = await supabase
              .from('form_questions')
              .select('id', { count: 'exact', head: true })
              .eq('form_id', formData.id)
            
            setHasCustomForm((count || 0) > 0)
          }
        }
      } catch (err) {
        setError('Failed to load organization')
      } finally {
        setLoading(false)
      }
    }
    
    fetchOrg()
  }, [orgId, supabase])

  const isJoined = org ? joinedOrgIds.has(org.id) : false
  const isApplied = org ? appliedOrgIds.has(org.id) : false
  const isApplicationBased = org?.is_application_based === true
  const isOfficerOrAdmin = userRole === 'officer' || userRole === 'admin'
  const isAdmin = userRole === 'admin'
  
  // Fetch user's membership role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user || !orgId) return
      
      try {
        const { data: membership } = await supabase
          .from('user_joined_organizations')
          .select('role, title')
          .eq('user_id', user.id)
          .eq('organization_id', orgId)
          .single()
        
        if (membership) {
          setUserRole(membership.role || 'member')
          setUserTitle(membership.title)
        }
      } catch (err) {
        // Not a member or error
      }
    }
    
    fetchUserRole()
  }, [user, orgId, supabase])
  
  // Initialize editedOrg when org loads
  useEffect(() => {
    if (org) {
      setEditedOrg(org)
    }
  }, [org])

  // Save org edits
  const handleSaveOrg = async () => {
    if (!org || !editedOrg) return
    
    setSaving(true)
    setSaveError(null)
    
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          bio: editedOrg.bio,
          website: editedOrg.website,
          administrative_contact_info: editedOrg.administrative_contact_info,
          typical_majors: editedOrg.typical_majors,
          typical_activities: editedOrg.typical_activities,
          club_culture_style: editedOrg.club_culture_style,
          meeting_frequency: editedOrg.meeting_frequency,
          meeting_times: editedOrg.meeting_times,
          meeting_locations: editedOrg.meeting_locations,
          dues_required: editedOrg.dues_required,
          dues_cost: editedOrg.dues_cost,
          time_commitment: editedOrg.time_commitment,
          member_count: editedOrg.member_count,
        })
        .eq('id', org.id)
      
      if (error) throw error
      
      // Update local state
      setOrg({ ...org, ...editedOrg } as Organization)
      setIsEditing(false)
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Fetch members for officers/admins
  useEffect(() => {
    const fetchMembers = async () => {
      if (!isOfficerOrAdmin || !orgId) return
      
      setMembersLoading(true)
      try {
        const response = await fetch(`/api/org/members?organizationId=${orgId}`)
        const data = await response.json()
        
        if (response.ok) {
          setMembers(data.members || [])
        }
      } catch (err) {
        console.error('Error fetching members:', err)
      } finally {
        setMembersLoading(false)
      }
    }
    
    fetchMembers()
  }, [isOfficerOrAdmin, orgId])

  const handleJoinClick = () => {
    if (!user) {
      // Not logged in - show auth modal
      setShowAuthModal(true)
      return
    }
    
    if (isApplicationBased) {
      // Show application form
      setShowApplicationForm(true)
    } else {
      // Direct join
      handleDirectJoin()
    }
  }

  const handleDirectJoin = async () => {
    if (!org) return
    
    setApplyLoading(true)
    setApplyError(null)
    
    const result = await joinOrg(org.id)
    
    if (result.success) {
      setApplySuccess(true)
    } else {
      setApplyError(result.error || 'Failed to join')
    }
    
    setApplyLoading(false)
  }

  const handleSubmitApplication = async (data: { name: string; email: string; whyJoin: string; customResponses: Record<string, string | string[]> }) => {
    if (!org) return
    
    setApplyLoading(true)
    setApplyError(null)
    
    const result = await joinOrg(org.id, {
      name: data.name,
      email: data.email,
      whyJoin: data.whyJoin,
      customResponses: data.customResponses
    })
    
    if (result.success) {
      setApplySuccess(true)
      setShowApplicationForm(false)
    } else {
      setApplyError(result.error || 'Failed to submit application')
    }
    
    setApplyLoading(false)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please fill in all fields')
      return
    }
    
    if (authPassword.length < 8) {
      setAuthError('Password must be at least 8 characters')
      return
    }
    
    setAuthLoading(true)
    setAuthError(null)
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
        options: {
          data: {
            name: authName.trim() || undefined
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/org/${orgId}`
        }
      })
      
      if (error) {
        setAuthError(error.message)
      } else if (data.user) {
        // Check if email confirmation is required
        if (data.user.identities?.length === 0) {
          setAuthError('This email is already registered. Please log in instead.')
        } else {
          setVerificationSent(true)
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to create account')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please fill in all fields')
      return
    }
    
    setAuthLoading(true)
    setAuthError(null)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword
      })
      
      if (error) {
        setAuthError(error.message)
      } else {
        setShowAuthModal(false)
        // The auth state change will update the UI
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to log in')
    } finally {
      setAuthLoading(false)
    }
  }

  if (loading || userAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Organization Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'This organization does not exist.'}</p>
          <Link href="/" className="text-tamu-maroon hover:underline">
            Go to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="ORGanize TAMU" 
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="text-lg font-bold text-tamu-maroon">ORGanize TAMU</span>
          </Link>
          {user ? (
            <Link href="/dashboard">
              <button className="px-4 py-2 text-sm font-medium text-tamu-maroon border border-tamu-maroon rounded-lg hover:bg-tamu-maroon hover:text-white transition-colors">
                My Dashboard
              </button>
            </Link>
          ) : (
            <Link href="/login">
              <button className="px-4 py-2 text-sm font-medium text-tamu-maroon border border-tamu-maroon rounded-lg hover:bg-tamu-maroon hover:text-white transition-colors">
                Sign In
              </button>
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Org Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light rounded-xl shadow-lg overflow-hidden mb-6"
        >
          <div className="p-6 sm:p-8 text-white">
            <div className="flex items-start justify-between">
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">{org.name}</h1>
              {isAdmin && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {org.club_type && (
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                  {org.club_type}
                </span>
              )}
              {!isOnPlatform && (
                <span className="px-3 py-1 bg-white/10 rounded-full text-sm font-medium">
                  Not yet on platform
                </span>
              )}
              {isApplicationBased && isOnPlatform && !acceptingApplications && (
                <span className="px-3 py-1 bg-red-400/30 rounded-full text-sm font-medium">
                  Applications Closed
                </span>
              )}
              {isApplicationBased && isOnPlatform && acceptingApplications && (
                <span className="px-3 py-1 bg-green-400/30 rounded-full text-sm font-medium">
                  Accepting Applications
                </span>
              )}
              {isApplicationBased && isOnPlatform && acceptingApplications && applicationDeadline && (
                <span className="px-3 py-1 bg-orange-400/30 rounded-full text-sm font-medium">
                  Due {new Date(applicationDeadline).toLocaleDateString()}
                </span>
              )}
            </div>
            {org.bio && org.bio !== 'nan' && (
              <p className="text-white/90 text-lg leading-relaxed">{org.bio}</p>
            )}
          </div>
        </motion.div>

        {/* Edit Mode Panel */}
        <AnimatePresence>
          {isEditing && isAdmin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">Edit Organization Info</h2>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditedOrg(org || {})
                      setSaveError(null)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {saveError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {saveError}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Bio */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio/Description</label>
                    <textarea
                      value={editedOrg.bio || ''}
                      onChange={(e) => setEditedOrg({ ...editedOrg, bio: e.target.value })}
                      rows={3}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                      placeholder="Organization description..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Website */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                      <input
                        type="text"
                        value={editedOrg.website || ''}
                        onChange={(e) => setEditedOrg({ ...editedOrg, website: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        placeholder="https://..."
                      />
                    </div>

                    {/* Contact */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Info</label>
                      <input
                        type="text"
                        value={editedOrg.administrative_contact_info || ''}
                        onChange={(e) => setEditedOrg({ ...editedOrg, administrative_contact_info: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        placeholder="Email or contact info..."
                      />
                    </div>

                    {/* Meeting Frequency */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Frequency</label>
                      <input
                        type="text"
                        value={editedOrg.meeting_frequency || ''}
                        onChange={(e) => setEditedOrg({ ...editedOrg, meeting_frequency: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        placeholder="Weekly, bi-weekly..."
                      />
                    </div>

                    {/* Meeting Times */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Times</label>
                      <input
                        type="text"
                        value={editedOrg.meeting_times || ''}
                        onChange={(e) => setEditedOrg({ ...editedOrg, meeting_times: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        placeholder="Tuesdays at 7pm..."
                      />
                    </div>

                    {/* Meeting Locations */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Location</label>
                      <input
                        type="text"
                        value={editedOrg.meeting_locations || ''}
                        onChange={(e) => setEditedOrg({ ...editedOrg, meeting_locations: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        placeholder="MSC, Zachry..."
                      />
                    </div>

                    {/* Dues Required */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dues Required</label>
                      <input
                        type="text"
                        value={editedOrg.dues_required || ''}
                        onChange={(e) => setEditedOrg({ ...editedOrg, dues_required: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        placeholder="Yes, No..."
                      />
                    </div>

                    {/* Dues Cost */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dues Cost</label>
                      <input
                        type="text"
                        value={editedOrg.dues_cost || ''}
                        onChange={(e) => setEditedOrg({ ...editedOrg, dues_cost: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        placeholder="$50/semester..."
                      />
                    </div>

                    {/* Time Commitment */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time Commitment</label>
                      <input
                        type="text"
                        value={editedOrg.time_commitment || ''}
                        onChange={(e) => setEditedOrg({ ...editedOrg, time_commitment: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        placeholder="2-3 hours/week..."
                      />
                    </div>

                    {/* Member Count */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Member Count</label>
                      <input
                        type="text"
                        value={editedOrg.member_count || ''}
                        onChange={(e) => setEditedOrg({ ...editedOrg, member_count: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        placeholder="50-100 members..."
                      />
                    </div>
                  </div>

                  {/* Activities */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Typical Activities</label>
                    <input
                      type="text"
                      value={editedOrg.typical_activities || ''}
                      onChange={(e) => setEditedOrg({ ...editedOrg, typical_activities: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                      placeholder="Networking, workshops, social events..."
                    />
                  </div>

                  {/* Majors */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Career Fields / Majors</label>
                    <input
                      type="text"
                      value={editedOrg.typical_majors || ''}
                      onChange={(e) => setEditedOrg({ ...editedOrg, typical_majors: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                      placeholder="Engineering, Business..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditedOrg(org || {})
                      setSaveError(null)
                    }}
                    className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveOrg}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6"
        >
          {applySuccess ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {isApplicationBased ? 'Application Submitted!' : 'Successfully Joined!'}
              </h3>
              <p className="text-gray-600">
                {isApplicationBased 
                  ? 'The organization will review your application and get back to you.'
                  : `You are now a member of ${org.name}.`}
              </p>
              {user && (
                <Link href="/dashboard">
                  <button className="mt-4 px-6 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors">
                    Go to Dashboard
                  </button>
                </Link>
              )}
            </div>
          ) : isJoined ? (
            <div className="text-center py-4">
              <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full font-medium">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                You&apos;re a member of this organization
              </span>
            </div>
          ) : isApplied ? (
            <div className="text-center py-4">
              <span className="inline-flex items-center px-4 py-2 bg-orange-100 text-orange-800 rounded-full font-medium">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Application Pending
              </span>
              <p className="text-gray-600 mt-2">You&apos;ve already applied. Waiting for review.</p>
            </div>
          ) : !isOnPlatform ? (
            <div className="text-center py-4">
              <p className="text-gray-600">This organization is not yet on the platform.</p>
              <p className="text-sm text-gray-500 mt-1">Check back later or contact them directly.</p>
            </div>
          ) : isApplicationBased && !acceptingApplications ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg mb-3">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-red-700 font-medium">Applications Currently Closed</span>
              </div>
              {applicationsReopenDate && (
                <p className="text-gray-600">
                  Applications will reopen on <strong>{new Date(applicationsReopenDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                </p>
              )}
              {!applicationsReopenDate && (
                <p className="text-sm text-gray-500">Check back later for updates.</p>
              )}
            </div>
          ) : isApplicationBased && !hasCustomForm ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-600 font-medium">Applications Coming Soon</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">This organization is setting up their application form.</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {isApplicationBased ? 'Apply to Join' : 'Join This Organization'}
                </h3>
                <p className="text-sm text-gray-600">
                  {isApplicationBased 
                    ? 'Fill out a short application to request membership.'
                    : 'Become a member and connect with others.'}
                </p>
                {isApplicationBased && applicationDeadline && (
                  <p className="text-sm text-orange-600 mt-1 font-medium">
                    📅 Deadline: {new Date(applicationDeadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(applicationDeadline).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleJoinClick}
                disabled={applyLoading}
                className="px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-colors disabled:opacity-50 min-w-[140px]"
              >
                {applyLoading ? 'Loading...' : isApplicationBased ? 'Apply Now' : 'Join Now'}
              </motion.button>
            </div>
          )}
          
          {applyError && (
            <p className="text-red-600 text-sm mt-3 text-center">{applyError}</p>
          )}
        </motion.div>

        {/* Officer/Admin Tabs */}
        {isJoined && isOfficerOrAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6"
          >
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Tab Headers */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'info'
                      ? 'text-tamu-maroon border-b-2 border-tamu-maroon bg-tamu-maroon/5'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Info
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'members'
                      ? 'text-tamu-maroon border-b-2 border-tamu-maroon bg-tamu-maroon/5'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Members ({members.length})
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('applications')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'applications'
                        ? 'text-tamu-maroon border-b-2 border-tamu-maroon bg-tamu-maroon/5'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Applications
                  </button>
                )}
              </div>

              {/* Tab Content */}
              {activeTab === 'members' && (
                <div className="p-4">
                  {membersLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tamu-maroon mx-auto"></div>
                    </div>
                  ) : members.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No members yet</p>
                  ) : (
                    <div className="space-y-3">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {member.profilePicture ? (
                              <Image
                                src={member.profilePicture}
                                alt={member.name}
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-tamu-maroon/10 flex items-center justify-center">
                                <span className="text-tamu-maroon font-semibold">
                                  {member.name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-800">{member.name}</p>
                                {member.title && (
                                  <span className="text-xs text-gray-500">• {member.title}</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{member.email}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            member.role === 'admin' 
                              ? 'bg-purple-100 text-purple-700' 
                              : member.role === 'officer'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {member.role === 'admin' ? 'Admin' : member.role === 'officer' ? 'Officer' : 'Member'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {isAdmin && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <Link href="/org/members">
                        <button className="w-full px-4 py-2 text-sm font-medium text-tamu-maroon border border-tamu-maroon rounded-lg hover:bg-tamu-maroon hover:text-white transition-colors">
                          Manage Members
                        </button>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'applications' && isAdmin && (
                <div className="p-4">
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 mb-4">Review and manage member applications</p>
                    <Link href="/org/applications">
                      <button className="px-4 py-2 text-sm font-medium bg-tamu-maroon text-white rounded-lg hover:bg-tamu-maroon-light transition-colors">
                        Review Applications
                      </button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Details Cards - Show when not officer/admin OR when info tab is active */}
        {(!isOfficerOrAdmin || activeTab === 'info') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Meeting Info */}
          {(org.meeting_frequency || org.meeting_times || org.meeting_locations) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Meeting Information</h3>
              <div className="space-y-3">
                {org.meeting_frequency && org.meeting_frequency !== 'nan' && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Frequency</span>
                    <p className="text-gray-800">{org.meeting_frequency}</p>
                  </div>
                )}
                {org.meeting_times && org.meeting_times !== 'nan' && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Times</span>
                    <p className="text-gray-800">{org.meeting_times}</p>
                  </div>
                )}
                {org.meeting_locations && org.meeting_locations !== 'nan' && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Location</span>
                    <p className="text-gray-800">{org.meeting_locations}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Membership Info */}
          {(org.dues_required || org.time_commitment || org.member_count) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Membership Details</h3>
              <div className="space-y-3">
                {org.dues_required && org.dues_required !== 'nan' && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Dues</span>
                    <p className="text-gray-800">
                      {org.dues_required}
                      {org.dues_cost && org.dues_cost !== 'nan' && ` - ${org.dues_cost}`}
                    </p>
                  </div>
                )}
                {org.time_commitment && org.time_commitment !== 'nan' && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Time Commitment</span>
                    <p className="text-gray-800">{org.time_commitment}</p>
                  </div>
                )}
                {org.member_count && org.member_count !== 'nan' && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Members</span>
                    <p className="text-gray-800">{org.member_count}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Activities */}
          {org.typical_activities && org.typical_activities !== 'nan' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Activities</h3>
              <div className="flex flex-wrap gap-2">
                {org.typical_activities.split(',').map((activity, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                    {activity.trim()}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Contact */}
          {(org.website || org.administrative_contact_info) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact</h3>
              <div className="space-y-3">
                {org.website && org.website !== 'nan' && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Website</span>
                    <p>
                      <a 
                        href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-tamu-maroon hover:underline"
                      >
                        {org.website}
                      </a>
                    </p>
                  </div>
                )}
                {org.administrative_contact_info && org.administrative_contact_info !== 'nan' && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Contact</span>
                    <p className="text-gray-800">{org.administrative_contact_info}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
        )}
      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAuthModal(false)}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
            >
              {verificationSent ? (
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Check Your Email</h3>
                  <p className="text-gray-600 mb-4">
                    We sent a verification link to <strong>{authEmail}</strong>. 
                    Click the link to verify your account and complete joining.
                  </p>
                  <button
                    onClick={() => {
                      setShowAuthModal(false)
                      setVerificationSent(false)
                    }}
                    className="px-4 py-2 text-tamu-maroon hover:underline"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light p-4 text-white">
                    <h2 className="text-xl font-bold">
                      {authMode === 'signup' ? 'Create Account' : 'Sign In'}
                    </h2>
                    <p className="text-sm text-white/80 mt-1">
                      {authMode === 'signup' 
                        ? `Create an account to ${isApplicationBased ? 'apply to' : 'join'} ${org.name}`
                        : `Sign in to ${isApplicationBased ? 'apply to' : 'join'} ${org.name}`}
                    </p>
                  </div>

                  <form onSubmit={authMode === 'signup' ? handleSignUp : handleLogin} className="p-4 space-y-4">
                    {authError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                        {authError}
                      </div>
                    )}

                    {authMode === 'signup' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name (optional)
                        </label>
                        <input
                          type="text"
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          placeholder="Your name"
                          className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder={authMode === 'signup' ? 'Create a password (8+ chars)' : 'Your password'}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none focus:ring-1 focus:ring-tamu-maroon"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium hover:bg-tamu-maroon-light transition-colors disabled:opacity-50"
                    >
                      {authLoading 
                        ? 'Loading...' 
                        : authMode === 'signup' 
                          ? 'Create Account' 
                          : 'Sign In'}
                    </button>

                    <div className="text-center text-sm text-gray-600">
                      {authMode === 'signup' ? (
                        <>
                          Already have an account?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode('login')
                              setAuthError(null)
                            }}
                            className="text-tamu-maroon hover:underline font-medium"
                          >
                            Sign In
                          </button>
                        </>
                      ) : (
                        <>
                          Don&apos;t have an account?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode('signup')
                              setAuthError(null)
                            }}
                            className="text-tamu-maroon hover:underline font-medium"
                          >
                            Create One
                          </button>
                        </>
                      )}
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Application Form Modal */}
      <AnimatePresence>
        {showApplicationForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowApplicationForm(false)}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light p-4 text-white flex-shrink-0">
                <h2 className="text-xl font-bold">Apply to {org.name}</h2>
                <p className="text-sm text-white/80 mt-1">Fill out the form below to submit your application</p>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                <DynamicApplicationForm
                  organizationId={org.id}
                  organizationName={org.name}
                  onSubmit={handleSubmitApplication}
                  onCancel={() => setShowApplicationForm(false)}
                  loading={applyLoading}
                  error={applyError}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

