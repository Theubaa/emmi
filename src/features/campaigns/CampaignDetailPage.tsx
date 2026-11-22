import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, Pause, Trash2, Users, Mail, Eye, MessageSquare, AlertTriangle, Ban, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import type { Campaign, CampaignSequence, CampaignLead } from '@/types/database'

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { currentWorkspace } = useAuthStore()
  const workspaceId = currentWorkspace?.id
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Campaign
    },
    enabled: !!id,
  })

  const { data: sequences } = useQuery({
    queryKey: ['campaign-sequences', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('campaign_sequences')
        .select('*')
        .eq('campaign_id', id!)
        .order('step_number')
      return (data || []) as CampaignSequence[]
    },
    enabled: !!id,
  })

  const { data: campaignLeads } = useQuery({
    queryKey: ['campaign-leads', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('campaign_leads')
        .select('*, lead:leads(email, first_name, last_name, company)')
        .eq('campaign_id', id!)
        .order('created_at', { ascending: false })
        .limit(50)
      return (data || []) as CampaignLead[]
    },
    enabled: !!id,
  })

  const { data: availableLeads } = useQuery({
    queryKey: ['available-leads', workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, email, first_name, last_name')
        .eq('workspace_id', workspaceId!)
        .eq('status', 'active')
        .eq('unsubscribed', false)
        .eq('bounced', false)
        .limit(100)
      return data || []
    },
    enabled: !!workspaceId,
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!campaign) return
      const newStatus = campaign.status === 'active' ? 'paused' : 'active'
      const { error } = await supabase.from('campaigns').update({ status: newStatus }).eq('id', id!)
      if (error) throw error
      return newStatus
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast({ title: 'Campaign status updated' })
    },
  })

  const addLeadsMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      if (!workspaceId || !id) return
      const entries = leadIds.map(leadId => ({
        campaign_id: id,
        workspace_id: workspaceId,
        lead_id: leadId,
        status: 'pending' as const,
        current_step: 0,
      }))
      const { error } = await supabase.from('campaign_leads').upsert(entries, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true })
      if (error) throw error
      // Update total_leads count
      const { count } = await supabase.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('campaign_id', id)
      await supabase.from('campaigns').update({ total_leads: count || 0 }).eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-leads', id] })
      queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      toast({ title: 'Leads added to campaign' })
    },
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  if (!campaign) {
    return <div className="p-6">Campaign not found.</div>
  }

  const openRate = campaign.emails_sent > 0 ? Math.round((campaign.emails_opened / campaign.emails_sent) * 100) : 0
  const replyRate = campaign.emails_sent > 0 ? Math.round((campaign.emails_replied / campaign.emails_sent) * 100) : 0
  const bounceRate = campaign.emails_sent > 0 ? Math.round((campaign.emails_bounced / campaign.emails_sent) * 100) : 0
  const sentRate = campaign.total_leads > 0 ? Math.round((campaign.emails_sent / campaign.total_leads) * 100) : 0

  const addAllLeads = () => {
    if (!availableLeads?.length) {
      toast({ title: 'No leads', description: 'No active leads available to add.', variant: 'destructive' })
      return
    }
    addLeadsMutation.mutate(availableLeads.map(l => l.id))
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge variant={campaign.status === 'active' ? 'success' : 'secondary' as any}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Created {formatRelativeTime(campaign.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {(campaign.status === 'active' || campaign.status === 'paused' || campaign.status === 'draft') && (
            <Button
              variant="outline"
              onClick={() => toggleStatusMutation.mutate()}
              disabled={toggleStatusMutation.isPending}
            >
              {campaign.status === 'active' ? <><Pause className="h-4 w-4 mr-2" /> Pause</> : <><Play className="h-4 w-4 mr-2" /> Activate</>}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Mail, label: 'Sent', value: campaign.emails_sent.toLocaleString(), sub: `${sentRate}% of ${campaign.total_leads}` },
          { icon: Eye, label: 'Open Rate', value: `${openRate}%`, sub: `${campaign.emails_opened} opened` },
          { icon: MessageSquare, label: 'Reply Rate', value: `${replyRate}%`, sub: `${campaign.emails_replied} replied` },
          { icon: AlertTriangle, label: 'Bounce Rate', value: `${bounceRate}%`, sub: `${campaign.emails_bounced} bounced` },
        ].map(({ icon: Icon, label, value, sub }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{label}</span>
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sending progress */}
      {campaign.total_leads > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Campaign Progress</span>
              <span className="text-muted-foreground">{campaign.emails_sent} / {campaign.total_leads} emails sent</span>
            </div>
            <Progress value={sentRate} />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="sequence">
        <TabsList>
          <TabsTrigger value="sequence">Sequence ({sequences?.length || 0})</TabsTrigger>
          <TabsTrigger value="leads">Leads ({campaign.total_leads})</TabsTrigger>
        </TabsList>

        <TabsContent value="sequence" className="space-y-4 mt-4">
          {sequences?.map((step, i) => (
            <Card key={step.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                    {step.step_number}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{step.subject}</h3>
                      <Badge variant="outline" className="text-xs">
                        {step.delay_days === 0 && step.delay_hours === 0
                          ? 'Day 0 (immediately)'
                          : `Day ${step.delay_days}${step.delay_hours > 0 ? `, ${step.delay_hours}h` : ''}`}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{step.body_text}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">{campaign.total_leads} leads in campaign</h3>
            <Button size="sm" onClick={addAllLeads} disabled={addLeadsMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add Active Leads
            </Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Email</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Step</th>
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Next Send</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignLeads?.length ? (
                    campaignLeads.map((cl) => (
                      <tr key={cl.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 text-sm">{cl.lead?.email}</td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {[cl.lead?.first_name, cl.lead?.last_name].filter(Boolean).join(' ') || '-'}
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className="text-xs">{cl.status}</Badge>
                        </td>
                        <td className="p-3 text-sm">{cl.current_step}</td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {cl.next_send_at ? formatRelativeTime(cl.next_send_at) : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">
                        No leads added yet. Click "Add Active Leads" to add all your active leads.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
