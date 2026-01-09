'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { RealtimeChannel } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'

type UserType = 'student' | 'org'

interface Organization {
  id: string
  name: string
  administrative_contact_info: string | null
}

/**
 * LoginPage Component
 * 
 * REAL-TIME FEATURES:
 * - Organizations list for org rep login: Real-time subscription to organizations table
 *   - If an org name changes, the autocomplete dropdown updates immediately
 *   - New organizations appear automatically
 */
export default function LoginPage() {
  const [userType, setUserType] = useState<UserType | null>(null)
  
  // Student login state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Org login state
  const [orgSearch, setOrgSearch] = useState('')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [filteredOrgs, setFilteredOrgs] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [orgPassword, setOrgPassword] = useState('')
  const [showOrgPassword, setShowOrgPassword] = useState(false)
  const [orgStep, setOrgStep] = useState<'search' | 'password' | 'verification-sent' | 'needs-setup'>('search')
  const [verificationEmail, setVerificationEmail] = useState('')
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { user, loading: authLoading } = useAuth()

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  // Fetch organizations for search with REAL-TIME subscription
  // Organizations list updates automatically when org reps modify their org info
  // Uses pagination to fetch ALL orgs (Supabase defaults to 1000 row limit)
  useEffect(() => {
    let channel: RealtimeChannel | null = null

    async function fetchOrganizations() {
      // Fetch all organizations with pagination (Supabase defaults to 1000 row limit)
      const allOrgs: Organization[] = []
      const PAGE_SIZE = 1000
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name, administrative_contact_info')
          .order('name')
          .range(offset, offset + PAGE_SIZE - 1)
        
        if (error) {
          console.error('Error fetching organizations:', error)
          break
        }

        if (data && data.length > 0) {
          allOrgs.push(...data)
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      console.log(`Loaded ${allOrgs.length} organizations for search`)
      setOrganizations(allOrgs)

      // Set up real-time subscription for organization updates
      channel = supabase
        .channel('login-orgs-realtime')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'organizations'
          },
          (payload) => {
            console.log('Organization change detected:', payload.eventType)
            
            if (payload.eventType === 'INSERT') {
              const newOrg = payload.new as Organization
              setOrganizations(prev => 
                [...prev, newOrg].sort((a, b) => a.name.localeCompare(b.name))
              )
            } else if (payload.eventType === 'UPDATE') {
              const updatedOrg = payload.new as Organization
              setOrganizations(prev => 
                prev.map(org => org.id === updatedOrg.id ? updatedOrg : org)
              )
              // Update selected org if it's the one being edited
              if (selectedOrg?.id === updatedOrg.id) {
                setSelectedOrg(updatedOrg)
              }
            } else if (payload.eventType === 'DELETE') {
              const deletedOrg = payload.old as Organization
              setOrganizations(prev => prev.filter(org => org.id !== deletedOrg.id))
            }
          }
        )
        .subscribe()
    }
    
    if (userType === 'org') {
      fetchOrganizations()
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [userType, supabase, selectedOrg?.id])

  // Filter organizations based on search
  useEffect(() => {
    if (orgSearch.trim() === '') {
      setFilteredOrgs([])
      return
    }
    
    const searchLower = orgSearch.toLowerCase()
    const filtered = organizations.filter(org => 
      org.name.toLowerCase().includes(searchLower)
    ).slice(0, 8) // Limit to 8 results
    
    setFilteredOrgs(filtered)
  }, [orgSearch, organizations])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Student login handler
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })

      if (signInError) throw signInError

      if (data.user) {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  // Organization selection handler
  const handleOrgSelect = async (org: Organization) => {
    setSelectedOrg(org)
    setOrgSearch(org.name)
    setShowDropdown(false)
    setError('')
    setLoading(true)
    
    try {
      // Check if org account exists using API (bypasses RLS)
      const checkResponse = await fetch('/api/org/check-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id })
      })
      
      const accountStatus = await checkResponse.json()
      
      if (!checkResponse.ok) {
        throw new Error(accountStatus.error || 'Failed to check account status')
      }
      
      if (accountStatus.exists && accountStatus.email_verified && accountStatus.has_user) {
        // Account exists AND is fully set up (email verified + password set)
        setOrgStep('password')
      } else if (accountStatus.needs_password_setup) {
        // They clicked the email link but haven't set password yet
        setVerificationEmail(accountStatus.email || 'your registered email')
        setOrgStep('needs-setup')
      } else if (accountStatus.exists && !accountStatus.email_verified) {
        // Account exists but not verified - they haven't clicked the email link yet
        setVerificationEmail(accountStatus.email || 'your registered email')
        setOrgStep('verification-sent')
      } else if (accountStatus.exists && !accountStatus.has_user) {
        // Account exists but setup not complete
        setVerificationEmail(accountStatus.email || 'your registered email')
        setOrgStep('verification-sent')
      } else {
        // Account doesn't exist, send verification email
        // Extract email from administrative_contact_info
        const emailMatch = org.administrative_contact_info?.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i)
        const orgEmail = emailMatch ? emailMatch[1] : null
        
        if (!orgEmail) {
          setError('No email found on file for this organization. Please contact support.')
          setLoading(false)
          return
        }
        
        // Send verification email via API
        const response = await fetch('/api/org/verify-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            organizationId: org.id,
            organizationName: org.name,
            email: orgEmail 
          })
        })
        
        const result = await response.json()
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to send verification email')
        }
        
        // Mask the email for display
        const [localPart, domain] = orgEmail.split('@')
        const maskedEmail = localPart.slice(0, 2) + '***@' + domain
        setVerificationEmail(maskedEmail)
        setOrgStep('verification-sent')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process organization')
    } finally {
      setLoading(false)
    }
  }

  // Organization password login handler
  const handleOrgLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrg) return
    
    setError('')
    setLoading(true)
    
    try {
      // Get org account email
      const { data: orgAccount, error: fetchError } = await supabase
        .from('org_accounts')
        .select('email')
        .eq('organization_id', selectedOrg.id)
        .single()
      
      if (fetchError) throw fetchError
      
      // Sign in with org account credentials
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: orgAccount.email,
        password: orgPassword,
      })

      if (signInError) throw signInError

      if (data.user) {
        router.push('/org/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Invalid password')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  // Initial user type selection screen
  if (userType === null) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full"
        >
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Image 
                src="/logo.png" 
                alt="ORGanize TAMU Logo" 
                width={64}
                height={64}
                className="flex-shrink-0 object-contain"
              />
              <h1 className="text-3xl font-bold text-tamu-maroon">ORGanize TAMU</h1>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Welcome!</h2>
            <p className="text-gray-600">How would you like to sign in?</p>
          </div>

          <div className="space-y-4">
            <motion.button
              onClick={() => setUserType('student')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 px-6 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              I&apos;m a Student
            </motion.button>
            
            <motion.button
              onClick={() => setUserType('org')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 px-6 bg-white text-tamu-maroon border-2 border-tamu-maroon rounded-lg font-semibold hover:bg-tamu-maroon/5 transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              I&apos;m an Org Representative
            </motion.button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full"
      >
        {/* Back button */}
        <button
          onClick={() => {
            setUserType(null)
            setError('')
            setOrgStep('search')
            setSelectedOrg(null)
            setOrgSearch('')
          }}
          className="flex items-center gap-2 text-gray-600 hover:text-tamu-maroon mb-6 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image 
              src="/logo.png" 
              alt="ORGanize TAMU Logo" 
              width={64}
              height={64}
              className="flex-shrink-0 object-contain"
            />
            <h1 className="text-3xl font-bold text-tamu-maroon">ORGanize TAMU</h1>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            {userType === 'student' ? 'Student Sign In' : 'Organization Sign In'}
          </h2>
          <p className="text-gray-600">
            {userType === 'student' ? 'Welcome back!' : 'Manage your organization'}
          </p>
        </div>

        {/* Student Login Form */}
        {userType === 'student' && (
          <>
            <form onSubmit={handleStudentSubmit} className="space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-red-50 border-2 border-red-200 rounded-lg p-4"
                >
                  <p className="text-red-800 text-sm">{error}</p>
                </motion.div>
              )}

              <div>
                <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                  placeholder="your.email@tamu.edu"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-gray-700 font-medium mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full p-3 pr-10 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-tamu-maroon hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className={`w-full py-3 bg-tamu-maroon text-white rounded-lg font-semibold transition-all ${
                  loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-tamu-maroon-light'
                }`}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </motion.button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-tamu-maroon font-semibold hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
          </>
        )}

        {/* Organization Login Form */}
        {userType === 'org' && (
          <div className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-50 border-2 border-red-200 rounded-lg p-4"
              >
                <p className="text-red-800 text-sm">{error}</p>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {/* Step 1: Search for organization */}
              {orgStep === 'search' && (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <label className="block text-gray-700 font-medium mb-2">
                    Search for your organization
                  </label>
                  <div className="relative" ref={dropdownRef}>
                    <div className="relative">
                      <input
                        type="text"
                        value={orgSearch}
                        onChange={(e) => {
                          setOrgSearch(e.target.value)
                          setShowDropdown(true)
                          setSelectedOrg(null)
                        }}
                        onFocus={() => setShowDropdown(true)}
                        className="w-full p-3 pr-10 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                        placeholder="Start typing organization name..."
                      />
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    
                    {/* Autocomplete dropdown */}
                    <AnimatePresence>
                      {showDropdown && filteredOrgs.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                        >
                          {filteredOrgs.map((org) => (
                            <button
                              key={org.id}
                              type="button"
                              onClick={() => handleOrgSelect(org)}
                              disabled={loading}
                              className="w-full px-4 py-3 text-left hover:bg-tamu-maroon/5 transition-colors border-b border-gray-100 last:border-b-0 disabled:opacity-50"
                            >
                              <span className="font-medium text-gray-800">{org.name}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* No results message */}
                    {showDropdown && orgSearch.trim() !== '' && filteredOrgs.length === 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                        No organizations found matching &quot;{orgSearch}&quot;
                      </div>
                    )}
                  </div>
                  
                  <p className="mt-3 text-sm text-gray-500">
                    Select your organization to continue. First-time users will receive a verification email.
                  </p>
                </motion.div>
              )}

              {/* Step 2: Enter password */}
              {orgStep === 'password' && selectedOrg && (
                <motion.div
                  key="password"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <form onSubmit={handleOrgLogin} className="space-y-6">
                    <div className="bg-tamu-maroon/5 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-600">Signing in as</p>
                      <p className="font-semibold text-tamu-maroon">{selectedOrg.name}</p>
                    </div>
                    
                    <div>
                      <label htmlFor="orgPassword" className="block text-gray-700 font-medium mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="orgPassword"
                          type={showOrgPassword ? 'text' : 'password'}
                          value={orgPassword}
                          onChange={(e) => setOrgPassword(e.target.value)}
                          required
                          className="w-full p-3 pr-10 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                          placeholder="Enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOrgPassword(!showOrgPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showOrgPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: loading ? 1 : 1.02 }}
                      whileTap={{ scale: loading ? 1 : 0.98 }}
                      className={`w-full py-3 bg-tamu-maroon text-white rounded-lg font-semibold transition-all ${
                        loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-tamu-maroon-light'
                      }`}
                    >
                      {loading ? 'Signing in...' : 'Sign In'}
                    </motion.button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setOrgStep('search')
                        setSelectedOrg(null)
                        setOrgSearch('')
                        setOrgPassword('')
                      }}
                      className="w-full text-center text-sm text-gray-600 hover:text-tamu-maroon transition-colors"
                    >
                      Choose a different organization
                    </button>
                  </form>
                </motion.div>
              )}

              {/* Step 3: Verification email sent */}
              {orgStep === 'verification-sent' && (
                <motion.div
                  key="verification"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="text-center py-6"
                >
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Check Your Email!</h3>
                  <p className="text-gray-600 mb-4">
                    A verification email was sent to
                  </p>
                  <p className="font-mono bg-gray-100 rounded-lg px-4 py-2 text-tamu-maroon font-medium mb-4">
                    {verificationEmail}
                  </p>
                  <p className="text-sm text-gray-500 mb-6">
                    Click the link in the email to set up your organization account password.
                  </p>
                  
                  <p className="text-xs text-gray-400 mb-2">
                    Didn&apos;t receive the email? Check your spam folder or contact support.
                  </p>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setOrgStep('search')
                      setSelectedOrg(null)
                      setOrgSearch('')
                    }}
                    className="mt-4 text-sm text-tamu-maroon hover:underline"
                  >
                    ← Back to organization search
                  </button>
                </motion.div>
              )}

              {/* Step 4: Needs password setup - email verified but password not set */}
              {orgStep === 'needs-setup' && selectedOrg && (
                <motion.div
                  key="needs-setup"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="text-center py-6"
                >
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-9.364a9 9 0 11-12.728 0M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Almost There!</h3>
                  <p className="text-gray-600 mb-4">
                    Your email is verified, but you need to set up a password.
                  </p>
                  <div className="bg-tamu-maroon/5 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-600">Organization</p>
                    <p className="font-semibold text-tamu-maroon">{selectedOrg.name}</p>
                  </div>
                  
                  <motion.button
                    onClick={async () => {
                      setLoading(true)
                      setError('')
                      try {
                        // Send password reset link to their email
                        const response = await fetch('/api/org/send-setup-link', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ organizationId: selectedOrg.id })
                        })
                        const result = await response.json()
                        if (!response.ok) {
                          throw new Error(result.error || 'Failed to send setup link')
                        }
                        setVerificationEmail(result.email || verificationEmail)
                        setOrgStep('verification-sent')
                      } catch (err: any) {
                        setError(err.message || 'Failed to send setup link')
                      } finally {
                        setLoading(false)
                      }
                    }}
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className={`w-full py-3 bg-tamu-maroon text-white rounded-lg font-semibold transition-all mb-4 ${
                      loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-tamu-maroon-light'
                    }`}
                  >
                    {loading ? 'Sending...' : 'Send Setup Link'}
                  </motion.button>
                  
                  <p className="text-sm text-gray-500 mb-4">
                    We&apos;ll send a link to <span className="font-medium">{verificationEmail}</span> to set your password.
                  </p>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setOrgStep('search')
                      setSelectedOrg(null)
                      setOrgSearch('')
                    }}
                    className="text-sm text-gray-600 hover:text-tamu-maroon transition-colors"
                  >
                    ← Back to organization search
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  )
}
