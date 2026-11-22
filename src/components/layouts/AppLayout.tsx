import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Mail, Megaphone, Users, Inbox, BarChart3,
  UserCog, Settings, CreditCard, ChevronLeft, ChevronRight,
  LogOut, Building2, Bell, Moon, Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
  { icon: Mail, label: 'Email Accounts', to: '/email-accounts' },
  { icon: Megaphone, label: 'Campaigns', to: '/campaigns' },
  { icon: Users, label: 'Leads', to: '/leads' },
  { icon: Inbox, label: 'Unibox', to: '/unibox' },
  { icon: BarChart3, label: 'Analytics', to: '/analytics' },
  { icon: UserCog, label: 'Team', to: '/team' },
  { icon: Settings, label: 'Settings', to: '/settings' },
  { icon: CreditCard, label: 'Billing', to: '/billing' },
]

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const { user, currentWorkspace } = useAuthStore()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.documentElement.classList.toggle('dark')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center h-16 px-4 border-b border-sidebar-border', collapsed && 'justify-center')}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            {!collapsed && (
              <span className="text-lg font-bold text-sidebar-foreground truncate">Emmil</span>
            )}
          </div>
        </div>

        {/* Workspace switcher */}
        {!collapsed && (
          <div className="px-3 py-3 border-b border-sidebar-border">
            <WorkspaceSwitcher />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  collapsed && 'justify-center px-2'
                )
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            className={cn('text-sidebar-foreground hover:bg-sidebar-accent w-full', !collapsed && 'justify-start')}
            onClick={toggleDarkMode}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!collapsed && <span className="ml-2">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'text-sidebar-foreground hover:bg-sidebar-accent w-full',
                  collapsed ? 'justify-center px-0' : 'justify-start gap-2'
                )}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={user?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs bg-blue-600 text-white">{initials}</AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-medium truncate text-sidebar-foreground">
                      {user?.full_name || user?.email}
                    </p>
                    {user?.full_name && (
                      <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
                    )}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Collapse button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-full h-6 w-6 rounded-full border border-border bg-background shadow-sm text-muted-foreground hover:text-foreground z-10"
          style={{ left: collapsed ? '64px' : '256px' }}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
