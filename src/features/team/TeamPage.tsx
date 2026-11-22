import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { WorkspaceMember, WorkspaceInvitation, WorkspaceRole } from '@/types/database'

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['owner', 'admin', 'campaign_manager', 'member']),
})

type InviteForm = z.infer<typeof inviteSchema>

export function TeamPage() {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const { currentWorkspace, user } = useAuthStore()
  const workspaceId = currentWorkspace?.id
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'member' },
  })

  // Fetch Members
  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const { data, error } = await supabase
        .from('workspace_members')
        .select('*, profile:profiles(*)')
        .eq('workspace_id', workspaceId)
      if (error) throw error
      return (data || []) as (WorkspaceMember & { profile?: { email: string; full_name: string | null; avatar_url: string | null } })[]
    },
    enabled: !!workspaceId,
  })

  // Fetch Pending Invitations
  const { data: invitations } = useQuery({
    queryKey: ['workspace-invitations', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const { data, error } = await supabase
        .from('workspace_invitations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
      if (error) throw error
      return (data || []) as WorkspaceInvitation[]
    },
    enabled: !!workspaceId,
  })

  // Invite Mutation
  const inviteMutation = useMutation({
    mutationFn: async (formData: InviteForm) => {
      if (!workspaceId || !user) return
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const { error } = await supabase.from('workspace_invitations').insert({
        workspace_id: workspaceId,
        email: formData.email.toLowerCase().trim(),
        role: formData.role,
        invited_by: user.id,
        token,
        status: 'pending',
        expires_at: expiresAt,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] })
      toast({ title: 'Invitation Sent', description: 'The invitation link has been generated.' })
      reset()
      setShowInviteModal(false)
    },
    onError: (err: any) => {
      toast({ title: 'Invitation Failed', description: err.message, variant: 'destructive' })
    },
  })

  // Update Role Mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: WorkspaceRole }) => {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] })
      toast({ title: 'Role updated' })
    },
  })

  // Remove Member Mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('workspace_members').delete().eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] })
      toast({ title: 'Member removed' })
    },
  })

  // Revoke Invitation Mutation
  const revokeInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.from('workspace_invitations').delete().eq('id', invitationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] })
      toast({ title: 'Invitation Revoked' })
    },
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Team Members
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage who has access to {currentWorkspace?.name || 'this workspace'} and control permissions.
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Members Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace Members ({members?.length || 0})</CardTitle>
          <CardDescription>
            Roles control actions like managing campaigns, connecting email inboxes, or editing billing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {loadingMembers ? (
              <p className="py-4 text-sm text-muted-foreground">Loading workspace members...</p>
            ) : members?.map((m) => {
              const name = m.profile?.full_name || m.profile?.email || 'User'
              const initials = name.slice(0, 2).toUpperCase()
              return (
                <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar>
                      <AvatarImage src={m.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none truncate">{name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-1">{m.profile?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Select
                      defaultValue={m.role}
                      onValueChange={(val: WorkspaceRole) => updateRoleMutation.mutate({ memberId: m.id, newRole: val })}
                      disabled={m.role === 'owner'}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="campaign_manager">Campaign Manager</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>

                    {m.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Remove ${name} from this workspace?`)) {
                            removeMemberMutation.mutate(m.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Invitations ({invitations.length})
            </CardTitle>
            <CardDescription>People who have been invited but have not yet joined.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {invitations.map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited as <span className="capitalize font-semibold text-foreground">{inv.role.replace('_', ' ')}</span> · Sent {formatRelativeTime(inv.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => revokeInviteMutation.mutate(inv.id)}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a Team Member</DialogTitle>
            <DialogDescription>
              They will receive an invitation link to collaborate on this workspace.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit((data) => inviteMutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select defaultValue="member" onValueChange={(val: any) => setValue('role', val)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Full workspace control)</SelectItem>
                  <SelectItem value="campaign_manager">Campaign Manager (Edit campaigns & leads)</SelectItem>
                  <SelectItem value="member">Member (View campaigns & reply in Unibox)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || inviteMutation.isPending}>
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
