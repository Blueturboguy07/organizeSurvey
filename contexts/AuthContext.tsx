'use client'

/**
 * AuthContext - Central authentication and user data provider with real-time subscriptions
 * 
 * IMPORTANT: Always use this context for authentication state and session tokens.
 * The context maintains real-time subscriptions to:
 * - Auth state changes (login/logout)
 * - user_queries table (survey interests)
 * - user_profiles table (profile data, picture, preferences)
 * - user_joined_organizations table (joined orgs for recommendations)
 * - saved_organizations table (saved orgs for notifications)
 * 
 * Usage in components:
 * ```
 * const { user, session, userProfile, userQuery, joinedOrgIds, savedOrgIds } = useAuth()
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
  // Shared supabase client - use this in pages to avoid multiple instances
  supabase: ReturnType<typeof createClientComponentClient>
  // User query real-time data
  userQuery: UserQueryData | null
  userQueryLoading: boolean
  refreshUserQuery: () => Promise<void>
  // User profile real-time data
  userProfile: UserProfileData | null
  userProfileLoading: boolean
  refreshUserProfile: () => Promise<void>
  // Joined organizations real-time data
  joinedOrgIds: Set<string>
  joinedOrgIdsLoading: boolean
  refreshJoinedOrgs: () => Promise<void>
  // Saved organizations real-time data
  savedOrgIds: Set<string>
  savedOrgNames: Set<string>
  savedOrgIdsLoading: boolean
  refreshSavedOrgs: () => Promise<void>
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
  const [joinedOrgIds, setJoinedOrgIds] = useState<Set<string>>(new Set())
  const [joinedOrgIdsLoading, setJoinedOrgIdsLoading] = useState(false)
  const [savedOrgIds, setSavedOrgIds] = useState<Set<string>>(new Set())
  const [savedOrgNames, setSavedOrgNames] = useState<Set<string>>(new Set())
  const [savedOrgIdsLoading, setSavedOrgIdsLoading] = useState(false)
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

      // Handle errors gracefully - table might not exist yet or no profile exists
      if (error) {
        // PGRST116 = no rows returned (profile doesn't exist yet)
        // 42P01 = relation does not exist (table doesn't exist)
        if (error.code !== 'PGRST116' && error.code !== '42P01' && !error.message?.includes('does not exist')) {
          console.error('Error fetching user profile:', error)
        }
      }
      
      setUserProfile(data || null)
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
      setUserProfile(null)
    } finally {
      setUserProfileLoading(false)
    }
  }, [supabase])

  // Fetch joined organizations
  const fetchJoinedOrgs = useCallback(async (userId: string) => {
    console.log('🔴 AuthContext fetchJoinedOrgs: Starting for user', userId)
    setJoinedOrgIdsLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_joined_organizations')
        .select('organization_id')
        .eq('user_id', userId)

      console.log('🔴 AuthContext fetchJoinedOrgs: Raw response:', JSON.stringify(data), 'Error:', error?.message)

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching joined organizations:', error)
      }
      
      const orgIds = new Set((data || []).map((jo: { organization_id: string }) => jo.organization_id))
      setJoinedOrgIds(orgIds)
      console.log('🔴 AuthContext: Updated joinedOrgIds, count:', orgIds.size, 'IDs:', Array.from(orgIds))
    } catch (err) {
      console.error('Failed to fetch joined organizations:', err)
      setJoinedOrgIds(new Set())
    } finally {
      setJoinedOrgIdsLoading(false)
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

  const refreshJoinedOrgs = useCallback(async () => {
    if (user) {
      await fetchJoinedOrgs(user.id)
    }
  }, [user, fetchJoinedOrgs])

  // Fetch saved organizations
  const fetchSavedOrgs = useCallback(async (userId: string) => {
    setSavedOrgIdsLoading(true)
    try {
      const { data, error } = await supabase
        .from('saved_organizations')
        .select('organization_id, organization_name')
        .eq('user_id', userId)

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching saved organizations:', error)
      }
      
      const orgIds = new Set<string>()
      const orgNames = new Set<string>()
      
      ;(data || []).forEach((so: { organization_id: string | null, organization_name: string }) => {
        if (so.organization_id) {
          orgIds.add(so.organization_id)
        }
        if (so.organization_name) {
          orgNames.add(so.organization_name.toLowerCase().trim())
        }
      })
      
      setSavedOrgIds(orgIds)
      setSavedOrgNames(orgNames)
      console.log('🟢 AuthContext: Updated savedOrgIds, count:', orgIds.size)
    } catch (err) {
      console.error('Failed to fetch saved organizations:', err)
      setSavedOrgIds(new Set())
      setSavedOrgNames(new Set())
    } finally {
      setSavedOrgIdsLoading(false)
    }
  }, [supabase])

  const refreshSavedOrgs = useCallback(async () => {
    if (user) {
      await fetchSavedOrgs(user.id)
    }
  }, [user, fetchSavedOrgs])

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
        fetchJoinedOrgs(session.user.id)
        fetchSavedOrgs(session.user.id)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔵 AuthContext: Auth state changed, event:', _event, 'user:', session?.user?.id, session?.user?.email)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Fetch/clear user data based on auth state
      if (session?.user) {
        console.log('🔵 AuthContext: User logged in:', session.user.id, session.user.email)
        fetchUserQuery(session.user.id)
        fetchUserProfile(session.user.id)
        fetchJoinedOrgs(session.user.id)
        fetchSavedOrgs(session.user.id)
      } else {
        setUserQuery(null)
        setUserProfile(null)
        setJoinedOrgIds(new Set())
        setSavedOrgIds(new Set())
        setSavedOrgNames(new Set())
      }
      
      // Redirect to login if signed out
      if (!session && window.location.pathname.startsWith('/survey')) {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase.auth, fetchUserQuery, fetchUserProfile, fetchJoinedOrgs, fetchSavedOrgs])

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
      try {
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
            if (status === 'SUBSCRIBED') {
              console.log('user_profiles subscription active')
            } else if (status === 'CHANNEL_ERROR') {
              // Table might not exist yet - this is okay, subscription will work once table is created
              console.warn('user_profiles subscription error (table may not exist yet):', status)
            } else {
              console.log('user_profiles subscription status:', status)
            }
          })
      } catch (err) {
        // Table might not exist yet - fail silently
        console.warn('Failed to set up user_profiles realtime subscription (table may not exist):', err)
      }
    }

    setupSubscription()

    // Cleanup subscription on unmount or user change
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user, supabase])

  // Real-time subscription for user_joined_organizations
  useEffect(() => {
    if (!user) return

    let channel: RealtimeChannel | null = null

    const setupSubscription = () => {
      channel = supabase
        .channel(`user_joined_orgs_realtime_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'user_joined_organizations',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔴 Real-time user_joined_organizations update:', payload)
            console.log('🔴 Event type:', payload.eventType)
            console.log('🔴 New data:', payload.new)
            console.log('🔴 Old data:', payload.old)
            
            // Refetch joined orgs when changes occur
            console.log('🔴 Calling fetchJoinedOrgs...')
            fetchJoinedOrgs(user.id).then(() => {
              console.log('🔴 fetchJoinedOrgs completed')
            }).catch((err) => {
              console.error('🔴 Error in fetchJoinedOrgs:', err)
            })
          }
        )
        .subscribe((status) => {
          console.log('🔴 user_joined_organizations subscription status:', status)
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to user_joined_organizations real-time')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Failed to subscribe to user_joined_organizations real-time')
          }
        })
    }

    setupSubscription()

    // Cleanup subscription on unmount or user change
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user, supabase, fetchJoinedOrgs])

  // Real-time subscription for saved_organizations
  useEffect(() => {
    if (!user) return

    let channel: RealtimeChannel | null = null

    const setupSubscription = () => {
      channel = supabase
        .channel(`saved_orgs_realtime_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'saved_organizations',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🟢 Real-time saved_organizations update:', payload)
            console.log('🟢 Event type:', payload.eventType)
            console.log('🟢 New data:', payload.new)
            console.log('🟢 Old data:', payload.old)
            
            // Refetch saved orgs when changes occur
            console.log('🟢 Calling fetchSavedOrgs...')
            fetchSavedOrgs(user.id).then(() => {
              console.log('🟢 fetchSavedOrgs completed')
            }).catch((err) => {
              console.error('🟢 Error in fetchSavedOrgs:', err)
            })
          }
        )
        .subscribe((status) => {
          console.log('🟢 saved_organizations subscription status:', status)
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to saved_organizations real-time')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Failed to subscribe to saved_organizations real-time')
          }
        })
    }

    setupSubscription()

    // Cleanup subscription on unmount or user change
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user, supabase, fetchSavedOrgs])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUserQuery(null)
    setUserProfile(null)
    setJoinedOrgIds(new Set())
    setSavedOrgIds(new Set())
    setSavedOrgNames(new Set())
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signOut,
      supabase,
      userQuery,
      userQueryLoading,
      refreshUserQuery,
      userProfile,
      userProfileLoading,
      refreshUserProfile,
      joinedOrgIds,
      joinedOrgIdsLoading,
      refreshJoinedOrgs,
      savedOrgIds,
      savedOrgNames,
      savedOrgIdsLoading,
      refreshSavedOrgs
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

