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
        
        // Check if on platform
        const { data: orgAccount } = await supabase
          .from('org_accounts')
          .select('id, email_verified, is_active')
          .eq('organization_id', orgId)
          .single()
        
        setIsOnPlatform(orgAccount?.email_verified && orgAccount?.is_active)
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
      whyJoin: data.whyJoin
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
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">{org.name}</h1>
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
              {isApplicationBased && isOnPlatform && (
                <span className="px-3 py-1 bg-orange-400/30 rounded-full text-sm font-medium">
                  Application Required
                </span>
              )}
            </div>
            {org.bio && org.bio !== 'nan' && (
              <p className="text-white/90 text-lg leading-relaxed">{org.bio}</p>
            )}
          </div>
        </motion.div>

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

        {/* Details Cards */}
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

