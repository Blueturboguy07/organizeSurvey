'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClientComponentClient } from '@/lib/supabase'
import Link from 'next/link'

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState('Verifying your email...')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token')
      const type = searchParams.get('type')

      if (type === 'signup' && token) {
        try {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'email',
          })

          if (error) throw error

          setStatus('success')
          setMessage('Email verified successfully! Redirecting to survey...')
          
          setTimeout(() => {
            router.push('/survey')
          }, 2000)
        } catch (err: any) {
          setStatus('error')
          setMessage(err.message || 'Verification failed. The link may have expired.')
        }
      } else {
        // Check if user is already verified
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email_confirmed_at) {
          setStatus('success')
          setMessage('Your email is already verified!')
        } else {
          setStatus('error')
          setMessage('Invalid verification link.')
        }
      }
    }

    verifyEmail()
  }, [searchParams, router, supabase])

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center"
      >
        {status === 'verifying' && (
          <>
            <div className="mb-6">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-tamu-maroon mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-tamu-maroon mb-2">Verifying Email</h2>
              <p className="text-gray-600">{message}</p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-tamu-maroon mb-2">Email Verified!</h2>
              <p className="text-gray-600">{message}</p>
            </div>
            <Link
              href="/survey"
              className="inline-block px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-all"
            >
              Go to Survey
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-red-600 mb-2">Verification Failed</h2>
              <p className="text-gray-600 mb-4">{message}</p>
            </div>
            <div className="space-y-3">
              <Link
                href="/register"
                className="block px-6 py-3 bg-tamu-maroon text-white rounded-lg font-semibold hover:bg-tamu-maroon-light transition-all"
              >
                Register Again
              </Link>
              <Link
                href="/login"
                className="block text-tamu-maroon font-semibold hover:underline"
              >
                Back to Login
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

