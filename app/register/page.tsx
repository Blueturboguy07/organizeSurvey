'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import Image from 'next/image'

interface InviteDetails {
  organizationName: string
  email: string
  name?: string
}

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()
  // Use AuthContext for real-time auth state (redirect if already logged in)
  const { user, loading: authLoading } = useAuth()

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  // Check for pending invitations when email changes (debounced)
  useEffect(() => {
    if (!email || !validateTAMUEmail(email)) {
      setInviteDetails(null)
      return
    }

    const timeoutId = setTimeout(() => {
      checkForInvitations(email)
    }, 500) // Debounce 500ms

    return () => clearTimeout(timeoutId)
  }, [email])

  // Check if user has any pending invitations by email
  const checkForInvitations = async (userEmail: string) => {
    setLoadingInvite(true)
    try {
      const response = await fetch(`/api/org/invite/check?email=${encodeURIComponent(userEmail.toLowerCase().trim())}`)
      if (response.ok) {
        const data = await response.json()
        if (data.invitations && data.invitations.length > 0) {
          // Show the first invitation (or could show all)
          const firstInvite = data.invitations[0]
          setInviteDetails({
            organizationName: firstInvite.organizationName,
            email: userEmail,
            name: firstInvite.name,
          })
          // Pre-fill name if provided in invite
          if (firstInvite.name && !name) {
            setName(firstInvite.name)
          }
        } else {
          setInviteDetails(null)
        }
      }
    } catch (err) {
      console.error('Error checking for invitations:', err)
    } finally {
      setLoadingInvite(false)
    }
  }

  const validateTAMUEmail = (email: string): boolean => {
    const tamuEmailRegex = /^[a-zA-Z0-9._%+-]+@(tamu\.edu|email\.tamu\.edu)$/i
    return tamuEmailRegex.test(email)
  }

  // Password requirements
  const passwordRequirements = [
    { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { id: 'uppercase', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { id: 'lowercase', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { id: 'number', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
    { id: 'symbol', label: 'One special character (!@#$%^&*)', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
  ]

  const isPasswordValid = passwordRequirements.every(req => req.test(password))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validate TAMU email
    if (!validateTAMUEmail(email)) {
      setError('Please use a valid Texas A&M University email address (@tamu.edu or @email.tamu.edu)')
      setLoading(false)
      return
    }

    // Validate password strength
    if (!isPasswordValid) {
      setError('Password does not meet all requirements')
      setLoading(false)
      return
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      // Sign up user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            name: name.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) throw signUpError

      if (data.user) {
        setSuccess(true)
        // Create user profile via server-side API (bypasses RLS)
        try {
          const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: data.user.id,
              email: email.toLowerCase().trim(),
              name: name.trim(),
            })
          })
          
          if (!res.ok) {
            const errData = await res.json()
            console.error('Profile creation error:', errData.error)
          }
        } catch (profileErr) {
          console.error('Profile creation request failed:', profileErr)
        }
        
        // Note: Auto-joining invited organizations happens in the auth callback
        // based on email matching, no token needed
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration')
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tamu-maroon"></div>
      </div>
    )
  }

  const handleResendVerification = async () => {
    setResending(true)
    setResendMessage('')
    
    try {
      const response = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'user' })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        setResendMessage(result.error || 'Failed to resend verification email')
      } else {
        setResendMessage('Verification email sent! Check your inbox.')
      }
    } catch (err: any) {
      setResendMessage('Failed to resend verification email. Please try again.')
    } finally {
      setResending(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center"
        >
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-tamu-maroon mb-2">Check Your Email</h2>
            <p className="text-gray-600">
              We&apos;ve sent a verification link to <strong>{email}</strong>
            </p>
          </div>
          
          {inviteDetails && (
            <div className="bg-tamu-maroon/5 border border-tamu-maroon/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-tamu-maroon font-medium">
                You&apos;ve been invited to join <strong>{inviteDetails.organizationName}</strong>
              </p>
              <p className="text-xs text-gray-600 mt-1">
                You&apos;ll be automatically added once you verify your email.
              </p>
            </div>
          )}
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              Please click the link in the email to verify your account before signing in.
            </p>
          </div>
          
          {resendMessage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`mb-4 p-3 rounded-lg text-sm ${
                resendMessage.includes('sent') 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {resendMessage}
            </motion.div>
          )}
          
          <div className="space-y-3">
            <Link
              href="/login"
              className="inline-block w-full px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-all"
            >
              Go to Login
            </Link>
            
            <button
              onClick={handleResendVerification}
              disabled={resending}
              className={`w-full px-4 py-2 text-sm text-tamu-maroon hover:underline transition-all ${
                resending ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {resending ? 'Sending...' : "Didn't receive the email? Resend verification"}
            </button>
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
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Create Account</h2>
          <p className="text-gray-600">Sign up with your TAMU email</p>
        </div>

        {/* Invite Banner */}
        {loadingInvite ? (
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
          </div>
        ) : inviteDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-tamu-maroon/5 border border-tamu-maroon/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 justify-center mb-2">
              <svg className="w-5 h-5 text-tamu-maroon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-semibold text-tamu-maroon">You&apos;ve been invited!</span>
            </div>
            <p className="text-sm text-gray-700 text-center">
              <strong>{inviteDetails.organizationName}</strong> has invited you to join their organization.
            </p>
            <p className="text-xs text-gray-500 text-center mt-1">
              Complete your registration to automatically join.
            </p>
          </motion.div>
        )}

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
            <label htmlFor="name" className="block text-gray-700 font-medium mb-2">
              Full Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
              TAMU Email *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
              placeholder="john.doe@tamu.edu"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be a @tamu.edu or @email.tamu.edu address
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-gray-700 font-medium mb-2">
              Password *
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
            
            {/* Password Requirements Checklist */}
            <div className="mt-3 space-y-1.5">
              {passwordRequirements.map((req) => {
                const isMet = req.test(password)
                return (
                  <div
                    key={req.id}
                    className={`flex items-center gap-2 text-xs transition-all duration-200 ${
                      password.length === 0 
                        ? 'text-gray-400' 
                        : isMet 
                          ? 'text-green-600' 
                          : 'text-gray-500'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
                      password.length === 0
                        ? 'border border-gray-300'
                        : isMet
                          ? 'bg-green-500'
                          : 'border border-gray-300'
                    }`}>
                      {password.length > 0 && isMet && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span>{req.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-gray-700 font-medium mb-2">
              Confirm Password *
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
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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
            disabled={loading || !isPasswordValid}
            whileHover={{ scale: loading || !isPasswordValid ? 1 : 1.02 }}
            whileTap={{ scale: loading || !isPasswordValid ? 1 : 0.98 }}
            className={`w-full py-3 bg-tamu-maroon text-white rounded-lg font-semibold transition-all ${
              loading || !isPasswordValid ? 'opacity-50 cursor-not-allowed' : 'hover:bg-tamu-maroon-light'
            }`}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </motion.button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-tamu-maroon font-semibold hover:underline">
              Sign in
            </Link>
          </p>
          
          {/* Support Contact */}
          <p className="text-center text-xs text-gray-400 mt-4">
            Having trouble?{' '}
            <a 
              href="mailto:mannbellani1@tamu.edu" 
              className="text-tamu-maroon hover:underline"
            >
              Contact support
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

