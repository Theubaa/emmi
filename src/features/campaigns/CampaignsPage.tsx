import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Pause, Play, Trash2, BarChart2, Mail, Users, Eye, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import type { Campaign } from '@/types/database'

const statusColors: Record<string, string> = {
  draft: 'secondary',
  active: 'success',
  paused: 'warning',
  completed: 'outline',
  archived: 'secondary',
}

function CampaignCard({ campaign, onDelete, onToggle }: {
  campaign: Campaign
  onDelete: (id: string) => void
  onToggle: (id: string, status: string) => void
}) {
  const sentRate = campaign.total_leads ? (campaign.emails_sent / campaign.total_leads) * 100 : 0
  const openRate = campaign.emails_sent ? Math.round((campaign.emails_opened / campaign.emails_sent) * 100) : 0
  const replyRate = campaign.emails_sent ? Math.round((campaign.emails_replied / campaign.emails_sent) * 100) : 0

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Link
                to={`/campaigns/${campaign.id}`}
                className="font-semibold text-lg hover:text-primary transition-colors truncate"
              >
                {campaign.name}
              </Link>
              <Badge variant={statusColors[campaign.status] as any}>{campaign.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Created {formatRelativeTime(campaign.created_at)}
            </p>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{campaign.emails_sent} / {campaign.total_leads} sent</span>
                <span>{Math.round(sentRate)}%</span>
              </div>
              <Progress value={sentRate} className="h-2" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Mail className="h-3 w-3" />
                  <span className="text-xs">Sent</span>
                </div>
                <p className="text-sm font-semibold">{campaign.emails_sent.toLocaleString()}</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Eye className="h-3 w-3" />
                  <span className="text-xs">Opened</span>
                </div>
                <p className="text-sm font-semibold">{openRate}%</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <MessageSquare className="h-3 w-3" />
                  <span className="text-xs">Replied</span>
                </div>
                <p className="text-sm font-semibold">{replyRate}%</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Users className="h-3 w-3" />
                  <span className="text-xs">Leads</span>
                </div>
                <p className="text-sm font-semibold">{campaign.total_leads.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            <Link to={`/campaigns/${campaign.id}`}>
              <Button variant="outline" size="sm">
                <BarChart2 className="h-4 w-4 mr-1" />
                Details
              </Button>
            </Link>
            {(campaign.status === 'active' || campaign.status === 'paused') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggle(campaign.id, campaign.status)}
              >
                {campaign.status === 'active'
                  ? <><Pause className="h-4 w-4 mr-1" /> Pause</>
                  : <><Play className="h-4 w-4 mr-1" /> Resume</>
                }
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => { if (confirm('Delete this campaign?')) onDelete(campaign.id) }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CampaignsPage() {
  const [search, setSearch] = useState('')
  const { currentWorkspace } = useAuthStore()
  const workspaceId = currentWorkspace?.id
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', workspaceId, search],
    queryFn: async () => {
      if (!workspaceId) return []
      let query = supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      if (search) query = query.ilike('name', `%${search}%`)
      const { data, error } = await query
      if (error) throw error
      return data as Campaign[]
    },
    enabled: !!workspaceId,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaigns').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast({ title: 'Campaign deleted' })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active'
      const { error } = await supabase.from('campaigns').update({ status: newStatus }).eq('id', id)
      if (error) throw error
      return newStatus
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast({ title: `Campaign ${newStatus}` })
    },
  })

  const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0
  const totalSent = campaigns?.reduce((sum, c) => sum + c.emails_sent, 0) || 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            {campaigns ? `${campaigns.length} campaigns · ${activeCampaigns} active · ${totalSent.toLocaleString()} emails sent` : 'Loading...'}
          </p>
        </div>
        <Button onClick={() => navigate('/campaigns/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-3 w-96" />
                <Skeleton className="h-2 w-full" />
                <div className="grid grid-cols-4 gap-4">
                  {[...Array(4)].map((_, j) => <Skeleton key={j} className="h-10" />)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="space-y-4">
          {campaigns.map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onDelete={(id) => deleteMutation.mutate(id)}
              onToggle={(id, status) => toggleMutation.mutate({ id, currentStatus: status })}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
              Create your first email campaign to start reaching your leads.
            </p>
            <Button onClick={() => navigate('/campaigns/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
