'use client'

import { useAuth } from '@/contexts/auth-context'
import { UserRole } from '@/types/database'

/**
 * Hook for role-based access control in components
 * Provides utilities for conditional rendering based on user roles
 */
export function useRoleBasedAccess() {
  const { userProfile, isStaff, isAdmin, hasRole, hasAnyRole } = useAuth()

  /**
   * Check if user has help desk access (staff or admin)
   */
  const hasHelpDeskAccess = (): boolean => {
    return hasAnyRole([UserRole.staff, UserRole.admin])
  }

  /**
   * Check if user has admin-only access
   */
  const hasAdminAccess = (): boolean => {
    return isAdmin()
  }

  /**
   * Check if user has staff-level access (staff or admin)
   */
  const hasStaffAccess = (): boolean => {
    return hasAnyRole([UserRole.staff, UserRole.admin])
  }

  /**
   * Get user role for display purposes
   */
  const getUserRoleDisplay = (): string => {
    if (!userProfile) return 'Unknown'
    
    switch (userProfile.role) {
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

  /**
   * Check if user can access a specific feature
   */
  const canAccessFeature = (feature: string): boolean => {
    if (!userProfile) return false

    switch (feature) {
      case 'helpdesk':
        return hasHelpDeskAccess()
      case 'admin':
        return hasAdminAccess()
      case 'staff':
        return hasStaffAccess()
      case 'user':
        return true // All authenticated users can access basic features
      default:
        return false
    }
  }

  /**
   * Get available navigation items based on user role
   */
  const getAvailableNavItems = () => {
    const navItems = [
      {
        title: 'Dashboard',
        href: '/dashboard',
        available: true,
      },
    ]

    if (hasHelpDeskAccess()) {
      navItems.push({
        title: 'Help Desk',
        href: '/helpdesk',
        available: true,
      })
    }

    if (hasAdminAccess()) {
      navItems.push({
        title: 'Admin Panel',
        href: '/admin',
        available: true,
      })
    }

    return navItems.filter(item => item.available)
  }

  return {
    userProfile,
    isStaff,
    isAdmin,
    hasRole,
    hasAnyRole,
    hasHelpDeskAccess,
    hasAdminAccess,
    hasStaffAccess,
    getUserRoleDisplay,
    canAccessFeature,
    getAvailableNavItems,
  }
}

/**
 * Higher-order component for role-based rendering
 */
export interface RoleGuardProps {
  children: React.ReactNode
  requiredRoles?: UserRole[]
  fallback?: React.ReactNode
  feature?: string
}

export function RoleGuard({ 
  children, 
  requiredRoles, 
  fallback = null, 
  feature 
}: RoleGuardProps) {
  const { hasAnyRole, canAccessFeature } = useRoleBasedAccess()

  // Check feature-based access
  if (feature) {
    return canAccessFeature(feature) ? <>{children}</> : <>{fallback}</>
  }

  // Check role-based access
  if (requiredRoles && requiredRoles.length > 0) {
    return hasAnyRole(requiredRoles) ? <>{children}</> : <>{fallback}</>
  }

  // Default: render children
  return <>{children}</>
}

/**
 * Component for conditional rendering based on help desk access
 */
export function HelpDeskGuard({ 
  children, 
  fallback = null 
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode 
}) {
  return (
    <RoleGuard 
      requiredRoles={[UserRole.staff, UserRole.admin]} 
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  )
}

/**
 * Component for conditional rendering based on admin access
 */
export function AdminGuard({ 
  children, 
  fallback = null 
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode 
}) {
  return (
    <RoleGuard 
      requiredRoles={[UserRole.admin]} 
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  )
}