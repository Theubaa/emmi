import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Trash2,
  Mail,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send,
  Key,
  Copy,
  Check,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Profile } from '@/types/database'

const userFormSchema = z.object({
  email: z.string().email('Valid email address required'),
  fullName: z.string().min(2, 'Full name required'),
  isSuperAdmin: z.boolean().default(false),
  method: z.enum(['invite', 'direct']).default('invite'),
  password: z.string().optional(),
})

type UserFormData = z.infer<typeof userFormSchema>

export function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [inviteSuccessLink, setInviteSuccessLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      isSuperAdmin: false,
      method: 'invite',
    },
  })

  const watchMethod = watch('method')
  const watchIsSuperAdmin = watch('isSuperAdmin')

  // Fetch all profiles
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['admin-profiles', search],
    queryFn: async () => {
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return (data || []) as Profile[]
    },
  })

  // Add / Invite user mutation
  const userMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      if (data.method === 'invite') {
        const response = await fetch('/api/admin/invite-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.email,
            fullName: data.fullName,
            isSuperAdmin: data.isSuperAdmin,
          }),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || result.hint || 'Failed to send invitation')
        }
        return { ...result, method: 'invite' }
      } else {
        if (!data.password || data.password.length < 8) {
          throw new Error('Password must be at least 8 characters')
        }
        const response = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            fullName: data.fullName,
            isSuperAdmin: data.isSuperAdmin,
          }),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || result.hint || 'Failed to create user')
        }
        return { ...result, method: 'direct' }
      }
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin-overview'] })

      if (result.method === 'invite') {
        toast({
          title: 'Invitation Delivered!',
          description: `Supabase invite email sent to ${variables.email}.`,
        })
        if (result.inviteLink) {
          setInviteSuccessLink(result.inviteLink)
        } else {
          setShowModal(false)
          reset()
        }
      } else {
        toast({
          title: 'User Created',
          description: `Account for ${variables.email} has been provisioned.`,
        })
        setShowModal(false)
        reset()
      }
    },
    onError: (err: any) => {
      toast({
        title: 'Operation Failed',
        description: err.message,
        variant: 'destructive',
      })
    },
  })

  // Toggle Super Admin status
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ id, isSuperAdmin }: { id: string; isSuperAdmin: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_super_admin: !isSuperAdmin })
        .eq('id', id)
      if (error) throw error
      return !isSuperAdmin
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
      toast({
        title: 'Privilege Updated',
        description: `Super admin status changed to ${newStatus ? 'Admin' : 'Standard User'}.`,
      })
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' })
    },
  })

  // Delete user via API
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || result.hint || 'Failed to delete user')
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin-overview'] })
      toast({ title: 'User Deleted', description: 'User account has been removed.' })
    },
    onError: (err: any) => {
      toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' })
    },
  })

  const copyLink = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Invite link copied' })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Users className="h-6 w-6 text-orange-500" />
            User Management
          </h1>
          <p className="text-zinc-400 text-sm">
            Invite platform users, promote administrators, and manage authentication accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>
          <Button
            onClick={() => {
              setInviteSuccessLink(null)
              setShowModal(true)
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white shrink-0 shadow-lg shadow-orange-600/20"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Provision / Invite User
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                <th className="p-3.5">User</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Super Admin</th>
                <th className="p-3.5">Created</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-sm text-zinc-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-zinc-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-orange-500" />
                    Loading accounts...
                  </td>
                </tr>
              ) : profiles && profiles.length > 0 ? (
                profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="p-3.5 font-semibold text-white flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs">
                        {(p.full_name || p.email).substring(0, 2).toUpperCase()}
                      </div>
                      <span>{p.full_name || 'No Name'}</span>
                    </td>
                    <td className="p-3.5 text-zinc-400 font-mono text-xs">{p.email}</td>
                    <td className="p-3.5">
                      <Badge
                        variant={p.is_super_admin ? 'outline' : 'secondary'}
                        className={
                          p.is_super_admin
                            ? 'border-orange-500/40 text-orange-400 bg-orange-500/10'
                            : 'bg-zinc-800 text-zinc-300'
                        }
                      >
                        {p.is_super_admin ? 'Super Admin' : 'Standard User'}
                      </Badge>
                    </td>
                    <td className="p-3.5">
                      <Switch
                        checked={p.is_super_admin}
                        onCheckedChange={() =>
                          toggleAdminMutation.mutate({ id: p.id, isSuperAdmin: p.is_super_admin })
                        }
                        disabled={toggleAdminMutation.isPending}
                      />
                    </td>
                    <td className="p-3.5 text-xs text-zinc-400">
                      {formatRelativeTime(p.created_at)}
                    </td>
                    <td className="p-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete user ${p.email}?`)) {
                            deleteUserMutation.mutate(p.id)
                          }
                        }}
                        disabled={deleteUserMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-zinc-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Provision User Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <UserPlus className="h-5 w-5 text-orange-500" />
              Provision or Invite User
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Send an email invitation via Supabase Auth or create an account directly.
            </DialogDescription>
          </DialogHeader>

          {inviteSuccessLink ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-3 flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-200">
                  <p className="font-semibold">Invitation Email Dispatched!</p>
                  <p className="mt-0.5 text-emerald-300/80">
                    The user has received an activation link in their inbox to set their password.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Direct Activation Link (Backup):</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={inviteSuccessLink}
                    className="bg-zinc-950 border-zinc-800 text-xs font-mono text-zinc-300 h-9"
                  />
                  <Button
                    size="sm"
                    className="bg-zinc-800 hover:bg-zinc-700 text-white shrink-0"
                    onClick={() => copyLink(inviteSuccessLink)}
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => {
                    setShowModal(false)
                    setInviteSuccessLink(null)
                    reset()
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit((d) => userMutation.mutate(d))} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Delivery Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setValue('method', 'invite')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      watchMethod === 'invite'
                        ? 'border-orange-500/50 bg-orange-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-orange-400" />
                      <span className="text-xs font-medium">Send Email Invite</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">User sets their own password</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue('method', 'direct')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      watchMethod === 'direct'
                        ? 'border-orange-500/50 bg-orange-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-orange-400" />
                      <span className="text-xs font-medium">Set Password</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Provide temporary password</p>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Full Name</Label>
                <Input
                  placeholder="e.g. Sarah Jenkins"
                  className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600"
                  {...register('fullName')}
                />
                {errors.fullName && <p className="text-xs text-rose-400">{errors.fullName.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Email Address</Label>
                <Input
                  type="email"
                  placeholder="user@company.com"
                  className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600"
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
              </div>

              {watchMethod === 'direct' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Temporary Password</Label>
                  <Input
                    type="password"
                    placeholder="Minimum 8 characters"
                    className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600"
                    {...register('password')}
                  />
                  {errors.password && <p className="text-xs text-rose-400">{errors.password.message}</p>}
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg bg-zinc-950 border border-zinc-800 p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="super-admin-toggle" className="text-xs text-zinc-200 cursor-pointer">
                    Grant Super Administrator
                  </Label>
                  <p className="text-[11px] text-zinc-500">
                    Provides root access to the /super-user console.
                  </p>
                </div>
                <Switch
                  id="super-admin-toggle"
                  checked={watchIsSuperAdmin}
                  onCheckedChange={(checked) => setValue('isSuperAdmin', checked)}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20"
                  disabled={isSubmitting || userMutation.isPending}
                >
                  {(isSubmitting || userMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {watchMethod === 'invite' ? 'Dispatch Invitation' : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
