import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Building2,
  Plus,
  Search,
  CheckCircle,
  Ban,
  Trash2,
  Edit2,
  Layers,
  Mail,
  Loader2,
  Calendar,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Customer } from '@/types/database'

const createCustomerSchema = z.object({
  name: z.string().min(2, 'Customer / Organization name is required'),
  email: z.string().email('Valid billing/admin email required'),
  plan: z.enum(['starter', 'growth', 'pro', 'enterprise']).default('starter'),
  status: z.enum(['active', 'trial', 'suspended']).default('active'),
  createWorkspace: z.boolean().default(true),
  workspaceName: z.string().optional(),
})

type CreateCustomerForm = z.infer<typeof createCustomerSchema>

export function AdminCustomersPage() {
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateCustomerForm>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      plan: 'starter',
      status: 'active',
      createWorkspace: true,
    },
  })

  const selectedPlan = watch('plan')
  const selectedStatus = watch('status')

  // Fetch all customers with their linked workspaces count
  const { data: customers, isLoading } = useQuery({
    queryKey: ['admin-customers', search],
    queryFn: async () => {
      let query = supabase.from('customers').select('*').order('created_at', { ascending: false })
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) {
        console.error('Error fetching customers:', error)
        throw error
      }
      return (data || []) as Customer[]
    },
  })

  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (data: CreateCustomerForm) => {
      // 1. Insert customer
      const { data: customer, error: customerErr } = await supabase
        .from('customers')
        .insert({
          name: data.name,
          email: data.email,
          plan: data.plan,
          status: data.status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (customerErr) throw customerErr

      // 2. Optional: Create initial workspace
      if (data.createWorkspace && customer) {
        const wsName = data.workspaceName?.trim() || `${data.name} Workspace`
        const wsSlug = wsName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6)

        await supabase.from('workspaces').insert({
          customer_id: customer.id,
          name: wsName,
          slug: wsSlug,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      return customer
    },
    onSuccess: (newCust) => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin-overview'] })
      toast({
        title: 'Customer Created',
        description: `Customer account "${newCust?.name}" has been created successfully.`,
      })
      reset()
      setShowCreateModal(false)
    },
    onError: (err: any) => {
      toast({
        title: 'Creation Failed',
        description: err.message || 'Could not create customer account.',
        variant: 'destructive',
      })
    },
  })

  // Toggle status mutation (active <-> suspended)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'suspended' | 'trial' }) => {
      const nextStatus = status === 'active' ? 'suspended' : 'active'
      const { error } = await supabase
        .from('customers')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      return nextStatus
    },
    onSuccess: (nextStatus) => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin-overview'] })
      toast({ title: 'Customer Status Updated', description: `Account status is now ${nextStatus}.` })
    },
    onError: (err: any) => {
      toast({ title: 'Status Update Failed', description: err.message, variant: 'destructive' })
    },
  })

  // Edit customer details
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, plan, status }: { id: string; plan: string; status: string }) => {
      const { error } = await supabase
        .from('customers')
        .update({ plan, status, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      toast({ title: 'Customer Updated', description: 'Customer details have been saved.' })
      setEditingCustomer(null)
    },
    onError: (err: any) => {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' })
    },
  })

  // Delete customer mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', customerId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin-overview'] })
      toast({ title: 'Customer Deleted', description: 'Customer account and related workspaces removed.' })
    },
    onError: (err: any) => {
      toast({ title: 'Deletion Failed', description: err.message, variant: 'destructive' })
    },
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Building2 className="h-6 w-6 text-orange-500" />
            Customer Organizations
          </h1>
          <p className="text-zinc-400 text-sm">
            Manage client tenant accounts, subscription plans, and service status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white shrink-0 shadow-lg shadow-orange-600/20"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Customers Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                <th className="p-3.5">Organization</th>
                <th className="p-3.5">Contact Email</th>
                <th className="p-3.5">Subscription Plan</th>
                <th className="p-3.5">Account Status</th>
                <th className="p-3.5">Created Date</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-sm text-zinc-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-zinc-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-orange-500" />
                    Loading customer accounts...
                  </td>
                </tr>
              ) : customers && customers.length > 0 ? (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="p-3.5 font-semibold text-white flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs">
                        {c.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span>{c.name}</span>
                    </td>
                    <td className="p-3.5 text-zinc-400 font-mono text-xs">{c.email}</td>
                    <td className="p-3.5">
                      <Badge
                        variant="outline"
                        className="capitalize font-mono text-[11px] border-zinc-700 bg-zinc-800 text-zinc-300"
                      >
                        {c.plan || 'starter'}
                      </Badge>
                    </td>
                    <td className="p-3.5">
                      <Badge
                        variant={c.status === 'active' ? 'success' : c.status === 'trial' ? 'secondary' : 'destructive'}
                        className="capitalize font-medium text-xs"
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-xs text-zinc-400">
                      {formatRelativeTime(c.created_at)}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                        onClick={() => setEditingCustomer(c)}
                        title="Edit Plan / Status"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className={`border-zinc-700 ${
                          c.status === 'active'
                            ? 'hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800'
                            : 'hover:bg-emerald-950/40 hover:text-emerald-400 hover:border-emerald-800'
                        }`}
                        onClick={() => toggleStatusMutation.mutate({ id: c.id, status: c.status as any })}
                      >
                        {c.status === 'active' ? (
                          <>
                            <Ban className="h-3.5 w-3.5 mr-1 text-rose-400" />
                            Suspend
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                            Activate
                          </>
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete customer "${c.name}"? This action cannot be undone.`)) {
                            deleteCustomerMutation.mutate(c.id)
                          }
                        }}
                        title="Delete Customer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-zinc-500 space-y-3">
                    <Building2 className="h-10 w-10 mx-auto text-zinc-600 mb-2 opacity-50" />
                    <p className="text-base text-zinc-400">No customer accounts registered yet.</p>
                    <p className="text-xs text-zinc-500">
                      Click the "Add Customer" button above to register your first client organization.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Customer Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5 text-orange-500" />
              Register New Customer Organization
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Provision a new client tenant with dedicated workspaces and tier limits.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit((d) => createCustomerMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Customer / Company Name</Label>
              <Input
                placeholder="e.g. Acme Health Corp"
                className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600"
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-rose-400">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Primary Billing & Contact Email</Label>
              <Input
                type="email"
                placeholder="billing@acmehealth.com"
                className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Subscription Tier</Label>
                <Select
                  value={selectedPlan}
                  onValueChange={(val: any) => setValue('plan', val)}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-700 text-white">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="starter">Starter (5 Accounts)</SelectItem>
                    <SelectItem value="growth">Growth (20 Accounts)</SelectItem>
                    <SelectItem value="pro">Pro (50 Accounts)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (Unlimited)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Initial Status</Label>
                <Select
                  value={selectedStatus}
                  onValueChange={(val: any) => setValue('status', val)}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-700 text-white">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-ws" className="text-xs text-zinc-300 font-medium cursor-pointer">
                  Automatically Provision Initial Workspace
                </Label>
                <input
                  id="auto-ws"
                  type="checkbox"
                  className="rounded border-zinc-700 text-orange-600 focus:ring-orange-500 bg-zinc-900"
                  defaultChecked
                  {...register('createWorkspace')}
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                Creates a default working environment for this customer to connect mailboxes and run outreach campaigns.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20"
                disabled={isSubmitting || createCustomerMutation.isPending}
              >
                {(isSubmitting || createCustomerMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save & Provision Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Edit2 className="h-5 w-5 text-orange-500" />
                Edit Customer: {editingCustomer.name}
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Update billing plan tier and operational status.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Plan Tier</Label>
                <select
                  defaultValue={editingCustomer.plan || 'starter'}
                  id="edit-plan-select"
                  className="w-full h-10 px-3 rounded-md bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="starter">Starter (5 Accounts)</option>
                  <option value="growth">Growth (20 Accounts)</option>
                  <option value="pro">Pro (50 Accounts)</option>
                  <option value="enterprise">Enterprise (Unlimited)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Status</Label>
                <select
                  defaultValue={editingCustomer.status || 'active'}
                  id="edit-status-select"
                  className="w-full h-10 px-3 rounded-md bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingCustomer(null)}
                className="text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20"
                onClick={() => {
                  const plan = (document.getElementById('edit-plan-select') as HTMLSelectElement).value
                  const status = (document.getElementById('edit-status-select') as HTMLSelectElement).value
                  updateCustomerMutation.mutate({ id: editingCustomer.id, plan, status })
                }}
                disabled={updateCustomerMutation.isPending}
              >
                {updateCustomerMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
