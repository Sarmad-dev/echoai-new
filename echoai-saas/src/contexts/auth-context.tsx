'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/supabase'
import { UserRole } from '@/types/database'

interface UserProfile {
  id: string
  email: string
  role: UserRole
  plan: string
  apiKey: string
  createdAt: string
  updatedAt: string
}

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  session: Session | null
  loading: boolean
  error: string | null
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  // Role checking helper functions
  isStaff: () => boolean
  isAdmin: () => boolean
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
  refreshUserProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Function to fetch user profile from database
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('User')
        .select('id, email, role, plan, apiKey, createdAt, updatedAt')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data as UserProfile
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
      return null
    }
  }

  // Function to refresh user profile
  const refreshUserProfile = async () => {
    if (!user) {
      setUserProfile(null)
      return
    }

    const profile = await fetchUserProfile(user.id)
    setUserProfile(profile)
  }

  useEffect(() => {
    // Only initialize on client side
    if (typeof window === 'undefined') return

    // Get initial session
    const getInitialSession = async () => {
      try {
        if (!supabase) {
          throw new Error('Supabase client not initialized')
        }
        
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)
        
        // Fetch user profile if user exists
        if (session?.user) {
          console.log('🔄 Fetching user profile for:', session.user.id)
          const profile = await fetchUserProfile(session.user.id)
          console.log("User Profile: ", profile)
          if (profile) {
            console.log('✅ User profile loaded:', profile.role)
            setUserProfile(profile)
          } else {
            console.warn('⚠️ User profile not found or failed to load')
            setUserProfile(null)
          }
        } else {
          console.log('👤 No user session found')
          setUserProfile(null)
        }
        
        setError(null)
      } catch (error) {
        console.error('❌ Error getting initial session:', error)
        setError(error instanceof Error ? error.message : 'Failed to initialize authentication')
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('🔄 Auth state changed:', event, session?.user?.id)
          setSession(session)
          setUser(session?.user ?? null)
          
          // Fetch user profile when user changes
          if (session?.user) {
            console.log('🔄 Fetching user profile after auth change:', session.user.id)
            const profile = await fetchUserProfile(session.user.id)
            if (profile) {
              console.log('✅ User profile loaded after auth change:', profile.role)
              setUserProfile(profile)
            } else {
              console.warn('⚠️ User profile not found after auth change')
              setUserProfile(null)
            }
          } else {
            console.log('👤 No user after auth change')
            setUserProfile(null)
          }
          
          setLoading(false)
        }
      )

      return () => subscription.unsubscribe()
    } catch (error) {
      console.error('❌ Error setting up auth state change listener:', error)
      setError(error instanceof Error ? error.message : 'Failed to setup authentication listener')
      setLoading(false)
    }
  }, [supabase])

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      return { error }
    } catch {
      return { error: { message: 'Failed to sign up. Please try again.' } as AuthError }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error }
    } catch {
      return { error: { message: 'Failed to sign in. Please try again.' } as AuthError }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch {
      return { error: { message: 'Failed to sign out. Please try again.' } as AuthError }
    }
  }

  // Role checking helper functions
  const isStaff = (): boolean => {
    return userProfile?.role === UserRole.staff
  }

  const isAdmin = (): boolean => {
    return userProfile?.role === UserRole.admin
  }

  const hasRole = (role: UserRole): boolean => {
    return userProfile?.role === role
  }

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return userProfile ? roles.includes(userProfile.role) : false
  }

  const value = {
    user,
    userProfile,
    session,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    isStaff,
    isAdmin,
    hasRole,
    hasAnyRole,
    refreshUserProfile,
  }

  return (
    <AuthContext.Provider value={value}>
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