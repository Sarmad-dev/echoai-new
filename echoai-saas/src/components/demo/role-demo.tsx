'use client'

import { useRoleBasedAccess, RoleGuard, HelpDeskGuard, AdminGuard } from '@/hooks/use-role-based-access'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield, Users, Settings } from 'lucide-react'

/**
 * Demo component to showcase role-based access control functionality
 * This component demonstrates how different UI elements are rendered based on user roles
 */
export function RoleBasedAccessDemo() {
  const {
    userProfile,
    getUserRoleDisplay,
    hasHelpDeskAccess,
    hasAdminAccess,
    hasStaffAccess,
    getAvailableNavItems,
  } = useRoleBasedAccess()

  if (!userProfile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Role-Based Access Control Demo</CardTitle>
          <CardDescription>Please log in to see role-based features</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const navItems = getAvailableNavItems()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role-Based Access Control Demo
          </CardTitle>
          <CardDescription>
            This demo shows how different features are available based on your user role
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Current User Information</h3>
            <div className="space-y-2">
              <p><strong>Email:</strong> {userProfile.email}</p>
              <p><strong>Role:</strong> <Badge variant="outline">{getUserRoleDisplay()}</Badge></p>
              <p><strong>User ID:</strong> <code className="text-sm bg-gray-100 px-1 rounded">{userProfile.id}</code></p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Access Permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Help Desk Access</span>
                </div>
                <Badge variant={hasHelpDeskAccess() ? "default" : "secondary"}>
                  {hasHelpDeskAccess() ? "Granted" : "Denied"}
                </Badge>
              </div>
              
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Staff Access</span>
                </div>
                <Badge variant={hasStaffAccess() ? "default" : "secondary"}>
                  {hasStaffAccess() ? "Granted" : "Denied"}
                </Badge>
              </div>
              
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4" />
                  <span className="font-medium">Admin Access</span>
                </div>
                <Badge variant={hasAdminAccess() ? "default" : "secondary"}>
                  {hasAdminAccess() ? "Granted" : "Denied"}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Available Navigation Items</h3>
            <div className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <Badge key={item.href} variant="outline">
                  {item.title}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Help Desk Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Help Desk Features</CardTitle>
            <CardDescription>Available to staff and admin users</CardDescription>
          </CardHeader>
          <CardContent>
            <HelpDeskGuard fallback={
              <p className="text-sm text-gray-500">Access denied. Staff or admin role required.</p>
            }>
              <div className="space-y-2">
                <Button className="w-full" variant="outline">
                  View Conversations
                </Button>
                <Button className="w-full" variant="outline">
                  Manage Tickets
                </Button>
                <Button className="w-full" variant="outline">
                  Customer Support
                </Button>
              </div>
            </HelpDeskGuard>
          </CardContent>
        </Card>

        {/* Admin Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Admin Features</CardTitle>
            <CardDescription>Available to admin users only</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminGuard fallback={
              <p className="text-sm text-gray-500">Access denied. Admin role required.</p>
            }>
              <div className="space-y-2">
                <Button className="w-full" variant="outline">
                  User Management
                </Button>
                <Button className="w-full" variant="outline">
                  System Settings
                </Button>
                <Button className="w-full" variant="outline">
                  Analytics Dashboard
                </Button>
              </div>
            </AdminGuard>
          </CardContent>
        </Card>

        {/* General Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">General Features</CardTitle>
            <CardDescription>Available to all authenticated users</CardDescription>
          </CardHeader>
          <CardContent>
            <RoleGuard>
              <div className="space-y-2">
                <Button className="w-full" variant="outline">
                  Dashboard
                </Button>
                <Button className="w-full" variant="outline">
                  Profile Settings
                </Button>
                <Button className="w-full" variant="outline">
                  Documentation
                </Button>
              </div>
            </RoleGuard>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}