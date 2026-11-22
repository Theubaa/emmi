import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Shield, LayoutDashboard, Users, Building2, Layers, FileText, LogOut, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/admin' },
  { icon: Users, label: 'Users', to: '/admin/users' },
  { icon: Building2, label: 'Customers', to: '/admin/customers' },
  { icon: Layers, label: 'Workspaces', to: '/admin/workspaces' },
  { icon: FileText, label: 'Audit Logs', to: '/admin/audit-logs' },
]

export function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 flex flex-col bg-orange-950 border-r border-orange-900">
        <div className="flex items-center gap-2 h-16 px-4 border-b border-orange-900">
          <Shield className="h-6 w-6 text-orange-400" />
          <span className="font-bold text-orange-100">Super Admin</span>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-orange-500/30 text-orange-200'
                    : 'text-orange-300/70 hover:bg-orange-500/10 hover:text-orange-200'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-orange-900 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-orange-300/70 hover:text-orange-200 hover:bg-orange-500/10"
            onClick={() => navigate('/')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Back to App
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-orange-300/70 hover:text-red-400 hover:bg-red-500/10"
            onClick={async () => { await signOut(); navigate('/login') }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
