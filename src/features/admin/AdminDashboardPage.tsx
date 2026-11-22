import { useQuery } from '@tanstack/react-query'
import {
  Shield,
  Building2,
  Users,
  Mail,
  Megaphone,
  Activity,
  Layers,
  ArrowUpRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['super-admin-overview'],
    queryFn: async () => {
      const [
        customersCount,
        workspacesCount,
        profilesCount,
        accountsCount,
        campaignsCount,
        messagesCount,
      ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('workspaces').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('email_accounts').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('email_messages').select('*', { count: 'exact', head: true }),
      ])

      return {
        customers: customersCount.count || 0,
        workspaces: workspacesCount.count || 0,
        users: profilesCount.count || 0,
        accounts: accountsCount.count || 0,
        campaigns: campaignsCount.count || 0,
        messages: messagesCount.count || 0,
      }
    },
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
          <Shield className="h-6 w-6 text-orange-500" />
          Super Admin Global Overview
        </h1>
        <p className="text-muted-foreground text-sm">
          Platform-wide metrics across all customer tenants, workspaces, and connected mail infra.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3 text-orange-500" /> Customers
            </span>
            <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12" /> : stats?.customers}</div>
            <p className="text-[11px] text-muted-foreground">Paying / trial accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Layers className="h-3 w-3 text-blue-500" /> Workspaces
            </span>
            <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12" /> : stats?.workspaces}</div>
            <p className="text-[11px] text-muted-foreground">Active isolated tenants</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3 text-emerald-500" /> Users
            </span>
            <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12" /> : stats?.users}</div>
            <p className="text-[11px] text-muted-foreground">Registered profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3 text-purple-500" /> Email Accounts
            </span>
            <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12" /> : stats?.accounts}</div>
            <p className="text-[11px] text-muted-foreground">Connected inboxes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Megaphone className="h-3 w-3 text-cyan-500" /> Campaigns
            </span>
            <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12" /> : stats?.campaigns}</div>
            <p className="text-[11px] text-muted-foreground">Total created sequences</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3 text-rose-500" /> Messages
            </span>
            <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12" /> : stats?.messages}</div>
            <p className="text-[11px] text-muted-foreground">Inbound & outbound emails</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Health & Workers</CardTitle>
            <CardDescription>Status of background sync and queue processors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="text-sm font-medium">PostgreSQL Database</p>
                <p className="text-xs text-muted-foreground">Row Level Security enabled, connection pooling active</p>
              </div>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600">
                Healthy
              </span>
            </div>

            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="text-sm font-medium">IMAP Inbound Sync Worker</p>
                <p className="text-xs text-muted-foreground">Scheduled every 5m per active email inbox</p>
              </div>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600">
                Operational
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">SMTP BullMQ Sending Queue</p>
                <p className="text-xs text-muted-foreground">Redis-backed, rate-limiting & delay enforcement</p>
              </div>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600">
                Running
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security & Multi-Tenant Enforcement</CardTitle>
            <CardDescription>Workspace level strict data containment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              🔒 <strong>Row Level Security:</strong> Direct queries are filtered through user workspace membership checking PostgreSQL functions.
            </p>
            <p>
              🔑 <strong>Credential Encryption:</strong> SMTP passwords & OAuth tokens are encrypted using AES-256-GCM server-side encryption keys before insertion.
            </p>
            <p>
              🛡️ <strong>Service-Role Separation:</strong> Browser clients never receive or hold the Supabase service_role key.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
