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
  Lock,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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

const createUserSchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name required'),
  isSuperAdmin: z.boolean().default(false),
})

type CreateUserForm = z.infer<typeof createUserSchema>

export function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      isSuperAdmin: false,
    },
  })

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

  // Create user via backend API
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user')
      }
      return result
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin-overview'] })
      toast({
        title: 'User Created Successfully',
        description: `Account for ${variables.email} has been provisioned.`,
      })
      reset()
      setShowCreateModal(false)
    },
    onError: (err: any) => {
      toast({
        title: 'User Creation Failed',
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
        description: `User super admin status changed to ${newStatus ? 'Admin' : 'Standard User'}.`,
      })
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' })
    },
  })

  // Delete user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user')
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-orange-500" />
            User Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Create and manage platform user credentials directly from Super Admin.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                <th className="p-3">User</th>
                <th className="p-3">Email</th>
                <th className="p-3">Super Admin</th>
                <th className="p-3">Joined Date</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Loading users...
                  </td>
                </tr>
              ) : profiles && profiles.length > 0 ? (
                profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold">{p.full_name || 'Unnamed User'}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{p.email}</td>
                    <td className="p-3">
                      {p.is_super_admin ? (
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 gap-1">
                          <ShieldCheck className="h-3 w-3" /> Super Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Standard User
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {formatRelativeTime(p.created_at)}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleAdminMutation.mutate({
                            id: p.id,
                            isSuperAdmin: p.is_super_admin,
                          })
                        }
                      >
                        {p.is_super_admin ? 'Demote' : 'Make Super Admin'}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete user ${p.email}?`)) {
                            deleteUserMutation.mutate(p.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-orange-500" />
              Create New Platform User
            </DialogTitle>
            <DialogDescription>
              Provision a new user account with login credentials directly from Super Admin.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                {...register('fullName')}
              />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Initial Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 8 characters"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
              <div className="space-y-0.5">
                <Label htmlFor="super-admin-toggle" className="text-sm font-medium">Grant Super Admin Privileges</Label>
                <p className="text-xs text-muted-foreground">Allows access to global admin panel and all workspaces</p>
              </div>
              <Switch
                id="super-admin-toggle"
                checked={watchIsSuperAdmin}
                onCheckedChange={(val) => setValue('isSuperAdmin', val)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={isSubmitting || createUserMutation.isPending}
              >
                {createUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
