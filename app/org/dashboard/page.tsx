'use client'

import { useState, useEffect, useCallback } from 'react'
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

// Editable fields configuration
const editableFields: { key: keyof Organization; label: string; type: 'text' | 'textarea' }[] = [
  { key: 'bio', label: 'Organization Bio', type: 'textarea' },
  { key: 'website', label: 'Website', type: 'text' },
  { key: 'administrative_contact_info', label: 'Contact Info', type: 'text' },
  { key: 'typical_majors', label: 'Typical Majors', type: 'textarea' },
  { key: 'typical_classifications', label: 'Typical Classifications', type: 'text' },
  { key: 'meeting_frequency', label: 'Meeting Frequency', type: 'text' },
  { key: 'meeting_times', label: 'Meeting Times', type: 'text' },
  { key: 'meeting_locations', label: 'Meeting Locations', type: 'text' },
  { key: 'dues_required', label: 'Dues Required', type: 'text' },
  { key: 'dues_cost', label: 'Dues Cost', type: 'text' },
  { key: 'application_required', label: 'Application Required', type: 'text' },
  { key: 'time_commitment', label: 'Time Commitment', type: 'text' },
  { key: 'member_count', label: 'Member Count', type: 'text' },
  { key: 'club_type', label: 'Club Type', type: 'text' },
  { key: 'typical_activities', label: 'Typical Activities', type: 'textarea' },
  { key: 'offered_skills_or_benefits', label: 'Skills & Benefits Offered', type: 'textarea' },
  { key: 'club_culture_style', label: 'Club Culture', type: 'textarea' },
  { key: 'inclusivity_focus', label: 'Inclusivity Focus', type: 'textarea' },
  { key: 'new_member_onboarding_process', label: 'Onboarding Process', type: 'textarea' },
]

export default function OrgDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [editingField, setEditingField] = useState<keyof Organization | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Fetch organization data
  const fetchOrganization = useCallback(async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        router.push('/login')
        return
      }

      // Check if user is an org account
      if (!user.user_metadata?.is_org_account) {
        // Not an org account, redirect to student dashboard
        router.push('/dashboard')
        return
      }

      // Get org account to find organization_id
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

      // Fetch organization data
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

      // Subscribe to changes on this specific organization
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
            console.log('Organization updated in real-time:', payload)
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

  // Start editing a field
  const startEditing = (field: keyof Organization) => {
    setEditingField(field)
    setEditValue(organization?.[field] as string || '')
    setError('')
    setSaveSuccess(false)
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingField(null)
    setEditValue('')
  }

  // Save field changes
  const saveField = async () => {
    if (!organization || !editingField) return

    setSaving(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ [editingField]: editValue || null })
        .eq('id', organization.id)

      if (updateError) throw updateError

      // Update local state (real-time subscription will also update it)
      setOrganization(prev => prev ? { ...prev, [editingField]: editValue || null } : null)
      setSaveSuccess(true)
      setEditingField(null)
      setEditValue('')
      
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Sign out handler
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
          <button
            onClick={() => router.push('/login')}
            className="text-tamu-maroon hover:underline"
          >
            Return to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image 
                src="/logo.png" 
                alt="ORGanize TAMU Logo" 
                width={40}
                height={40}
                className="flex-shrink-0 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-tamu-maroon">Organization Dashboard</h1>
                <p className="text-sm text-gray-600">{organization.name}</p>
              </div>
            </div>
            <motion.button
              onClick={handleSignOut}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 text-gray-700 hover:text-tamu-maroon border border-gray-300 rounded-lg font-medium hover:border-tamu-maroon transition-colors"
            >
              Sign Out
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-green-50 border-2 border-green-200 rounded-lg p-4"
            >
              <p className="text-green-800">Changes saved successfully!</p>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4"
            >
              <p className="text-red-800">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real-time indicator */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Real-time updates enabled</span>
          </div>
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
        </div>

        {/* Organization Name Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-md p-6 mb-6"
        >
          <h2 className="text-3xl font-bold text-gray-800">{organization.name}</h2>
          {organization.club_type && (
            <span className="inline-block mt-2 px-3 py-1 bg-tamu-maroon/10 text-tamu-maroon rounded-full text-sm font-medium">
              {organization.club_type}
            </span>
          )}
        </motion.div>

        {/* Editable Fields */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <h3 className="text-xl font-semibold text-gray-800 mb-6">Organization Details</h3>
          <p className="text-sm text-gray-500 mb-6">
            Click on any field to edit. Changes are saved to the database and synced in real-time.
          </p>

          <div className="space-y-6">
            {editableFields.map((field) => (
              <div key={field.key} className="border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between mb-2">
                  <label className="text-sm font-medium text-gray-600">{field.label}</label>
                  {editingField !== field.key && (
                    <button
                      onClick={() => startEditing(field.key)}
                      className="text-sm text-tamu-maroon hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingField === field.key ? (
                  <div className="space-y-3">
                    {field.type === 'textarea' ? (
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        rows={4}
                        className="w-full p-3 border-2 border-tamu-maroon rounded-lg focus:outline-none resize-none"
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                        autoFocus
                      />
                    ) : (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full p-3 border-2 border-tamu-maroon rounded-lg focus:outline-none"
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                        autoFocus
                      />
                    )}
                    <div className="flex gap-2">
                      <motion.button
                        onClick={saveField}
                        disabled={saving}
                        whileHover={{ scale: saving ? 1 : 1.02 }}
                        whileTap={{ scale: saving ? 1 : 0.98 }}
                        className={`px-4 py-2 bg-tamu-maroon text-white rounded-lg font-medium text-sm ${
                          saving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-tamu-maroon-light'
                        }`}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </motion.button>
                      <button
                        onClick={cancelEditing}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-800 whitespace-pre-wrap">
                    {organization[field.key] || (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Demographics Section (Read-only) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-md p-6 mt-6"
        >
          <h3 className="text-xl font-semibold text-gray-800 mb-6">Membership Demographics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-600">Eligible Classifications</label>
              <p className="text-gray-800 mt-1">{organization.all_eligible_classifications || 'All'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Eligible Races</label>
              <p className="text-gray-800 mt-1">{organization.eligible_races || 'All'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Eligible Gender</label>
              <p className="text-gray-800 mt-1">{organization.eligible_gender || 'All'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Competitive/Non-Competitive</label>
              <p className="text-gray-800 mt-1">{organization.competitive_or_non_competitive || 'Not specified'}</p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

