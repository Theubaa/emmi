import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useAuth } from '@/contexts/AuthContext'

// Layouts
import { AppLayout } from '@/components/layouts/AppLayout'
import { AuthLayout } from '@/components/layouts/AuthLayout'
import { AdminLayout } from '@/components/layouts/AdminLayout'

// Auth Pages
import { LoginPage } from '@/features/auth/LoginPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { SetPasswordPage } from '@/features/auth/SetPasswordPage'
import { SuperAdminLoginPage } from '@/features/auth/SuperAdminLoginPage'

// App Pages
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { EmailAccountsPage } from '@/features/email-accounts/EmailAccountsPage'
import { CampaignsPage } from '@/features/campaigns/CampaignsPage'
import { CampaignDetailPage } from '@/features/campaigns/CampaignDetailPage'
import { CampaignCreatePage } from '@/features/campaigns/CampaignCreatePage'
import { LeadsPage } from '@/features/leads/LeadsPage'
import { UniboxPage } from '@/features/unibox/UniboxPage'
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage'
import { TeamPage } from '@/features/team/TeamPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { BillingPage } from '@/features/billing/BillingPage'
import { WorkspaceSetupPage } from '@/features/workspace/WorkspaceSetupPage'

// Admin Pages
import { AdminDashboardPage } from '@/features/admin/AdminDashboardPage'
import { AdminUsersPage } from '@/features/admin/AdminUsersPage'
import { AdminCustomersPage } from '@/features/admin/AdminCustomersPage'
import { AdminWorkspacesPage } from '@/features/admin/AdminWorkspacesPage'
import { AdminAuditLogsPage } from '@/features/admin/AdminAuditLogsPage'

import { Skeleton } from '@/components/ui/skeleton'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  // Strict separation: Super Admin is redirected exclusively to the Super Admin console
  if (user.is_super_admin) return <Navigate to="/super-user" replace />

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="space-y-3 w-64">
          <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-zinc-400 text-center font-mono">Authenticating Root Console Access...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/super-user/login" replace />
  if (!user.is_super_admin) return <Navigate to="/" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const { loading } = useAuth()

  if (loading) return <div className="flex h-screen items-center justify-center"><Skeleton className="h-8 w-64" /></div>
  if (user) {
    if (user.is_super_admin) return <Navigate to="/super-user" replace />
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function SuperAdminPublicRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto" />
      </div>
    )
  }

  if (user?.is_super_admin) return <Navigate to="/super-user" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Standard User Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        {/* Public sign up disabled: redirected to /login */}
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/reset-password" element={<SetPasswordPage />} />
      </Route>

      {/* Super Admin Dedicated Login Route */}
      <Route
        path="/super-user/login"
        element={
          <SuperAdminPublicRoute>
            <SuperAdminLoginPage />
          </SuperAdminPublicRoute>
        }
      />

      {/* Legacy /admin redirects */}
      <Route path="/admin" element={<Navigate to="/super-user" replace />} />
      <Route path="/admin/*" element={<Navigate to="/super-user" replace />} />

      {/* Workspace Setup */}
      <Route path="/workspace/setup" element={<ProtectedRoute><WorkspaceSetupPage /></ProtectedRoute>} />

      {/* Standard App Routes (Tenant Workspaces Only) */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/email-accounts" element={<EmailAccountsPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/new" element={<CampaignCreatePage />} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/unibox" element={<UniboxPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/billing" element={<BillingPage />} />
      </Route>

      {/* Super Admin Protected Console (/super-user) */}
      <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route path="/super-user" element={<AdminDashboardPage />} />
        <Route path="/super-user/users" element={<AdminUsersPage />} />
        <Route path="/super-user/customers" element={<AdminCustomersPage />} />
        <Route path="/super-user/workspaces" element={<AdminWorkspacesPage />} />
        <Route path="/super-user/audit-logs" element={<AdminAuditLogsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
