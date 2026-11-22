import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Mail,
  Send,
  Eye,
  MessageSquare,
  AlertOctagon,
  UserX,
  TrendingUp,
  Calendar,
  Filter,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { CampaignAnalytics } from '@/types/database'

export function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30')
  const [selectedCampaign, setSelectedCampaign] = useState('all')
  const { currentWorkspace } = useAuthStore()
  const workspaceId = currentWorkspace?.id

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns-filter-list', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const { data } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('workspace_id', workspaceId)
      return data || []
    },
    enabled: !!workspaceId,
  })

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics-overview', workspaceId, timeRange, selectedCampaign],
    queryFn: async () => {
      if (!workspaceId) return null

      let query = supabase
        .from('campaign_analytics')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('date', { ascending: true })

      if (selectedCampaign !== 'all') {
        query = query.eq('campaign_id', selectedCampaign)
      }

      const { data, error } = await query
      if (error) throw error

      const records = (data || []) as CampaignAnalytics[]

      const totals = records.reduce(
        (acc, item) => ({
          sent: acc.sent + (item.emails_sent || 0),
          delivered: acc.delivered + (item.emails_delivered || 0),
          opened: acc.opened + (item.emails_opened || 0),
          clicked: acc.clicked + (item.emails_clicked || 0),
          replied: acc.replied + (item.emails_replied || 0),
          bounced: acc.bounced + (item.emails_bounced || 0),
          unsubscribed: acc.unsubscribed + (item.emails_unsubscribed || 0),
          failed: acc.failed + (item.emails_failed || 0),
        }),
        { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, unsubscribed: 0, failed: 0 }
      )

      const chartData = records.map((r) => ({
        date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sent: r.emails_sent,
        delivered: r.emails_delivered,
        opened: r.emails_opened,
        clicked: r.emails_clicked,
        replied: r.emails_replied,
        bounced: r.emails_bounced,
      }))

      return { totals, chartData }
    },
    enabled: !!workspaceId,
  })

  const totals = analytics?.totals || { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, unsubscribed: 0, failed: 0 }
  const openRate = totals.sent > 0 ? ((totals.opened / totals.sent) * 100).toFixed(1) : '0.0'
  const replyRate = totals.sent > 0 ? ((totals.replied / totals.sent) * 100).toFixed(1) : '0.0'
  const clickRate = totals.sent > 0 ? ((totals.clicked / totals.sent) * 100).toFixed(1) : '0.0'
  const bounceRate = totals.sent > 0 ? ((totals.bounced / totals.sent) * 100).toFixed(1) : '0.0'
  const unsubRate = totals.sent > 0 ? ((totals.unsubscribed / totals.sent) * 100).toFixed(1) : '0.0'

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            Live delivery, engagement, and conversion metrics across your workspace.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Send className="h-3 w-3 text-blue-500" /> Emails Sent
            </span>
            <div className="text-2xl font-bold">{totals.sent.toLocaleString()}</div>
            <p className="text-[11px] text-muted-foreground">Accepted by SMTP</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3 text-emerald-500" /> Open Rate
            </span>
            <div className="text-2xl font-bold">{openRate}%</div>
            <p className="text-[11px] text-muted-foreground">{totals.opened.toLocaleString()} estimated opens</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-purple-500" /> Reply Rate
            </span>
            <div className="text-2xl font-bold">{replyRate}%</div>
            <p className="text-[11px] text-muted-foreground">{totals.replied.toLocaleString()} direct replies</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-amber-500" /> Click Rate
            </span>
            <div className="text-2xl font-bold">{clickRate}%</div>
            <p className="text-[11px] text-muted-foreground">{totals.clicked.toLocaleString()} link clicks</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertOctagon className="h-3 w-3 text-rose-500" /> Bounce Rate
            </span>
            <div className="text-2xl font-bold">{bounceRate}%</div>
            <p className="text-[11px] text-muted-foreground">{totals.bounced.toLocaleString()} hard/soft bounces</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <UserX className="h-3 w-3 text-gray-500" /> Unsubscribes
            </span>
            <div className="text-2xl font-bold">{unsubRate}%</div>
            <p className="text-[11px] text-muted-foreground">{totals.unsubscribed.toLocaleString()} opted out</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outreach Sending Volume</CardTitle>
            <CardDescription>Daily emails delivered and accepted by mail servers</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : analytics?.chartData && analytics.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={analytics.chartData}>
                  <defs>
                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="sent" stroke="#3b82f6" fill="url(#colorSent)" name="Sent" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No activity records found in selected range.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement Breakdown</CardTitle>
            <CardDescription>Comparison of opens, replies, and bounces</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : analytics?.chartData && analytics.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="opened" fill="#10b981" name="Opens" />
                  <Bar dataKey="replied" fill="#8b5cf6" name="Replies" />
                  <Bar dataKey="bounced" fill="#f43f5e" name="Bounces" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No engagement events recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
