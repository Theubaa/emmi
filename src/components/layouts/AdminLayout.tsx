import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  ShieldAlert,
  LayoutDashboard,
  Users,
  Building2,
  Layers,
  FileText,
  LogOut,
  Terminal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Global Overview', to: '/super-user' },
  { icon: Users, label: 'User Provisioning', to: '/super-user/users' },
  { icon: Building2, label: 'Customer Accounts', to: '/super-user/customers' },
  { icon: Layers, label: 'Workspaces Directory', to: '/super-user/workspaces' },
  { icon: FileText, label: 'Security Audit Logs', to: '/super-user/audit-logs' },
]

export function AdminLayout() {
  const { signOut } = useAuth()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/super-user/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Super Admin Dedicated Sidebar */}
      <aside className="w-64 flex flex-col bg-zinc-900 border-r border-zinc-800">
        <div className="flex items-center gap-3 h-16 px-4 border-b border-zinc-800">
          <div className="h-9 w-9 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-wide text-white">EMMIL</span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono px-1 py-0 border-orange-500/40 text-orange-400">
                Root
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400 truncate">Super Admin Console</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/super-user'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30 font-semibold'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Admin Identity & Sign Out */}
        <div className="p-3 border-t border-zinc-800 space-y-3 bg-zinc-950/40">
          <div className="px-2 py-1.5">
            <p className="text-xs font-semibold text-white truncate">
              {user?.full_name || 'Administrator'}
            </p>
            <p className="text-[11px] text-zinc-400 truncate font-mono mt-0.5">
              {user?.email}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Terminate Session
          </Button>
        </div>
      </aside>

      {/* Main Admin Console Workspace */}
      <main className="flex-1 overflow-y-auto bg-zinc-950">
        <Outlet />
      </main>
    </div>
  )
}
