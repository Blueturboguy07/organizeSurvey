'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import Image from 'next/image'

interface Organization {
  id: string
  name: string
  bio: string | null
  website: string | null
  administrative_contact_info: string | null
  typical_majors: string | null
  all_eligible_classifications: string | null
  typical_classifications: string | null
  eligible_races: string | null
  eligible_gender: string | null
  eligible_sexuality: string | null
  meeting_frequency: string | null
  meeting_times: string | null
  meeting_locations: string | null
  dues_required: string | null
  dues_cost: string | null
  application_required: string | null
  application_difficulty: string | null
  time_commitment: string | null
  member_count: string | null
  club_type: string | null
  competitive_or_non_competitive: string | null
  leadership_roles_available: string | null
  new_member_onboarding_process: string | null
  typical_activities: string | null
  required_skills: string | null
  offered_skills_or_benefits: string | null
  club_culture_style: string | null
  inclusivity_focus: string | null
  expected_member_traits: string | null
  national_local_affiliation: string | null
  is_application_based: boolean | null
  updated_at: string
}

// Career fields from survey
const CAREER_FIELDS = [
  'Engineering',
  'Business/Finance',
  'Medicine/Healthcare',
  'Law',
  'Education',
  'Arts/Design',
  'Technology/Computer Science',
  'Science/Research',
  'Agriculture',
  'Communication/Media',
  'Social Work',
  'Government/Public Service',
  'Sports/Fitness',
  'Hospitality/Tourism'
]

// Engineering types from survey
const ENGINEERING_TYPES = [
  'Aerospace engineering',
  'Architectural engineering',
  'Biological and agricultural engineering',
  'Biomedical engineering',
  'Chemical engineering',
  'Civil engineering',
  'Computer engineering',
  'Electrical engineering',
  'Environmental engineering',
  'Industrial engineering',
  'Interdisciplinary engineering',
  'Materials science and engineering',
  'Mechanical engineering',
  'Nuclear engineering',
  'Ocean engineering',
  'Petroleum engineering',
  'Engineering technology and related programs',
  'Electronic systems engineering technology',
  'Manufacturing and mechanical engineering technology',
  'Multidisciplinary engineering technology',
  'Industrial distribution',
  'Computer science'
]

// Activities from survey
const ACTIVITIES = [
  'Volunteering',
  'Social Events',
  'Projects',
  'Competitions',
  'Workshops',
  'Trips',
  'Networking',
  'Community Service',
  'Professional Development',
  'Research',
  'Mentorship',
  'Fundraising',
  'Sports/Recreation',
  'Cultural Events',
  'Academic Support'
]

const CLASSIFICATIONS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']
const GENDERS = ['All', 'Male', 'Female', 'Other']
const SEXUALITIES = ['All', 'Straight', 'Gay', 'Lesbian', 'Other']
const RACES = ['All', 'Asian', 'Black', 'Hispanic', 'White', 'South Asian', 'Pacific Islander', 'Other']

type ActiveTab = 'about' | 'details' | 'membership'

interface Application {
  id: string
  user_id: string
  applicant_name: string
  applicant_email: string
  why_join: string
  status: 'waiting' | 'interview' | 'accepted' | 'rejected'
  created_at: string
  status_updated_at: string
}

const APPLICATION_STATUSES = [
  { value: 'waiting', label: 'Waiting', color: 'bg-orange-100 text-orange-700', icon: '⏳' },
  { value: 'interview', label: 'Interview', color: 'bg-blue-100 text-blue-700', icon: '📅' },
  { value: 'accepted', label: 'Accepted', color: 'bg-green-100 text-green-700', icon: '✓' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700', icon: '✗' },
] as const

// Extracted EditableField component to prevent re-creation on every render
const EditableField = ({ 
  field, 
  label, 
  value, 
  type = 'text',
  placeholder,
  editingField,
  editValues,
  setEditingField,
  setEditValues,
  saving,
  saveField
}: { 
  field: keyof Organization
  label: string
  value: string | null
  type?: 'text' | 'textarea'
  placeholder?: string
  editingField: string | null
  editValues: Record<string, string>
  setEditingField: (field: string | null) => void
  setEditValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
  saving: boolean
  saveField: (field: keyof Organization, value: string | null) => void
}) => {
  const isEditing = editingField === field
  const displayValue = value && value !== 'nan' ? value : ''
  
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
        {!isEditing && (
          <button
            onClick={() => {
              setEditingField(field)
              setEditValues(prev => ({ ...prev, [field]: displayValue }))
            }}
            className="opacity-0 group-hover:opacity-100 text-xs text-tamu-maroon hover:underline transition-opacity"
          >
            Edit
          </button>
        )}
      </div>
      
      {isEditing ? (
        <div className="space-y-2">
          {type === 'textarea' ? (
            <textarea
              value={editValues[field] || ''}
              onChange={(e) => setEditValues(prev => ({ ...prev, [field]: e.target.value }))}
              rows={3}
              className="w-full p-2 text-sm border border-tamu-maroon rounded-lg focus:outline-none focus:ring-2 focus:ring-tamu-maroon/20 resize-none"
              placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={editValues[field] || ''}
              onChange={(e) => setEditValues(prev => ({ ...prev, [field]: e.target.value }))}
              className="w-full p-2 text-sm border border-tamu-maroon rounded-lg focus:outline-none focus:ring-2 focus:ring-tamu-maroon/20"
              placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
              autoFocus
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => saveField(field, editValues[field] || null)}
              disabled={saving}
              className="px-3 py-1 text-xs bg-tamu-maroon text-white rounded-md hover:bg-tamu-maroon-light disabled:opacity-50"
            >
              {saving ? '...' : 'Save'}
            </button>
            <button
              onClick={() => setEditingField(null)}
              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-gray-800 text-sm">
          {displayValue || <span className="text-gray-400 italic">Not set</span>}
        </p>
      )}
    </div>
  )
}

export default function OrgDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('about')
  const [isContentExpanded, setIsContentExpanded] = useState(false)
  const [isApplicationBased, setIsApplicationBased] = useState(false)
  const [applicationToggleSaving, setApplicationToggleSaving] = useState(false)
  
  // Applications state
  const [applications, setApplications] = useState<Application[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [showApplicationsList, setShowApplicationsList] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [orgSlug, setOrgSlug] = useState<string | null>(null)
  
  // Editing states
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  
  // Tag input states
  const [careerFieldInput, setCareerFieldInput] = useState('')
  const [showCareerFieldDropdown, setShowCareerFieldDropdown] = useState(false)
  const [activityInput, setActivityInput] = useState('')
  const [showActivityDropdown, setShowActivityDropdown] = useState(false)
  const [engineeringTypeInput, setEngineeringTypeInput] = useState('')
  const [showEngineeringTypeDropdown, setShowEngineeringTypeDropdown] = useState(false)
  
  // Gender and sexuality "Other" text inputs
  const [genderOther, setGenderOther] = useState('')
  const [sexualityOther, setSexualityOther] = useState('')
  const [showGenderOtherInput, setShowGenderOtherInput] = useState(false)
  const [showSexualityOtherInput, setShowSexualityOtherInput] = useState(false)
  
  const careerFieldInputRef = useRef<HTMLInputElement>(null)
  const activityInputRef = useRef<HTMLInputElement>(null)
  const engineeringTypeInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Parse comma-separated string to array
  const parseToArray = (value: string | null): string[] => {
    if (!value || value === 'nan') return []
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0)
  }

  // Join array to comma-separated string
  const arrayToString = (arr: string[]): string => {
    return arr.join(', ')
  }

  // Fetch organization data
  const fetchOrganization = useCallback(async () => {
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
        .select('organization_id, slug')
        .eq('user_id', user.id)
        .single()

      if (orgAccountError || !orgAccount) {
        setError('Organization account not found')
        setLoading(false)
        return
      }
      
      // Set the slug for sharing
      setOrgSlug(orgAccount.slug)

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgAccount.organization_id)
        .single()

      if (orgError || !orgData) {
        setError('Organization not found')
        setLoading(false)
        return
      }

      setOrganization(orgData)
      setLastUpdated(orgData.updated_at)
      setIsApplicationBased(orgData.is_application_based ?? false)
      
      // Initialize "Other" input visibility based on existing data
      const standardGenders = ['all', 'male', 'female', 'nan']
      const standardSexualities = ['all', 'straight', 'gay', 'lesbian', 'nan']
      
      if (orgData.eligible_gender && !standardGenders.includes(orgData.eligible_gender.toLowerCase())) {
        setShowGenderOtherInput(true)
        setGenderOther(orgData.eligible_gender)
      }
      
      if (orgData.eligible_sexuality && !standardSexualities.includes(orgData.eligible_sexuality.toLowerCase())) {
        setShowSexualityOtherInput(true)
        setSexualityOther(orgData.eligible_sexuality)
      }
      
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load organization')
      setLoading(false)
    }
  }, [supabase, router])

  // Set up real-time subscription
  useEffect(() => {
    fetchOrganization()

    let channel: RealtimeChannel | null = null

    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: orgAccount } = await supabase
        .from('org_accounts')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (!orgAccount) return

      channel = supabase
        .channel(`org-${orgAccount.organization_id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'organizations',
            filter: `id=eq.${orgAccount.organization_id}`
          },
          (payload) => {
            setOrganization(payload.new as Organization)
            setLastUpdated(payload.new.updated_at)
          }
        )
        .subscribe()
    }

    setupRealtimeSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [fetchOrganization, supabase])

  // Fetch and subscribe to applications (realtime)
  useEffect(() => {
    if (!organization?.id) return

    let applicationsChannel: RealtimeChannel | null = null

    const fetchApplications = async () => {
      setApplicationsLoading(true)
      const { data, error } = await supabase
        .from('applications')
        .select('id, user_id, applicant_name, applicant_email, why_join, status, created_at, status_updated_at')
        .eq('organization_id', organization.id)
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
      .channel(`applications-${organization.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `organization_id=eq.${organization.id}`
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
          }
        }
      )
      .subscribe()

    return () => {
      if (applicationsChannel) {
        supabase.removeChannel(applicationsChannel)
      }
    }
  }, [organization?.id, supabase])

  // Save a single field
  const saveField = async (field: keyof Organization, value: string | null) => {
    if (!organization) return

    setSaving(true)
    setError('')

    try {
      let finalValue = value || null
      
      // Special handling for typical_majors: preserve career fields and engineering types when editing typical majors text
      if (field === 'typical_majors' && editingField === 'typical_majors') {
        // When editing typical majors text, preserve career fields and engineering types
        const careerFields = getCareerFields()
        const engineeringTypes = getEngineeringTypes()
        const typicalMajorsText = value ? parseToArray(value) : []
        // Combine: career fields + engineering types + typical majors text
        const allFields = [...careerFields, ...engineeringTypes, ...typicalMajorsText]
        finalValue = allFields.length > 0 ? arrayToString(allFields) : null
      }

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ [field]: finalValue })
        .eq('id', organization.id)

      if (updateError) throw updateError

      setOrganization(prev => prev ? { ...prev, [field]: finalValue } : null)
      setSaveSuccess(`Updated!`)
      setEditingField(null)
      
      setTimeout(() => setSaveSuccess(''), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Get career fields (excluding engineering types)
  const getCareerFields = (): string[] => {
    if (!organization) return []
    const allFields = parseToArray(organization.typical_majors)
    return allFields.filter(f => !ENGINEERING_TYPES.includes(f))
  }

  // Get engineering types
  const getEngineeringTypes = (): string[] => {
    if (!organization) return []
    const allFields = parseToArray(organization.typical_majors)
    return allFields.filter(f => ENGINEERING_TYPES.includes(f))
  }

  // Check if Engineering is selected as a career field
  const hasEngineeringCareerField = (): boolean => {
    return getCareerFields().includes('Engineering')
  }

  // Handle adding a career field tag
  const addCareerField = (field: string) => {
    if (!organization) return
    const currentFields = getCareerFields()
    if (!currentFields.includes(field)) {
      const engineeringTypes = getEngineeringTypes()
      const newFields = [...currentFields, field, ...engineeringTypes]
      saveField('typical_majors', arrayToString(newFields))
    }
    setCareerFieldInput('')
    setShowCareerFieldDropdown(false)
  }

  // Handle removing a career field tag
  const removeCareerField = (field: string) => {
    if (!organization) return
    const currentFields = getCareerFields()
    const newFields = currentFields.filter(f => f !== field)
    const engineeringTypes = getEngineeringTypes()
    const allFields = [...newFields, ...engineeringTypes]
    
    // If removing Engineering, also remove all engineering types
    if (field === 'Engineering') {
      saveField('typical_majors', newFields.length > 0 ? arrayToString(newFields) : null)
    } else {
      saveField('typical_majors', allFields.length > 0 ? arrayToString(allFields) : null)
    }
  }

  // Handle adding an engineering type
  const addEngineeringType = (type: string) => {
    if (!organization) return
    const currentFields = getCareerFields()
    const currentTypes = getEngineeringTypes()
    if (!currentTypes.includes(type)) {
      const newTypes = [...currentTypes, type]
      const allFields = [...currentFields, ...newTypes]
      saveField('typical_majors', arrayToString(allFields))
    }
    setEngineeringTypeInput('')
    setShowEngineeringTypeDropdown(false)
  }

  // Handle removing an engineering type
  const removeEngineeringType = (type: string) => {
    if (!organization) return
    const currentFields = getCareerFields()
    const currentTypes = getEngineeringTypes()
    const newTypes = currentTypes.filter(t => t !== type)
    const allFields = [...currentFields, ...newTypes]
    saveField('typical_majors', allFields.length > 0 ? arrayToString(allFields) : null)
  }

  // Handle adding an activity tag (only from predefined list)
  const addActivity = (activity: string) => {
    if (!organization || !activity.trim()) return
    // Only allow activities from the predefined list
    if (!ACTIVITIES.includes(activity.trim())) return
    const currentActivities = parseToArray(organization.typical_activities)
    if (!currentActivities.includes(activity.trim())) {
      const newActivities = [...currentActivities, activity.trim()]
      saveField('typical_activities', arrayToString(newActivities))
    }
    setActivityInput('')
    setShowActivityDropdown(false)
  }

  // Handle removing an activity tag
  const removeActivity = (activity: string) => {
    if (!organization) return
    const currentActivities = parseToArray(organization.typical_activities)
    const newActivities = currentActivities.filter(a => a !== activity)
    saveField('typical_activities', newActivities.length > 0 ? arrayToString(newActivities) : null)
  }

  // Filter career fields for dropdown
  const filteredCareerFields = CAREER_FIELDS.filter(f => 
    f.toLowerCase().includes(careerFieldInput.toLowerCase()) &&
    !getCareerFields().includes(f)
  )

  // Filter engineering types for dropdown
  const filteredEngineeringTypes = ENGINEERING_TYPES.filter(t => 
    t.toLowerCase().includes(engineeringTypeInput.toLowerCase()) &&
    !getEngineeringTypes().includes(t)
  )

  // Filter activities for dropdown
  const filteredActivities = ACTIVITIES.filter(a => 
    a.toLowerCase().includes(activityInput.toLowerCase()) &&
    !parseToArray(organization?.typical_activities || '').includes(a)
  )

  // Handle classification toggle
  const toggleClassification = (classification: string) => {
    if (!organization) return
    const current = parseToArray(organization.typical_classifications)
    let newClassifications: string[]
    
    if (current.includes(classification)) {
      newClassifications = current.filter(c => c !== classification)
    } else {
      newClassifications = [...current, classification]
    }
    
    saveField('typical_classifications', newClassifications.length > 0 ? arrayToString(newClassifications) : null)
  }

  // Handle eligible classification toggle
  const toggleEligibleClassification = (classification: string) => {
    if (!organization) return
    const current = parseToArray(organization.all_eligible_classifications)
    let newClassifications: string[]
    
    if (current.includes(classification)) {
      newClassifications = current.filter(c => c !== classification)
    } else {
      newClassifications = [...current, classification]
    }
    
    saveField('all_eligible_classifications', newClassifications.length > 0 ? arrayToString(newClassifications) : null)
  }

  // Handle eligible race toggle
  const toggleEligibleRace = (race: string) => {
    if (!organization) return
    
    if (race === 'All') {
      // If "All" is selected, clear all races (null = all eligible)
      saveField('eligible_races', null)
      return
    }
    
    const currentRaces = parseToArray(organization.eligible_races)
    let newRaces: string[]
    
    if (currentRaces.includes(race)) {
      newRaces = currentRaces.filter(r => r !== race)
    } else {
      newRaces = [...currentRaces, race]
    }
    
    saveField('eligible_races', newRaces.length > 0 ? arrayToString(newRaces) : null)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Get the share URL using the stored slug
  const getShareUrl = () => {
    if (!orgSlug) return ''
    return `${window.location.origin}/apply/${orgSlug}`
  }

  // Copy share link
  const handleCopyShareLink = async () => {
    const shareUrl = getShareUrl()
    try {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Update application status
  const updateApplicationStatus = async (applicationId: string, newStatus: Application['status'], userId?: string) => {
    if (!organization) return
    
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
      
      // If accepted, automatically add user to the organization
      if (newStatus === 'accepted' && userId) {
        const { error: joinError } = await supabase
          .from('user_joined_orgs')
          .insert({
            user_id: userId,
            organization_id: organization.id
          })
        
        if (joinError) {
          // Check if already joined (duplicate key error)
          if (joinError.code === '23505') {
            console.log('User already a member')
          } else {
            console.error('Error adding user to org:', joinError)
            setError('Status updated but failed to add user to organization')
            return
          }
        }
        
        setSaveSuccess('Application accepted! User has been added to the organization.')
      } else {
        setSaveSuccess(`Application status updated to ${newStatus}`)
      }
      
      setTimeout(() => setSaveSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update status')
    }
  }

  // Toggle application-based setting
  const toggleApplicationBased = async () => {
    if (!organization) return
    
    setApplicationToggleSaving(true)
    setError('')
    
    try {
      const newValue = !isApplicationBased
      
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ is_application_based: newValue })
        .eq('id', organization.id)
      
      if (updateError) throw updateError
      
      setIsApplicationBased(newValue)
      setOrganization(prev => prev ? { ...prev, is_application_based: newValue } : null)
      setSaveSuccess(newValue ? 'Application-based joining enabled' : 'Direct joining enabled')
      setTimeout(() => setSaveSuccess(''), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to update setting')
    } finally {
      setApplicationToggleSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  if (!organization) {
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

  // Common props for EditableField component
  const editableFieldProps = {
    editingField,
    editValues,
    setEditingField,
    setEditValues,
    saving,
    saveField
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image 
                src="/logo.png" 
                alt="ORGanize TAMU Logo" 
                width={36}
                height={36}
                className="flex-shrink-0 object-contain"
              />
              <div>
                <h1 className="text-lg font-bold text-tamu-maroon">ORGanize TAMU</h1>
                <p className="text-xs text-gray-500">Organization Dashboard</p>
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
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

        {/* Organization Card Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-tamu-maroon to-tamu-maroon-light rounded-xl shadow-lg overflow-hidden mb-6"
        >
          <div className="p-6 text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">{organization.name}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {organization.club_type && (
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                      {organization.club_type}
                    </span>
                  )}
                  {lastUpdated && (
                    <span className="text-xs text-white/70">
                      Last updated: {new Date(lastUpdated).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Share Link Button */}
                <motion.button
                  onClick={() => setShowShareModal(true)}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all backdrop-blur-sm flex items-center gap-2 shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </motion.button>
                {/* Edit Info Button */}
                <motion.button
                  onClick={() => setIsContentExpanded(!isContentExpanded)}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all backdrop-blur-sm flex items-center gap-2 shadow-lg"
                >
                  <motion.span
                    animate={{ opacity: isContentExpanded ? 0.8 : 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isContentExpanded ? 'Hide Info' : 'Edit Info'}
                  </motion.span>
                  <motion.svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    animate={{ rotate: isContentExpanded ? 180 : 0 }}
                    transition={{ 
                      duration: 0.4,
                      ease: [0.34, 1.56, 0.64, 1]
                    }}
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </motion.svg>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Application Settings Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Membership Settings</h3>
              <p className="text-xs text-gray-500">
                {isApplicationBased 
                  ? 'Users must apply to join. You can review applications below.'
                  : 'Users can join your organization directly without applying.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${isApplicationBased ? 'text-gray-400' : 'text-green-600'}`}>
                Direct Join
              </span>
              <button
                onClick={toggleApplicationBased}
                disabled={applicationToggleSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-tamu-maroon focus:ring-offset-2 ${
                  isApplicationBased ? 'bg-tamu-maroon' : 'bg-gray-300'
                } ${applicationToggleSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isApplicationBased ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${isApplicationBased ? 'text-tamu-maroon' : 'text-gray-400'}`}>
                Application
              </span>
            </div>
          </div>
        </motion.div>

        {/* Applications Panel - Only show when application-based */}
        {isApplicationBased && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6"
          >
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowApplicationsList(!showApplicationsList)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Pending Applications</h3>
                  <p className="text-xs text-gray-500">
                    {applicationsLoading ? 'Loading...' : `${applications.length} application${applications.length !== 1 ? 's' : ''} waiting for review`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {applications.length > 0 && (
                  <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-sm font-semibold rounded-full">
                    {applications.length}
                  </span>
                )}
                <motion.svg
                  animate={{ rotate: showApplicationsList ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </div>
            </div>

            {/* Applications List */}
            <AnimatePresence>
              {showApplicationsList && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 pt-4 border-t border-gray-100"
                >
                  {applications.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No applications yet. When users apply, they&apos;ll appear here.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {applications.map((app, index) => {
                        const currentStatus = APPLICATION_STATUSES.find(s => s.value === app.status) || APPLICATION_STATUSES[0]
                        return (
                          <motion.div
                            key={app.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-800">{app.applicant_name}</h4>
                                <p className="text-xs text-gray-500 mt-0.5">{app.applicant_email}</p>
                              </div>
                              <span className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${currentStatus.color}`}>
                                {currentStatus.icon} {currentStatus.label}
                              </span>
                            </div>
                            
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-xs text-gray-500 font-medium mb-1">Why they want to join:</p>
                              <p className="text-sm text-gray-700">{app.why_join}</p>
                            </div>
                            
                            {/* Status Change Buttons */}
                            <div className="mt-4 pt-3 border-t border-gray-200">
                              <p className="text-xs text-gray-500 font-medium mb-2">Change Status:</p>
                              <div className="flex flex-wrap gap-2">
                                {APPLICATION_STATUSES.map((status) => (
                                  <button
                                    key={status.value}
                                    onClick={() => updateApplicationStatus(app.id, status.value, app.user_id)}
                                    disabled={app.status === status.value}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                      app.status === status.value
                                        ? `${status.color} ring-2 ring-offset-1 ring-gray-300 cursor-default`
                                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                                  >
                                    {status.icon} {status.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            <p className="text-xs text-gray-400 mt-3">
                              Applied {new Date(app.created_at).toLocaleDateString()} at {new Date(app.created_at).toLocaleTimeString()}
                            </p>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-xs text-gray-500">Real-time updates enabled</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Collapsible Content */}
        <AnimatePresence>
          {isContentExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              transition={{ 
                height: {
                  duration: 0.5,
                  ease: [0.4, 0, 0.2, 1]
                },
                opacity: {
                  duration: 0.3,
                  ease: "easeOut"
                },
                y: {
                  duration: 0.4,
                  ease: [0.34, 1.56, 0.64, 1]
                }
              }}
              className="overflow-hidden"
            >
              {/* Tab Navigation */}
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  delay: 0.15,
                  type: "spring",
                  stiffness: 300,
                  damping: 25
                }}
                className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm border border-gray-200"
              >
                {(['about', 'details', 'membership'] as ActiveTab[]).map((tab) => (
                  <motion.button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                      activeTab === tab
                        ? 'bg-tamu-maroon text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab === 'about' && 'About'}
                    {tab === 'details' && 'Details'}
                    {tab === 'membership' && 'Membership'}
                  </motion.button>
                ))}
              </motion.div>

              {/* Tab Content */}
              <AnimatePresence mode="wait">
          {/* About Tab */}
          {activeTab === 'about' && (
            <motion.div
              key="about"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Bio Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <EditableField
                  field="bio"
                  label="Organization Bio"
                  value={organization.bio}
                  type="textarea"
                  placeholder="Describe your organization..."
                  {...editableFieldProps}
                />
              </div>

              {/* Contact Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EditableField
                    field="website"
                    label="Website"
                    value={organization.website}
                    placeholder="https://..."
                    {...editableFieldProps}
                  />
                  <EditableField
                    field="administrative_contact_info"
                    label="Contact Email"
                    value={organization.administrative_contact_info}
                    placeholder="contact@example.com"
                    {...editableFieldProps}
                  />
                </div>
              </div>

              {/* Career Fields - Tag Input with Dropdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Career Fields</h3>
                <p className="text-xs text-gray-500 mb-3">Select career fields that your organization is relevant to</p>
                
                {/* Current Tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {getCareerFields().map((field) => (
                    <motion.span
                      key={field}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-tamu-maroon/10 text-tamu-maroon rounded-full text-sm"
                    >
                      {field}
                      <button
                        onClick={() => removeCareerField(field)}
                        className="ml-1 hover:text-red-600 font-bold"
                      >
                        ×
                      </button>
                    </motion.span>
                  ))}
                  {getCareerFields().length === 0 && (
                    <span className="text-gray-400 text-sm italic">No career fields selected</span>
                  )}
                </div>

                {/* Add Career Field Input */}
                <div className="relative">
                  <input
                    ref={careerFieldInputRef}
                    type="text"
                    value={careerFieldInput}
                    onChange={(e) => {
                      setCareerFieldInput(e.target.value)
                      setShowCareerFieldDropdown(true)
                    }}
                    onFocus={() => setShowCareerFieldDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCareerFieldDropdown(false), 200)}
                    placeholder="Search career fields..."
                    className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                  />
                  
                  {/* Dropdown */}
                  {showCareerFieldDropdown && filteredCareerFields.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCareerFields.map((field) => (
                        <button
                          key={field}
                          type="button"
                          onClick={() => addCareerField(field)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-tamu-maroon hover:text-white transition-colors"
                        >
                          {field}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Engineering Types - Show when Engineering is selected */}
                {hasEngineeringCareerField() && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t border-gray-200"
                  >
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Engineering Types</h4>
                    <p className="text-xs text-gray-500 mb-3">Select specific engineering types relevant to your organization</p>
                    
                    {/* Current Engineering Type Tags */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {getEngineeringTypes().map((type) => (
                        <motion.span
                          key={type}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm"
                        >
                          {type}
                          <button
                            onClick={() => removeEngineeringType(type)}
                            className="ml-1 hover:text-red-600 font-bold"
                          >
                            ×
                          </button>
                        </motion.span>
                      ))}
                      {getEngineeringTypes().length === 0 && (
                        <span className="text-gray-400 text-sm italic">No engineering types selected</span>
                      )}
                    </div>

                    {/* Add Engineering Type Input */}
                    <div className="relative">
                      <input
                        ref={engineeringTypeInputRef}
                        type="text"
                        value={engineeringTypeInput}
                        onChange={(e) => {
                          setEngineeringTypeInput(e.target.value)
                          setShowEngineeringTypeDropdown(true)
                        }}
                        onFocus={() => setShowEngineeringTypeDropdown(true)}
                        onBlur={() => setTimeout(() => setShowEngineeringTypeDropdown(false), 200)}
                        placeholder="Search engineering types..."
                        className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                      />
                      
                      {/* Dropdown */}
                      {showEngineeringTypeDropdown && filteredEngineeringTypes.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredEngineeringTypes.map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => addEngineeringType(type)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-orange-600 hover:text-white transition-colors"
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Typical Majors - Separate editable field for actual majors */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Typical Majors</h3>
                <p className="text-xs text-gray-500 mb-3">Enter actual majors that typically join your organization (separate from career fields above)</p>
                <EditableField
                  field="typical_majors"
                  label=""
                  value={(() => {
                    // Extract only non-career-field, non-engineering-type values from typical_majors
                    const allFields = parseToArray(organization.typical_majors)
                    const careerFieldsSet = new Set([...CAREER_FIELDS, ...ENGINEERING_TYPES])
                    const typicalMajorsOnly = allFields.filter(f => !careerFieldsSet.has(f))
                    return typicalMajorsOnly.length > 0 ? arrayToString(typicalMajorsOnly) : null
                  })()}
                  type="textarea"
                  placeholder="e.g., Computer Science, Mechanical Engineering, Business Administration..."
                  {...editableFieldProps}
                />
                <p className="text-xs text-gray-400 mt-2 italic">Note: Career fields and engineering types are managed separately above.</p>
              </div>

              {/* Typical Activities - Tag Input with Autocomplete */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Typical Activities</h3>
                <p className="text-xs text-gray-500 mb-3">Add activities your organization typically does</p>
                
                {/* Current Tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {parseToArray(organization.typical_activities).map((activity) => (
                    <motion.span
                      key={activity}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {activity}
                      <button
                        onClick={() => removeActivity(activity)}
                        className="ml-1 hover:text-red-600 font-bold"
                      >
                        ×
                      </button>
                    </motion.span>
                  ))}
                  {parseToArray(organization.typical_activities).length === 0 && (
                    <span className="text-gray-400 text-sm italic">No activities added</span>
                  )}
                </div>

                {/* Add Activity Input with Autocomplete - Only from predefined list */}
                <div className="relative">
                  <input
                    ref={activityInputRef}
                    type="text"
                    value={activityInput}
                    onChange={(e) => {
                      setActivityInput(e.target.value)
                      setShowActivityDropdown(true)
                    }}
                    onFocus={() => setShowActivityDropdown(true)}
                    onBlur={() => setTimeout(() => setShowActivityDropdown(false), 200)}
                    placeholder="Search and select activities from the list..."
                    className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                  />
                  
                  {/* Dropdown */}
                  {showActivityDropdown && filteredActivities.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredActivities.map((activity) => (
                        <button
                          key={activity}
                          type="button"
                          onClick={() => addActivity(activity)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-600 hover:text-white transition-colors"
                        >
                          {activity}
                        </button>
                      ))}
                    </div>
                  )}
                  {showActivityDropdown && filteredActivities.length === 0 && activityInput && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500">
                      No matching activities found. Please select from the predefined list.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Meeting Info Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Meeting Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <EditableField field="meeting_frequency" label="Frequency" value={organization.meeting_frequency} {...editableFieldProps} />
                  <EditableField field="meeting_times" label="Times" value={organization.meeting_times} {...editableFieldProps} />
                  <EditableField field="meeting_locations" label="Locations" value={organization.meeting_locations} {...editableFieldProps} />
                </div>
              </div>

              {/* Dues & Requirements Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Dues & Requirements</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EditableField field="dues_required" label="Dues Required" value={organization.dues_required} placeholder="Yes/No" {...editableFieldProps} />
                  <EditableField field="dues_cost" label="Dues Amount" value={organization.dues_cost} placeholder="$XX per semester" {...editableFieldProps} />
                  <EditableField field="application_required" label="Application Required" value={organization.application_required} placeholder="Yes/No" {...editableFieldProps} />
                  <EditableField field="time_commitment" label="Time Commitment" value={organization.time_commitment} placeholder="X hours/week" {...editableFieldProps} />
                </div>
              </div>

              {/* Organization Info Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Organization Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EditableField field="member_count" label="Member Count" value={organization.member_count} {...editableFieldProps} />
                  <EditableField field="club_type" label="Club Type" value={organization.club_type} {...editableFieldProps} />
                </div>
              </div>

              {/* Culture Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Culture & Benefits</h3>
                <div className="space-y-4">
                  <EditableField field="club_culture_style" label="Club Culture" value={organization.club_culture_style} type="textarea" {...editableFieldProps} />
                  <EditableField field="offered_skills_or_benefits" label="Skills & Benefits" value={organization.offered_skills_or_benefits} type="textarea" {...editableFieldProps} />
                  <EditableField field="new_member_onboarding_process" label="Onboarding Process" value={organization.new_member_onboarding_process} type="textarea" {...editableFieldProps} />
                </div>
              </div>
            </motion.div>
          )}

          {/* Membership Tab */}
          {activeTab === 'membership' && (
            <motion.div
              key="membership"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Typical Classifications */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Typical Classifications</h3>
                <p className="text-xs text-gray-500 mb-3">Select classifications that typically join your organization</p>
                
                <div className="flex flex-wrap gap-2">
                  {CLASSIFICATIONS.map((classification) => {
                    const isSelected = parseToArray(organization.typical_classifications).includes(classification)
                    return (
                      <button
                        key={classification}
                        onClick={() => toggleClassification(classification)}
                        disabled={saving}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-tamu-maroon text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } ${saving ? 'opacity-50' : ''}`}
                      >
                        {classification}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Eligible Classifications */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Eligible Classifications</h3>
                <p className="text-xs text-gray-500 mb-3">Who is allowed to join? Leave empty for all classifications.</p>
                
                <div className="flex flex-wrap gap-2">
                  {CLASSIFICATIONS.map((classification) => {
                    const isSelected = parseToArray(organization.all_eligible_classifications).includes(classification)
                    return (
                      <button
                        key={classification}
                        onClick={() => toggleEligibleClassification(classification)}
                        disabled={saving}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } ${saving ? 'opacity-50' : ''}`}
                      >
                        {classification}
                      </button>
                    )
                  })}
                </div>
                {parseToArray(organization.all_eligible_classifications).length === 0 && (
                  <p className="text-xs text-green-600 mt-2">✓ All classifications are eligible</p>
                )}
              </div>

              {/* Eligible Gender */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Eligible Gender</h3>
                <p className="text-xs text-gray-500 mb-3">Who is allowed to join based on gender?</p>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {GENDERS.map((gender) => {
                    const currentGender = organization.eligible_gender || ''
                    const standardGenders = ['all', 'male', 'female', 'nan']
                    const isOther = currentGender && !standardGenders.includes(currentGender.toLowerCase())
                    const isSelected = (gender === 'All' && (!organization.eligible_gender || organization.eligible_gender === 'nan')) ||
                                       (gender === 'Male' && currentGender.toLowerCase() === 'male') ||
                                       (gender === 'Female' && currentGender.toLowerCase() === 'female') ||
                                       (gender === 'Other' && isOther)
                    return (
                      <button
                        key={gender}
                        onClick={() => {
                          if (gender === 'All') {
                            saveField('eligible_gender', null)
                            setGenderOther('')
                            setShowGenderOtherInput(false)
                          } else if (gender === 'Other') {
                            // Show input field for "Other"
                            setShowGenderOtherInput(true)
                            if (isOther) {
                              setGenderOther(currentGender)
                            } else {
                              setGenderOther('')
                            }
                          } else {
                            saveField('eligible_gender', gender)
                            setGenderOther('')
                            setShowGenderOtherInput(false)
                          }
                        }}
                        disabled={saving}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } ${saving ? 'opacity-50' : ''}`}
                      >
                        {gender}
                      </button>
                    )
                  })}
                </div>
                
                {/* Other gender text input */}
                {(() => {
                  const currentGender = organization.eligible_gender || ''
                  const standardGenders = ['all', 'male', 'female', 'nan']
                  const isOther = currentGender && !standardGenders.includes(currentGender.toLowerCase())
                  const showInput = isOther || showGenderOtherInput
                  
                  return showInput ? (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={genderOther || (isOther ? currentGender : '')}
                        onChange={(e) => {
                          const value = e.target.value
                          setGenderOther(value)
                          if (value.trim()) {
                            saveField('eligible_gender', value.trim())
                          }
                        }}
                        onBlur={() => {
                          if (genderOther.trim()) {
                            saveField('eligible_gender', genderOther.trim())
                          } else if (!genderOther.trim() && isOther) {
                            saveField('eligible_gender', null)
                            setGenderOther('')
                          }
                        }}
                        placeholder="Specify gender..."
                        className="w-full p-2 text-sm border border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  ) : null
                })()}
              </div>

              {/* Eligible Sexuality */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Eligible Sexuality</h3>
                <p className="text-xs text-gray-500 mb-3">Who is allowed to join based on sexuality?</p>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {SEXUALITIES.map((sexuality) => {
                    const currentSexuality = organization.eligible_sexuality || ''
                    const standardSexualities = ['all', 'straight', 'gay', 'lesbian', 'nan']
                    const isOther = currentSexuality && !standardSexualities.includes(currentSexuality.toLowerCase())
                    const isSelected = (sexuality === 'All' && (!organization.eligible_sexuality || organization.eligible_sexuality === 'nan')) ||
                                       (sexuality === 'Straight' && currentSexuality.toLowerCase() === 'straight') ||
                                       (sexuality === 'Gay' && currentSexuality.toLowerCase() === 'gay') ||
                                       (sexuality === 'Lesbian' && currentSexuality.toLowerCase() === 'lesbian') ||
                                       (sexuality === 'Other' && isOther)
                    return (
                      <button
                        key={sexuality}
                        onClick={() => {
                          if (sexuality === 'All') {
                            saveField('eligible_sexuality', null)
                            setSexualityOther('')
                            setShowSexualityOtherInput(false)
                          } else if (sexuality === 'Other') {
                            // Show input field for "Other"
                            setShowSexualityOtherInput(true)
                            if (isOther) {
                              setSexualityOther(currentSexuality)
                            } else {
                              setSexualityOther('')
                            }
                          } else {
                            saveField('eligible_sexuality', sexuality)
                            setSexualityOther('')
                            setShowSexualityOtherInput(false)
                          }
                        }}
                        disabled={saving}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } ${saving ? 'opacity-50' : ''}`}
                      >
                        {sexuality}
                      </button>
                    )
                  })}
                </div>
                
                {/* Other sexuality text input */}
                {(() => {
                  const currentSexuality = organization.eligible_sexuality || ''
                  const standardSexualities = ['all', 'straight', 'gay', 'lesbian', 'nan']
                  const isOther = currentSexuality && !standardSexualities.includes(currentSexuality.toLowerCase())
                  const showInput = isOther || showSexualityOtherInput
                  
                  return showInput ? (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={sexualityOther || (isOther ? currentSexuality : '')}
                        onChange={(e) => {
                          const value = e.target.value
                          setSexualityOther(value)
                          if (value.trim()) {
                            saveField('eligible_sexuality', value.trim())
                          }
                        }}
                        onBlur={() => {
                          if (sexualityOther.trim()) {
                            saveField('eligible_sexuality', sexualityOther.trim())
                          } else if (!sexualityOther.trim() && isOther) {
                            saveField('eligible_sexuality', null)
                            setSexualityOther('')
                          }
                        }}
                        placeholder="Specify sexuality..."
                        className="w-full p-2 text-sm border border-indigo-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  ) : null
                })()}
              </div>

              {/* Eligible Races */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Eligible Races/Ethnicities</h3>
                <p className="text-xs text-gray-500 mb-3">Select multiple races that are eligible to join. Leave as &quot;All&quot; for no restrictions.</p>
                
                <div className="flex flex-wrap gap-2">
                  {RACES.map((race) => {
                    const currentRaces = parseToArray(organization.eligible_races)
                    const isAll = race === 'All' && (!organization.eligible_races || organization.eligible_races === 'nan' || organization.eligible_races.toLowerCase() === 'all')
                    const isSelected = isAll || (race !== 'All' && currentRaces.includes(race))
                    return (
                      <button
                        key={race}
                        onClick={() => toggleEligibleRace(race)}
                        disabled={saving}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } ${saving ? 'opacity-50' : ''}`}
                      >
                        {race}
                      </button>
                    )
                  })}
                </div>
                {parseToArray(organization.eligible_races).length === 0 && (
                  <p className="text-xs text-green-600 mt-2">✓ All races/ethnicities are eligible</p>
                )}
              </div>

              {/* Inclusivity */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <EditableField field="inclusivity_focus" label="Inclusivity Focus" value={organization.inclusivity_focus} type="textarea" placeholder="Describe your organization's inclusivity initiatives..." {...editableFieldProps} />
              </div>
            </motion.div>
          )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Share Your Organization</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Share this link with potential members so they can view and apply to your organization.
              </p>

              {/* Link Display */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs text-gray-500 mb-1">Application Link</p>
                    <p className="text-sm font-mono text-tamu-maroon truncate">
                      {getShareUrl()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Copy Button */}
              <motion.button
                onClick={handleCopyShareLink}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  linkCopied 
                    ? 'bg-green-600 text-white' 
                    : 'bg-tamu-maroon text-white hover:bg-tamu-maroon-light'
                }`}
              >
                {linkCopied ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Link
                  </>
                )}
              </motion.button>

              <p className="text-xs text-gray-400 text-center mt-3">
                Anyone with this link can view your organization&apos;s page
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
