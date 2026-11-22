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
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Send,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
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

function generateStrongPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
  let pw = ''
  for (let i = 0; i < 12; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return 'Emmi#' + pw
}

const createCustomerSchema = z.object({
  name: z.string().min(2, 'Company / Organization name is required'),
  ownerName: z.string().min(2, 'Owner / Contact person name is required'),
  email: z.string().email('Valid customer login email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  plan: z.enum(['starter', 'growth', 'pro', 'enterprise']).default('starter'),
  status: z.enum(['active', 'trial', 'suspended']).default('active'),
})

type CreateCustomerForm = z.infer<typeof createCustomerSchema>

interface CreatedCredentials {
  companyName: string
  ownerName: string
  email: string
  password: string
  plan: string
}

export function AdminCustomersPage() {
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null)

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
      password: generateStrongPassword(),
    },
  })

  const selectedPlan = watch('plan')
  const selectedStatus = watch('status')

  // Fetch all customers
  const { data: customers, isLoading } = useQuery({
    queryKey: ['admin-customers', search],
    queryFn: async () => {
      let query = supabase.from('customers').select('*').order('created_at', { ascending: false })
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return (data || []) as Customer[]
    },
  })

  // Onboard customer mutation (Customer Org + Workspace + Admin User Login)
  const createCustomerMutation = useMutation({
    mutationFn: async (data: CreateCustomerForm) => {
      // 1. Try master RPC onboard_new_customer
      try {
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('onboard_new_customer', {
          company_name: data.name,
          owner_email: data.email,
          owner_password: data.password,
          owner_full_name: data.ownerName,
          plan_tier: data.plan,
        })

        if (!rpcError && rpcData) {
          return {
            companyName: data.name,
            ownerName: data.ownerName,
            email: data.email,
            password: data.password,
            plan: data.plan,
          }
        }

        if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
          throw new Error(rpcError.message)
        }
      } catch (err: any) {
        if (!err.message?.includes('function') && !err.message?.includes('does not exist')) {
          throw err
        }
      }

      // 2. Direct fallback: insert customer + workspace + user
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

      // Create workspace
      const wsSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6)
      const { data: ws } = await supabase
        .from('workspaces')
        .insert({
          customer_id: customer.id,
          name: `${data.name} Workspace`,
          slug: wsSlug,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      // Create user login account via RPC or API
      try {
        await (supabase.rpc as any)('create_new_user', {
          user_email: data.email,
          user_password: data.password,
          user_name: data.ownerName,
          make_super_admin: false,
        })
      } catch {
        // Fallback to API
        await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            fullName: data.ownerName,
            isSuperAdmin: false,
          }),
        })
      }

      return {
        companyName: data.name,
        ownerName: data.ownerName,
        email: data.email,
        password: data.password,
        plan: data.plan,
      }
    },
    onSuccess: (credentials) => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      queryClient.invalidateQueries({ queryKey: ['admin-workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin-overview'] })

      setShowCreateModal(false)
      setCreatedCredentials(credentials)
      reset()
    },
    onError: (err: any) => {
      toast({
        title: 'Customer Onboarding Failed',
        description: err.message || 'Could not provision customer organization and login.',
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

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
    toast({ title: 'Copied to Clipboard' })
  }

  const welcomeEmailText = createdCredentials
    ? `Subject: Welcome to EMMIL - Your Workspace Login Credentials

Hi ${createdCredentials.ownerName},

Your EMMIL cold outreach workspace has been provisioned!

Login Portal: https://emmi.vascularexpert.in/login
Email: ${createdCredentials.email}
Password: ${createdCredentials.password}

Plan Tier: ${createdCredentials.plan.toUpperCase()}

Next Steps:
1. Log in to your workspace at https://emmi.vascularexpert.in/login
2. Connect your sending email accounts (Google, Outlook, or Custom SMTP/IMAP)
3. Upload your leads and launch your first email outreach campaign.

Best regards,
EMMIL Administrator Team`
    : ''

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
            Onboard client organizations, generate initial login credentials, and manage service tiers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search by company or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>
          <Button
            onClick={() => {
              setValue('password', generateStrongPassword())
              setShowCreateModal(true)
            }}
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
                <th className="p-3.5">Admin Email</th>
                <th className="p-3.5">Plan Tier</th>
                <th className="p-3.5">Account Status</th>
                <th className="p-3.5">Registered</th>
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

      {/* Onboard Customer Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5 text-orange-500" />
              Onboard New Customer & Login Account
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              This provisions their company workspace, creates the customer login, and sets their password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit((d) => createCustomerMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Company / Organization Name</Label>
              <Input
                placeholder="e.g. Acme Health Corp"
                className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600"
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-rose-400">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Customer Admin Name</Label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600"
                  {...register('ownerName')}
                />
                {errors.ownerName && <p className="text-xs text-rose-400">{errors.ownerName.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Customer Login Email</Label>
                <Input
                  type="email"
                  placeholder="admin@acmehealth.com"
                  className="bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600"
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-300">Password for Customer</Label>
                <button
                  type="button"
                  onClick={() => setValue('password', generateStrongPassword())}
                  className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 font-mono"
                >
                  <Sparkles className="h-3 w-3" /> Generate Random
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  className="bg-zinc-950 border-zinc-700 text-white font-mono placeholder:text-zinc-600 pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-rose-400">{errors.password.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Plan Tier</Label>
                <Select
                  value={selectedPlan}
                  onValueChange={(val: any) => setValue('plan', val)}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-700 text-white">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="starter">Starter (5 Mailboxes)</SelectItem>
                    <SelectItem value="growth">Growth (20 Mailboxes)</SelectItem>
                    <SelectItem value="pro">Pro (50 Mailboxes)</SelectItem>
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

            <div className="rounded-lg bg-orange-950/20 border border-orange-500/20 p-3">
              <p className="text-[11px] text-orange-300 leading-relaxed">
                A dedicated workspace will be auto-generated and linked to this user as Owner. On submission, you will receive their login link and credentials to share with them.
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
                Create Customer & Login
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Credentials Ready Success Modal */}
      {createdCredentials && (
        <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="h-6 w-6" />
                <DialogTitle className="text-xl text-white">Customer Provisioned Successfully!</DialogTitle>
              </div>
              <DialogDescription className="text-zinc-400 text-xs">
                The customer organization, workspace, and login credentials have been created.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                  <span className="text-zinc-500">Portal URL</span>
                  <span className="text-orange-400 font-bold select-all">https://emmi.vascularexpert.in/login</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                  <span className="text-zinc-500">Customer</span>
                  <span className="text-white font-semibold">{createdCredentials.companyName}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                  <span className="text-zinc-500">Login Email</span>
                  <span className="text-zinc-200 select-all font-semibold">{createdCredentials.email}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Password</span>
                  <span className="text-emerald-400 font-bold select-all">{createdCredentials.password}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs"
                  onClick={() =>
                    copyToClipboard(
                      `Portal: https://emmi.vascularexpert.in/login\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`,
                      'creds'
                    )
                  }
                >
                  {copiedKey === 'creds' ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  Copy Login & Password
                </Button>

                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs shadow-md shadow-orange-600/20"
                  onClick={() => copyToClipboard(welcomeEmailText, 'emailText')}
                >
                  {copiedKey === 'emailText' ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                  Copy Welcome Email Text
                </Button>
              </div>

              <p className="text-[11px] text-zinc-500 text-center">
                You can send these credentials directly to the customer via Email, WhatsApp, or Slack.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                className="border-zinc-700 text-white w-full"
                onClick={() => setCreatedCredentials(null)}
              >
                Close & Return to Customer Directory
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
