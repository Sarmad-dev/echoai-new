import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { UserRole, Database } from '../../types/database'

/**
 * Server-side utility functions for role-based access control
 */

/**
 * Creates a server-side Supabase client for role checking
 */
async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
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
 * Get current user with role information from server-side
 */
export async function getCurrentUserWithRole() {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { user: null, userProfile: null, error: 'Not authenticated' }
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('User')
      .select('id, email, role, plan, apiKey, createdAt, updatedAt')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return { user, userProfile: null, error: 'Failed to fetch user profile' }
    }

    return { user, userProfile, error: null }
  } catch (error) {
    console.error('Error in getCurrentUserWithRole:', error)
    return { user: null, userProfile: null, error: 'Server error' }
  }
}

/**
 * Check if current user has required role(s)
 */
export async function requireRole(requiredRoles: UserRole[]) {
  const { user, userProfile, error } = await getCurrentUserWithRole()

  if (error || !user || !userProfile) {
    throw new Error('Authentication required')
  }

  const hasRequiredRole = requiredRoles.includes((userProfile as any).role as UserRole)
  
  if (!hasRequiredRole) {
    throw new Error(`Access denied. Required roles: ${requiredRoles.join(', ')}`)
  }

  return { user, userProfile }
}

/**
 * Check if current user has help desk access (staff or admin)
 */
export async function requireHelpDeskAccess() {
  return requireRole([UserRole.staff, UserRole.admin])
}

/**
 * Check if current user has admin access
 */
export async function requireAdminAccess() {
  return requireRole([UserRole.admin])
}

/**
 * Check if current user has staff access (staff or admin)
 */
export async function requireStaffAccess() {
  return requireRole([UserRole.staff, UserRole.admin])
}

/**
 * Verify user role without throwing errors (returns boolean)
 */
export async function verifyUserRole(requiredRoles: UserRole[]): Promise<{
  hasAccess: boolean
  user: any | null
  userProfile: any | null
  error?: string
}> {
  try {
    const { user, userProfile } = await requireRole(requiredRoles)
    return { hasAccess: true, user, userProfile }
  } catch (error) {
    const { user, userProfile } = await getCurrentUserWithRole()
    return { 
      hasAccess: false, 
      user, 
      userProfile, 
      error: error instanceof Error ? error.message : 'Access denied' 
    }
  }
}

/**
 * Role checking utilities for specific features
 */
export const roleCheckers = {
  /**
   * Check if user can access help desk
   */
  async canAccessHelpDesk() {
    const { hasAccess } = await verifyUserRole([UserRole.staff, UserRole.admin])
    return hasAccess
  },

  /**
   * Check if user can access admin features
   */
  async canAccessAdmin() {
    const { hasAccess } = await verifyUserRole([UserRole.admin])
    return hasAccess
  },

  /**
   * Check if user can access staff features
   */
  async canAccessStaff() {
    const { hasAccess } = await verifyUserRole([UserRole.staff, UserRole.admin])
    return hasAccess
  },

  /**
   * Get user role display name
   */
  getRoleDisplayName(role: UserRole): string {
    switch (role) {
      case UserRole.admin:
        return 'Administrator'
      case UserRole.staff:
        return 'Staff Member'
      case UserRole.user:
        return 'User'
      default:
        return 'Unknown'
    }
  }
}

/**
 * Middleware helper for API routes
 */
export function createRoleMiddleware(requiredRoles: UserRole[]) {
  return async function roleMiddleware() {
    try {
      const { user, userProfile } = await requireRole(requiredRoles)
      return { success: true, user, userProfile }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Access denied' 
      }
    }
  }
}

/**
 * Helper for Next.js API routes to check roles
 */
export async function withRoleCheck<T>(
  requiredRoles: UserRole[],
  handler: (user: any, userProfile: any) => Promise<T>
): Promise<T> {
  const { user, userProfile } = await requireRole(requiredRoles)
  return handler(user, userProfile)
}