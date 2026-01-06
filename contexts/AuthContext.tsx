'use client'

/**
 * AuthContext - Central authentication and user data provider with real-time subscriptions
 * 
 * IMPORTANT: Always use this context for authentication state and session tokens.
 * The context maintains real-time subscriptions to:
 * - Auth state changes (login/logout)
 * - user_queries table (survey interests)
 * - user_profiles table (profile data, picture, preferences)
 * 
 * Usage in components:
 * ```
 * const { user, session, userProfile, userQuery } = useAuth()
 * 
 * // For API calls requiring auth, use session.access_token:
 * if (session?.access_token) {
 *   fetch('/api/endpoint', {
 *     headers: { 'Authorization': `Bearer ${session.access_token}` }
 *   })
 * }
 * ```
 * 
 * DO NOT call supabase.auth.getSession() directly in components.
 * Instead, use the session from this context for consistency and real-time updates.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session, RealtimeChannel } from '@supabase/supabase-js'
import { createClientComponentClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface UserQueryData {
  latest_cleansed_query: string | null
  user_demographics: Record<string, unknown> | null
}

interface UserProfileData {
  name: string | null
  profile_picture_url: string | null
  email_preferences: {
    marketing: boolean
    updates: boolean
    recommendations: boolean
  } | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  // User query real-time data
  userQuery: UserQueryData | null
  userQueryLoading: boolean
  refreshUserQuery: () => Promise<void>
  // User profile real-time data
  userProfile: UserProfileData | null
  userProfileLoading: boolean
  refreshUserProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userQuery, setUserQuery] = useState<UserQueryData | null>(null)
  const [userQueryLoading, setUserQueryLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null)
  const [userProfileLoading, setUserProfileLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Fetch user query data
  const fetchUserQuery = useCallback(async (userId: string) => {
    setUserQueryLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_queries')
        .select('latest_cleansed_query, user_demographics')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user query:', error)
      }
      
      setUserQuery(data || null)
    } catch (err) {
      console.error('Failed to fetch user query:', err)
      setUserQuery(null)
    } finally {
      setUserQueryLoading(false)
    }
  }, [supabase])

  // Fetch user profile data
  const fetchUserProfile = useCallback(async (userId: string) => {
    setUserProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('name, profile_picture_url, email_preferences')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error)
      }
      
      setUserProfile(data || null)
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
      setUserProfile(null)
    } finally {
      setUserProfileLoading(false)
    }
  }, [supabase])

  // Manual refresh functions
  const refreshUserQuery = useCallback(async () => {
    if (user) {
      await fetchUserQuery(user.id)
    }
  }, [user, fetchUserQuery])

  const refreshUserProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user.id)
    }
  }, [user, fetchUserProfile])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Fetch user data if logged in
      if (session?.user) {
        fetchUserQuery(session.user.id)
        fetchUserProfile(session.user.id)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Fetch/clear user data based on auth state
      if (session?.user) {
        fetchUserQuery(session.user.id)
        fetchUserProfile(session.user.id)
      } else {
        setUserQuery(null)
        setUserProfile(null)
      }
      
      // Redirect to login if signed out
      if (!session && window.location.pathname.startsWith('/survey')) {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase.auth, fetchUserQuery, fetchUserProfile])

  // Real-time subscription for user_queries
  useEffect(() => {
    if (!user) return

    let channel: RealtimeChannel | null = null

    const setupSubscription = () => {
      channel = supabase
        .channel(`user_queries_realtime_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'user_queries',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Real-time user_queries update:', payload)
            
            if (payload.eventType === 'DELETE') {
              setUserQuery(null)
            } else if (payload.new) {
              setUserQuery({
                latest_cleansed_query: (payload.new as UserQueryData).latest_cleansed_query,
                user_demographics: (payload.new as UserQueryData).user_demographics
              })
            }
          }
        )
        .subscribe((status) => {
          console.log('user_queries subscription status:', status)
        })
    }

    setupSubscription()

    // Cleanup subscription on unmount or user change
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user, supabase])

  // Real-time subscription for user_profiles (includes profile picture)
  useEffect(() => {
    if (!user) return

    let channel: RealtimeChannel | null = null

    const setupSubscription = () => {
      channel = supabase
        .channel(`user_profiles_realtime_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'user_profiles',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            console.log('Real-time user_profiles update:', payload)
            
            if (payload.eventType === 'DELETE') {
              setUserProfile(null)
            } else if (payload.new) {
              const newData = payload.new as Record<string, unknown>
              setUserProfile({
                name: (newData.name as string) || null,
                profile_picture_url: (newData.profile_picture_url as string) || null,
                email_preferences: (newData.email_preferences as UserProfileData['email_preferences']) || null
              })
            }
          }
        )
        .subscribe((status) => {
          console.log('user_profiles subscription status:', status)
        })
    }

    setupSubscription()

    // Cleanup subscription on unmount or user change
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user, supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUserQuery(null)
    setUserProfile(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signOut,
      userQuery,
      userQueryLoading,
      refreshUserQuery,
      userProfile,
      userProfileLoading,
      refreshUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

