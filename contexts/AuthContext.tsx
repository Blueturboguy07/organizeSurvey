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
 * 
 * Usage in components:
 * ```
 * const { user, session, userProfile, userQuery, joinedOrgIds } = useAuth()
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
  // Joined organizations real-time data
  joinedOrgIds: Set<string>
  joinedOrgIdsLoading: boolean
  refreshJoinedOrgs: () => Promise<void>
  // Saved organizations real-time data
  savedOrgIds: Set<string>
  savedOrgIdsLoading: boolean
  refreshSavedOrgs: () => Promise<void>
  // Applied organizations data
  appliedOrgIds: Set<string>
  appliedOrgIdsLoading: boolean
  refreshAppliedOrgs: () => Promise<void>
  // Actions
  joinOrg: (organizationId: string, applicationData?: { name: string; email: string; whyJoin: string; customResponses?: Record<string, string | string[]> }) => Promise<{ success: boolean; error?: string; applied?: boolean }>
  leaveOrg: (organizationId: string) => Promise<{ success: boolean; error?: string }>
  saveOrg: (organizationId: string) => Promise<{ success: boolean; error?: string }>
  unsaveOrg: (organizationId: string) => Promise<{ success: boolean; error?: string }>
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
  const [savedOrgIdsLoading, setSavedOrgIdsLoading] = useState(false)
  const [appliedOrgIds, setAppliedOrgIds] = useState<Set<string>>(new Set())
  const [appliedOrgIdsLoading, setAppliedOrgIdsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Fetch user query data
  const fetchUserQuery = useCallback(async (userId: string) => {
    console.log('🔍 [AuthContext] fetchUserQuery called for userId:', userId)
    setUserQueryLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_queries')
        .select('latest_cleansed_query, user_demographics')
        .eq('user_id', userId)
        .single()

      console.log('🔍 [AuthContext] fetchUserQuery response:', {
        hasData: !!data,
        queryPreview: data?.latest_cleansed_query?.substring(0, 100) + '...',
        queryLength: data?.latest_cleansed_query?.length,
        error: error?.message || null,
        errorCode: error?.code || null
      })

      if (error && error.code !== 'PGRST116') {
        console.error('❌ [AuthContext] Error fetching user query:', error)
      }
      
      setUserQuery(data || null)
      console.log('✅ [AuthContext] setUserQuery called with:', data ? 'data' : 'null')
    } catch (err) {
      console.error('❌ [AuthContext] Failed to fetch user query:', err)
      setUserQuery(null)
    } finally {
      setUserQueryLoading(false)
      console.log('🔍 [AuthContext] fetchUserQuery completed, loading set to false')
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
    setJoinedOrgIdsLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_joined_organizations')
        .select('organization_id')
        .eq('user_id', userId)

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching joined organizations:', error)
      }
      
      const orgIds = new Set((data || []).map((jo: { organization_id: string }) => jo.organization_id))
      setJoinedOrgIds(orgIds)
    } catch (err) {
      console.error('Failed to fetch joined organizations:', err)
      setJoinedOrgIds(new Set())
    } finally {
      setJoinedOrgIdsLoading(false)
    }
  }, [supabase])

  // Fetch saved organizations
  const fetchSavedOrgs = useCallback(async (userId: string) => {
    setSavedOrgIdsLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_saved_organizations')
        .select('organization_id')
        .eq('user_id', userId)

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        console.error('Error fetching saved organizations:', error)
      }
      
      const orgIds = new Set((data || []).map((so: { organization_id: string }) => so.organization_id))
      setSavedOrgIds(orgIds)
    } catch (err) {
      console.error('Failed to fetch saved organizations:', err)
      setSavedOrgIds(new Set())
    } finally {
      setSavedOrgIdsLoading(false)
    }
  }, [supabase])

  // Fetch applied organizations
  const fetchAppliedOrgs = useCallback(async (userId: string) => {
    console.log('📋 [AuthContext] fetchAppliedOrgs called for userId:', userId)
    setAppliedOrgIdsLoading(true)
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('organization_id')
        .eq('user_id', userId)

      console.log('📋 [AuthContext] fetchAppliedOrgs response:', { data, error, dataLength: data?.length })

      if (error) {
        console.error('📋 [AuthContext] Error fetching applied organizations:', error)
        // Don't fail silently for RLS errors
        if (error.code !== 'PGRST116' && error.code !== '42P01') {
          console.error('Error fetching applied organizations:', error)
        }
      }
      
      const orgIds = new Set((data || []).map((app: { organization_id: string }) => app.organization_id))
      console.log('📋 [AuthContext] Applied org IDs:', Array.from(orgIds))
      setAppliedOrgIds(orgIds)
    } catch (err) {
      console.error('📋 [AuthContext] Failed to fetch applied organizations:', err)
      setAppliedOrgIds(new Set())
    } finally {
      setAppliedOrgIdsLoading(false)
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

  const refreshSavedOrgs = useCallback(async () => {
    if (user) {
      await fetchSavedOrgs(user.id)
    }
  }, [user, fetchSavedOrgs])

  const refreshAppliedOrgs = useCallback(async () => {
    if (user) {
      await fetchAppliedOrgs(user.id)
    }
  }, [user, fetchAppliedOrgs])

  // Action: Join an organization (or apply if application-based)
  const joinOrg = useCallback(async (organizationId: string, applicationData?: { name: string; email: string; whyJoin: string; customResponses?: Record<string, string | string[]> }): Promise<{ success: boolean; error?: string; applied?: boolean }> => {
    if (!user) return { success: false, error: 'Not authenticated' }
    
    try {
      // Check if the organization has an active, verified account (meaning they're on platform)
      const { data: orgAccount, error: orgAccountError } = await supabase
        .from('org_accounts')
        .select('id, email_verified, is_active')
        .eq('organization_id', organizationId)
        .single()

      // If no org_account exists or it's not verified/active, org is not on platform
      const isOnPlatform = orgAccount && orgAccount.email_verified && orgAccount.is_active

      if (!isOnPlatform) {
        return { success: false, error: 'This organization is not on the platform yet. You can save it for later instead.' }
      }

      // Check if the organization is application-based
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('is_application_based')
        .eq('id', organizationId)
        .single()

      if (orgError) {
        console.error('Error fetching organization:', orgError)
        return { success: false, error: 'Failed to check organization settings' }
      }

      // If application-based, create an application instead of joining directly
      if (orgData?.is_application_based) {
        // Require application data for application-based orgs
        if (!applicationData) {
          return { success: false, error: 'Application data required for this organization' }
        }

        // Check if already applied
        const { data: existingApp } = await supabase
          .from('applications')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .single()

        if (existingApp) {
          return { success: false, error: 'You have already applied to this organization' }
        }

        // Create application with form data including responses as JSON
        const { error: appError } = await supabase
          .from('applications')
          .insert({
            user_id: user.id,
            organization_id: organizationId,
            applicant_name: applicationData.name,
            applicant_email: applicationData.email,
            why_join: applicationData.whyJoin,
            status: 'waiting',
            responses: applicationData.customResponses || {}
          })

        if (appError) {
          if (appError.code === '23505') {
            return { success: false, error: 'You have already applied to this organization' }
          }
          console.error('Error creating application:', appError)
          return { success: false, error: appError.message }
        }

        // Update local state
        setAppliedOrgIds(prev => new Set([...prev, organizationId]))
        
        return { success: true, applied: true }
      }

      // Direct join (not application-based)
      const { error } = await supabase
        .from('user_joined_organizations')
        .insert({
          user_id: user.id,
          organization_id: organizationId
        })

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Already joined this organization' }
        }
        console.error('Error joining organization:', error)
        return { success: false, error: error.message }
      }

      // Optimistically update local state
      setJoinedOrgIds(prev => new Set([...prev, organizationId]))
      
      // Remove from saved if it was saved
      if (savedOrgIds.has(organizationId)) {
        await unsaveOrg(organizationId)
      }

      return { success: true }
    } catch (err: any) {
      console.error('Failed to join organization:', err)
      return { success: false, error: err.message || 'Unknown error' }
    }
  }, [user, supabase, savedOrgIds])

  // Action: Leave an organization
  const leaveOrg = useCallback(async (organizationId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' }
    
    try {
      const { error } = await supabase
        .from('user_joined_organizations')
        .delete()
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)

      if (error) {
        console.error('Error leaving organization:', error)
        return { success: false, error: error.message }
      }

      // Optimistically update local state
      setJoinedOrgIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(organizationId)
        return newSet
      })

      return { success: true }
    } catch (err: any) {
      console.error('Failed to leave organization:', err)
      return { success: false, error: err.message || 'Unknown error' }
    }
  }, [user, supabase])

  // Action: Save an organization (for orgs not on platform yet)
  const saveOrg = useCallback(async (organizationId: string, notifyOrg: boolean = false): Promise<{ success: boolean; error?: string; notified?: boolean }> => {
    if (!user) return { success: false, error: 'Not authenticated' }
    
    try {
      const { error } = await supabase
        .from('user_saved_organizations')
        .insert({
          user_id: user.id,
          organization_id: organizationId
        })

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Already saved this organization' }
        }
        console.error('Error saving organization:', error)
        return { success: false, error: error.message }
      }

      // Optimistically update local state
      setSavedOrgIds(prev => new Set([...prev, organizationId]))

      // If notifyOrg is true, record interest and potentially notify the org
      let notified = false
      if (notifyOrg) {
        try {
          const response = await fetch('/api/org/interest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizationId, userId: user.id })
          })
          const data = await response.json()
          notified = data.notified || false
        } catch (err) {
          console.error('Failed to record interest:', err)
          // Don't fail the save if interest recording fails
        }
      }

      return { success: true, notified }
    } catch (err: any) {
      console.error('Failed to save organization:', err)
      return { success: false, error: err.message || 'Unknown error' }
    }
  }, [user, supabase])

  // Action: Unsave an organization
  const unsaveOrg = useCallback(async (organizationId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' }
    
    try {
      const { error } = await supabase
        .from('user_saved_organizations')
        .delete()
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)

      if (error) {
        console.error('Error unsaving organization:', error)
        return { success: false, error: error.message }
      }

      // Optimistically update local state
      setSavedOrgIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(organizationId)
        return newSet
      })

      return { success: true }
    } catch (err: any) {
      console.error('Failed to unsave organization:', err)
      return { success: false, error: err.message || 'Unknown error' }
    }
  }, [user, supabase])

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
        fetchAppliedOrgs(session.user.id)
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
        fetchJoinedOrgs(session.user.id)
        fetchSavedOrgs(session.user.id)
        fetchAppliedOrgs(session.user.id)
      } else {
        setUserQuery(null)
        setUserProfile(null)
        setJoinedOrgIds(new Set())
        setSavedOrgIds(new Set())
        setAppliedOrgIds(new Set())
      }
      
      // Redirect to login if signed out
      if (!session && window.location.pathname.startsWith('/survey')) {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase.auth, fetchUserQuery, fetchUserProfile, fetchJoinedOrgs, fetchSavedOrgs, fetchAppliedOrgs])

  // Real-time subscription for user_queries
  useEffect(() => {
    if (!user) {
      console.log('📡 [AuthContext] Skipping user_queries subscription - no user')
      return
    }

    console.log('📡 [AuthContext] Setting up user_queries real-time subscription for user:', user.id)
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
            console.log('📡 [AuthContext] ⚡ REAL-TIME EVENT RECEIVED ⚡')
            console.log('📡 [AuthContext] Event type:', payload.eventType)
            console.log('📡 [AuthContext] Old data:', payload.old)
            console.log('📡 [AuthContext] New data:', payload.new)
            console.log('📡 [AuthContext] New query preview:', 
              (payload.new as any)?.latest_cleansed_query?.substring(0, 100) + '...'
            )
            
            if (payload.eventType === 'DELETE') {
              console.log('📡 [AuthContext] DELETE event - setting userQuery to null')
              setUserQuery(null)
            } else if (payload.new && typeof payload.new === 'object') {
              const newData = payload.new as Record<string, unknown>
              const newQuery = {
                latest_cleansed_query: (newData.latest_cleansed_query as string) || null,
                user_demographics: (newData.user_demographics as Record<string, unknown>) || null
              }
              console.log('📡 [AuthContext] Setting new userQuery from real-time:', {
                queryLength: newQuery.latest_cleansed_query?.length,
                queryPreview: newQuery.latest_cleansed_query?.substring(0, 100) + '...'
              })
              // Force a new object reference to trigger React updates
              setUserQuery(newQuery)
            } else {
              console.log('📡 [AuthContext] ⚠️ Unexpected payload structure:', payload)
            }
          }
        )
        .subscribe((status, err) => {
          console.log('📡 [AuthContext] user_queries subscription status:', status)
          if (err) {
            console.error('📡 [AuthContext] Subscription error:', err)
          }
          if (status === 'SUBSCRIBED') {
            console.log('📡 [AuthContext] ✅ Successfully subscribed to user_queries real-time')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('📡 [AuthContext] ❌ Channel error - real-time may not work')
          } else if (status === 'TIMED_OUT') {
            console.error('📡 [AuthContext] ❌ Subscription timed out')
          }
        })
    }

    setupSubscription()

    // Cleanup subscription on unmount or user change
    return () => {
      console.log('📡 [AuthContext] Cleaning up user_queries subscription')
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
            console.log('Real-time user_joined_organizations update:', payload)
            
            // Refetch joined orgs when changes occur
            fetchJoinedOrgs(user.id)
          }
        )
        .subscribe((status) => {
          console.log('user_joined_organizations subscription status:', status)
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

  // Real-time subscription for user_saved_organizations
  useEffect(() => {
    if (!user) return

    let channel: RealtimeChannel | null = null

    const setupSubscription = () => {
      try {
        channel = supabase
          .channel(`user_saved_orgs_realtime_${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'user_saved_organizations',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              console.log('Real-time user_saved_organizations update:', payload)
              
              // Refetch saved orgs when changes occur
              fetchSavedOrgs(user.id)
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('user_saved_organizations subscription active')
            } else if (status === 'CHANNEL_ERROR') {
              console.warn('user_saved_organizations subscription error (table may not exist yet)')
            } else {
              console.log('user_saved_organizations subscription status:', status)
            }
          })
      } catch (err) {
        console.warn('Failed to set up user_saved_organizations realtime subscription:', err)
      }
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
      refreshUserProfile,
      joinedOrgIds,
      joinedOrgIdsLoading,
      refreshJoinedOrgs,
      savedOrgIds,
      savedOrgIdsLoading,
      refreshSavedOrgs,
      appliedOrgIds,
      appliedOrgIdsLoading,
      refreshAppliedOrgs,
      joinOrg,
      leaveOrg,
      saveOrg,
      unsaveOrg
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

