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

export default function OrgDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('about')
  
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
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (orgAccountError || !orgAccount) {
        setError('Organization account not found')
        setLoading(false)
        return
      }

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

  // Inline editable field component
  const EditableField = ({ 
    field, 
    label, 
    value, 
    type = 'text',
    placeholder 
  }: { 
    field: keyof Organization
    label: string
    value: string | null
    type?: 'text' | 'textarea'
    placeholder?: string
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
                setEditValues({ ...editValues, [field]: displayValue })
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
                onChange={(e) => setEditValues({ ...editValues, [field]: e.target.value })}
                rows={3}
                className="w-full p-2 text-sm border border-tamu-maroon rounded-lg focus:outline-none focus:ring-2 focus:ring-tamu-maroon/20 resize-none"
                placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
                autoFocus
              />
            ) : (
              <input
                type="text"
                value={editValues[field] || ''}
                onChange={(e) => setEditValues({ ...editValues, [field]: e.target.value })}
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
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          {(['about', 'details', 'membership'] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-tamu-maroon text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'about' && 'About'}
              {tab === 'details' && 'Details'}
              {tab === 'membership' && 'Membership'}
            </button>
          ))}
        </div>

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
                  />
                  <EditableField
                    field="administrative_contact_info"
                    label="Contact Email"
                    value={organization.administrative_contact_info}
                    placeholder="contact@example.com"
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
                  <EditableField field="meeting_frequency" label="Frequency" value={organization.meeting_frequency} />
                  <EditableField field="meeting_times" label="Times" value={organization.meeting_times} />
                  <EditableField field="meeting_locations" label="Locations" value={organization.meeting_locations} />
                </div>
              </div>

              {/* Dues & Requirements Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Dues & Requirements</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EditableField field="dues_required" label="Dues Required" value={organization.dues_required} placeholder="Yes/No" />
                  <EditableField field="dues_cost" label="Dues Amount" value={organization.dues_cost} placeholder="$XX per semester" />
                  <EditableField field="application_required" label="Application Required" value={organization.application_required} placeholder="Yes/No" />
                  <EditableField field="time_commitment" label="Time Commitment" value={organization.time_commitment} placeholder="X hours/week" />
                </div>
              </div>

              {/* Organization Info Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Organization Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EditableField field="member_count" label="Member Count" value={organization.member_count} />
                  <EditableField field="club_type" label="Club Type" value={organization.club_type} />
                </div>
              </div>

              {/* Culture Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Culture & Benefits</h3>
                <div className="space-y-4">
                  <EditableField field="club_culture_style" label="Club Culture" value={organization.club_culture_style} type="textarea" />
                  <EditableField field="offered_skills_or_benefits" label="Skills & Benefits" value={organization.offered_skills_or_benefits} type="textarea" />
                  <EditableField field="new_member_onboarding_process" label="Onboarding Process" value={organization.new_member_onboarding_process} type="textarea" />
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
                <p className="text-xs text-gray-500 mb-3">Leave as &quot;All&quot; unless your org has specific eligibility requirements</p>
                
                <div className="flex flex-wrap gap-2">
                  {RACES.map((race) => {
                    const currentRaces = organization.eligible_races || 'All'
                    const isAll = race === 'All' && (!organization.eligible_races || organization.eligible_races === 'nan' || organization.eligible_races.toLowerCase() === 'all')
                    const isSelected = isAll || (currentRaces.toLowerCase().includes(race.toLowerCase()) && race !== 'All')
                    return (
                      <button
                        key={race}
                        onClick={() => saveField('eligible_races', race === 'All' ? null : race)}
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
              </div>

              {/* Inclusivity */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <EditableField field="inclusivity_focus" label="Inclusivity Focus" value={organization.inclusivity_focus} type="textarea" placeholder="Describe your organization's inclusivity initiatives..." />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
