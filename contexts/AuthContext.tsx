'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session, RealtimeChannel } from '@supabase/supabase-js'
import { createClientComponentClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface UserQueryData {
  latest_cleansed_query: string | null
  user_demographics: Record<string, unknown> | null
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userQuery, setUserQuery] = useState<UserQueryData | null>(null)
  const [userQueryLoading, setUserQueryLoading] = useState(false)
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

  // Manual refresh function
  const refreshUserQuery = useCallback(async () => {
    if (user) {
      await fetchUserQuery(user.id)
    }
  }, [user, fetchUserQuery])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Fetch user query if logged in
      if (session?.user) {
        fetchUserQuery(session.user.id)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Fetch/clear user query based on auth state
      if (session?.user) {
        fetchUserQuery(session.user.id)
      } else {
        setUserQuery(null)
      }
      
      // Redirect to login if signed out
      if (!session && window.location.pathname.startsWith('/survey')) {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase.auth, fetchUserQuery])

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

  const signOut = async () => {
    await supabase.auth.signOut()
    setUserQuery(null)
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
      refreshUserQuery
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

