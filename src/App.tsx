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
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const { loading } = useAuth()

  if (loading) return <div className="flex h-screen items-center justify-center"><Skeleton className="h-8 w-64" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_super_admin) return <Navigate to="/" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const { loading } = useAuth()

  if (loading) return <div className="flex h-screen items-center justify-center"><Skeleton className="h-8 w-64" /></div>
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        {/* Public sign up disabled: redirected to /login */}
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      </Route>

      {/* Workspace Setup */}
      <Route path="/workspace/setup" element={<ProtectedRoute><WorkspaceSetupPage /></ProtectedRoute>} />

      {/* App Routes */}
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

      {/* Super Admin Routes */}
      <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/customers" element={<AdminCustomersPage />} />
        <Route path="/admin/workspaces" element={<AdminWorkspacesPage />} />
        <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
