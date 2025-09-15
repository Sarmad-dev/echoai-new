import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for server-side operations
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Gets the current user session from Supabase
 * This replaces the getServerSession from next-auth
 * Uses getUser() instead of getSession() for security
 */
export async function getServerSession() {
  const supabase = await createServerSupabaseClient()
  
  try {
    // Use getUser() instead of getSession() for security
    // getUser() validates the JWT with the Supabase Auth server
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Error getting user:', error)
      return null
    }

    if (!user) {
      return null
    }

    // Return a session-like object for compatibility
    return {
      user,
      access_token: null, // Not available from getUser()
      refresh_token: null, // Not available from getUser()
      expires_at: null, // Not available from getUser()
      expires_in: null, // Not available from getUser()
      token_type: 'bearer'
    }
  } catch (error) {
    console.error('Error in getServerSession:', error)
    return null
  }
}

/**
 * Gets the current user directly from Supabase
 */
export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Error getting user:', error)
      return null
    }

    return user
  } catch (error) {
    console.error('Error in getCurrentUser:', error)
    return null
  }
}

/**
 * Validates if a user is authenticated
 */
export async function requireAuth() {
  const session = await getServerSession()
  
  if (!session?.user) {
    throw new Error('Authentication required')
  }
  
  return session
}

/**
 * Auth options placeholder for compatibility with existing code
 * This is not used with Supabase but kept for compatibility
 */
export const authOptions = {
  // This is a placeholder for compatibility with existing imports
  // Supabase handles auth configuration through environment variables
}