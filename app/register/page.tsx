'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import Link from 'next/link'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const validateTAMUEmail = (email: string): boolean => {
    const tamuEmailRegex = /^[a-zA-Z0-9._%+-]+@(tamu\.edu|email\.tamu\.edu)$/i
    return tamuEmailRegex.test(email)
  }

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
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
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
        // Create user profile in users table
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            email: email.toLowerCase().trim(),
            name: name.trim(),
          })

        if (profileError && !profileError.message.includes('duplicate')) {
          console.error('Profile creation error:', profileError)
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration')
    } finally {
      setLoading(false)
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
              We've sent a verification link to <strong>{email}</strong>
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              Please click the link in the email to verify your account before signing in.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-all"
          >
            Go to Login
          </Link>
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
            <img 
              src="/logo.png" 
              alt="ORGanize TAMU Logo" 
              className="w-16 h-16 flex-shrink-0 object-contain"
            />
            <h1 className="text-3xl font-bold text-tamu-maroon">ORGanize TAMU</h1>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Create Account</h2>
          <p className="text-gray-600">Sign up with your TAMU email</p>
        </div>

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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-tamu-maroon focus:outline-none"
              placeholder="At least 8 characters"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be at least 8 characters long
            </p>
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
        </div>
      </motion.div>
    </div>
  )
}

