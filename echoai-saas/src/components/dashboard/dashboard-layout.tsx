'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Database, 
  Palette, 
  Code, 
  Menu, 
  LogOut,
  Bot,
  HelpCircle,
  Workflow,
  Plug,
  BarChart3,
  BookOpen,
  Headphones
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarProvider, 
  SidebarTrigger 
} from '@/components/ui/sidebar'
import { useAuth } from '@/contexts/auth-context'
import { useRoleBasedAccess } from '@/hooks/use-role-based-access'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigationItems = [
  {
    title: 'Chatbots',
    href: '/dashboard',
    icon: Bot,
  },
  {
    title: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
  },
  {
    title: 'Training Data',
    href: '/dashboard/data',
    icon: Database,
  },
  {
    title: 'FAQ Management',
    href: '/dashboard/faq',
    icon: HelpCircle,
  },
  {
    title: 'Automation',
    href: '/dashboard/automation',
    icon: Workflow,
  },
  {
    title: 'Integrations',
    href: '/dashboard/integrations',
    icon: Plug,
  },
  {
    title: 'Customize',
    href: '/dashboard/customize',
    icon: Palette,
  },
  {
    title: 'Embed Code',
    href: '/dashboard/embed',
    icon: Code,
  },
]

function DashboardSidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { hasHelpDeskAccess } = useRoleBasedAccess()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">EchoAI</span>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {user?.email}
        </p>
      </SidebarHeader>
      
      <SidebarContent className="p-4">
        <SidebarMenu>
          {navigationItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={pathname === item.href}>
                <Link href={item.href} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        
        <div className="mt-auto pt-4 border-t">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3" 
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}

function MobileNavigation() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { hasHelpDeskAccess } = useRoleBasedAccess()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex flex-col h-full">
          <div className="border-b p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">EchoAI</span>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
          
          <div className="flex-1 p-4">
            <nav className="space-y-2">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    pathname === item.href
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              ))}
            </nav>
          </div>
          
          <div className="border-t p-4">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3" 
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function HelpDeskNavigation() {
  const { hasHelpDeskAccess } = useRoleBasedAccess()

  if (!hasHelpDeskAccess()) {
    return null
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href="/helpdesk" className="flex items-center gap-2">
        <Headphones className="h-4 w-4" />
        Help Desk
      </Link>
    </Button>
  )
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Mobile Header */}
          <header className="md:hidden border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <Bot className="h-6 w-6 text-primary" />
                <span className="font-semibold text-lg">EchoAI</span>
              </div>
              <div className="flex items-center gap-2">
                <HelpDeskNavigation />
                <MobileNavigation />
              </div>
            </div>
          </header>
          
          {/* Desktop Header with Sidebar Trigger */}
          <header className="hidden md:flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
            <SidebarTrigger />
            <HelpDeskNavigation />
          </header>
          
          {/* Page Content */}
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}