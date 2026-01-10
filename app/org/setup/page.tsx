'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import Image from 'next/image'

function OrgSetupContent() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [isValidSession, setIsValidSession] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()
  const token = searchParams.get('token')

  useEffect(() => {
    async function verifyAndSetupSession() {
      try {
        // For password reset links, Supabase puts tokens in the URL hash
        // Format: /org/setup#access_token=xxx&refresh_token=yyy&type=recovery
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')
        
        console.log('Setup page loaded, type:', type, 'has tokens:', !!accessToken)
        
        // If we have tokens in hash, set up the session
        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          
          if (setSessionError) {
            console.error('Set session error:', setSessionError)
            setError('Your link has expired. Please request a new one from the login page.')
            setVerifying(false)
            return
          }
          
          // Clear the hash from URL for cleaner look
          window.history.replaceState(null, '', window.location.pathname)
        }
        
        // Check if we now have a valid session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
          // No hash tokens and no existing session - try PKCE code exchange
          if (token) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(token)
            if (exchangeError) {
              console.error('Exchange error:', exchangeError)
              setError('Your link has expired. Please request a new one from the login page.')
              setVerifying(false)
              return
            }
          } else {
            setError('No valid session found. Please click the link in your email or request a new one.')
            setVerifying(false)
            return
          }
        }

        // Get the user and org info
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          setError('Could not verify your identity. Please try again.')
          setVerifying(false)
          return
        }

        // Get org name from user metadata
        if (user.user_metadata?.organization_name) {
          setOrgName(user.user_metadata.organization_name)
        }

        setIsValidSession(true)
        setVerifying(false)
      } catch (err: any) {
        console.error('Setup error:', err)
        setError(err.message || 'Failed to set up session')
        setVerifying(false)
      }
    }

    verifyAndSetupSession()
  }, [token, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) throw updateError

      // Get the session token for API authorization
      const { data: { session } } = await supabase.auth.getSession()
      
      // Complete the org setup via API (uses admin client to bypass RLS)
      const response = await fetch('/api/org/complete-setup', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Setup completion error:', result.error)
        // Don't fail completely - password is set, they might still be able to log in
      }

      setSuccess(true)
      
      // Redirect to org dashboard after a moment
      setTimeout(() => {
        router.push('/org/dashboard')
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Failed to set password')
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying your link...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Account Created!</h2>
          <p className="text-gray-600">Redirecting you to your organization dashboard...</p>
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
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Set Up Your Account</h2>
          {orgName && (
            <p className="text-gray-600">
              for <span className="font-semibold text-tamu-maroon">{orgName}</span>
            </p>
          )}
        </div>

        {error && !isValidSession ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-800 mb-4">{error}</p>
            <a href="/login" className="text-tamu-maroon hover:underline">
              Return to login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
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
              <label htmlFor="password" className="block text-gray-700 font-medium mb-2">
                Create Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full p-3 pr-10 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
              <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-gray-700 font-medium mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full p-3 pr-10 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
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
              {loading ? 'Setting up...' : 'Complete Setup'}
            </motion.button>
          </form>
        )}
      </motion.div>
    </div>
  )
}

// Loading fallback for Suspense
function OrgSetupLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

// Main export wrapped in Suspense for useSearchParams
export default function OrgSetupPage() {
  return (
    <Suspense fallback={<OrgSetupLoading />}>
      <OrgSetupContent />
    </Suspense>
  )
}
