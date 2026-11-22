import { useQuery } from '@tanstack/react-query'
import { Mail, Users, Megaphone, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/lib/utils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function StatCard({
  title, value, change, icon: Icon, loading, color = 'blue'
}: {
  title: string
  value: string | number
  change?: number
  icon: React.ElementType
  loading?: boolean
  color?: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    purple: 'bg-purple-500/10 text-purple-500',
    orange: 'bg-orange-500/10 text-orange-500',
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <p className="text-2xl font-bold mt-1">{value}</p>
            )}
            {change !== undefined && !loading && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(change)}% from last week
              </div>
            )}
          </div>
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { currentWorkspace } = useAuthStore()
  const workspaceId = currentWorkspace?.id

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null
      const [campaigns, leads, emailAccounts, emailsSent] = await Promise.all([
        supabase.from('campaigns').select('id, status').eq('workspace_id', workspaceId),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('email_accounts').select('id, status').eq('workspace_id', workspaceId),
        supabase.from('campaign_analytics').select('emails_sent').eq('workspace_id', workspaceId),
      ])
      const totalEmailsSent = (emailsSent.data || []).reduce((sum, r) => sum + (r.emails_sent || 0), 0)
      return {
        totalCampaigns: campaigns.data?.length || 0,
        activeCampaigns: campaigns.data?.filter(c => c.status === 'active').length || 0,
        totalLeads: leads.count || 0,
        connectedAccounts: emailAccounts.data?.filter(a => a.status === 'connected').length || 0,
        totalEmailsSent,
      }
    },
    enabled: !!workspaceId,
  })

  const { data: recentCampaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['recent-campaigns', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(5)
      return data || []
    },
    enabled: !!workspaceId,
  })

  const { data: analyticsData } = useQuery({
    queryKey: ['analytics-chart', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const { data } = await supabase
        .from('campaign_analytics')
        .select('date, emails_sent, emails_opened, emails_replied')
        .eq('workspace_id', workspaceId)
        .order('date', { ascending: true })
        .limit(14)
      return (data || []).map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sent: d.emails_sent,
        opened: d.emails_opened,
        replied: d.emails_replied,
      }))
    },
    enabled: !!workspaceId,
  })

  const campaignStatusColor: Record<string, string> = {
    draft: 'secondary',
    active: 'success',
    paused: 'warning',
    completed: 'outline',
    archived: 'secondary',
  }

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
            <Activity className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold">No workspace selected</h2>
          <p className="text-muted-foreground">Select or create a workspace to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening in {currentWorkspace.name}.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Campaigns"
          value={stats?.totalCampaigns ?? 0}
          icon={Megaphone}
          loading={statsLoading}
          color="blue"
        />
        <StatCard
          title="Total Leads"
          value={stats?.totalLeads?.toLocaleString() ?? 0}
          icon={Users}
          loading={statsLoading}
          color="purple"
        />
        <StatCard
          title="Emails Sent"
          value={stats?.totalEmailsSent?.toLocaleString() ?? 0}
          icon={Mail}
          loading={statsLoading}
          color="green"
        />
        <StatCard
          title="Connected Accounts"
          value={stats?.connectedAccounts ?? 0}
          icon={TrendingUp}
          loading={statsLoading}
          color="orange"
        />
      </div>

      {/* Charts + Recent Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Email Activity</CardTitle>
            <CardDescription>Emails sent, opened, and replied over the last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsData && analyticsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={analyticsData}>
                  <defs>
                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area type="monotone" dataKey="sent" stroke="#3b82f6" fill="url(#colorSent)" name="Sent" />
                  <Area type="monotone" dataKey="opened" stroke="#10b981" fill="url(#colorOpened)" name="Opened" />
                  <Area type="monotone" dataKey="replied" stroke="#f59e0b" fill="none" strokeDasharray="4 4" name="Replied" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No analytics data yet</p>
                  <p className="text-xs opacity-60">Start a campaign to see activity</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaignsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))
            ) : recentCampaigns && recentCampaigns.length > 0 ? (
              recentCampaigns.map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{campaign.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(campaign.created_at)}
                      </span>
                    </div>
                  </div>
                  <Badge variant={campaignStatusColor[campaign.status] as any || 'secondary'} className="ml-2 shrink-0">
                    {campaign.status}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Megaphone className="h-6 w-6 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No campaigns yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
