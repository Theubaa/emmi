import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Building2,
  UserPlus,
  Search,
  CheckCircle,
  Ban,
  Trash2,
  Edit2,
  Copy,
  Check,
  Send,
  Loader2,
  ExternalLink,
  MailCheck,
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

const inviteCustomerSchema = z.object({
  name: z.string().min(2, 'Company / Organization name is required'),
  ownerName: z.string().min(2, 'Customer admin name is required'),
  email: z.string().email('Valid customer email required'),
  plan: z.enum(['starter', 'growth', 'pro', 'enterprise']).default('starter'),
})

type InviteCustomerForm = z.infer<typeof inviteCustomerSchema>

interface InviteSuccessData {
  companyName: string
  ownerName: string
  email: string
  plan: string
  inviteLink?: string | null
}

export function AdminCustomersPage() {
  const [search, setSearch] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<InviteSuccessData | null>(null)

  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InviteCustomerForm>({
    resolver: zodResolver(inviteCustomerSchema),
    defaultValues: {
      plan: 'starter',
    },
  })

  const selectedPlan = watch('plan')

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

  // Invite Customer Mutation via Vercel /api/admin/invite-customer
  const inviteCustomerMutation = useMutation({
    mutationFn: async (data: InviteCustomerForm) => {
      const response = await fetch('/api/admin/invite-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || result.hint || 'Failed to send customer invitation.')
      }

      return {
        companyName: data.name,
        ownerName: data.ownerName,
        email: data.email,
        plan: data.plan,
        inviteLink: result.inviteLink || null,
      } as InviteSuccessData
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      queryClient.invalidateQueries({ queryKey: ['admin-workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin-overview'] })

      setShowInviteModal(false)
      setInviteSuccess(data)
      reset()
      toast({
        title: 'Invitation Sent!',
        description: `Customer invite email delivered to ${data.email}.`,
      })
    },
    onError: (err: any) => {
      toast({
        title: 'Invitation Failed',
        description: err.message,
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
      toast({ title: 'Customer Status Updated', description: `Account is now ${nextStatus}.` })
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
      toast({ title: 'Customer Deleted', description: 'Customer organization and linked workspaces removed.' })
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

  const emailTemplateText = inviteSuccess
    ? `Subject: You're invited to EMMIL - Cold Outreach Platform

Hi ${inviteSuccess.ownerName},

You have been invited to set up your cold outreach workspace on EMMIL.

Please click the link below to set your password and activate your account:
${inviteSuccess.inviteLink || 'https://emmi.vascularexpert.in/set-password'}

Company: ${inviteSuccess.companyName}
Plan: ${inviteSuccess.plan.toUpperCase()}
Email: ${inviteSuccess.email}

Once your password is set, you will be redirected to the sign-in page to access your campaigns.

Best regards,
EMMIL Team`
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
            Invite client companies, provision automated workspaces, and manage service tiers.
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
            onClick={() => setShowInviteModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white shrink-0 shadow-lg shadow-orange-600/20"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Customer
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
                <th className="p-3.5">Customer Admin Email</th>
                <th className="p-3.5">Plan Tier</th>
                <th className="p-3.5">Status</th>
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
                          if (confirm(`Are you sure you want to delete customer "${c.name}"? This will remove their workspaces.`)) {
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
                      Click the "Invite Customer" button above to send your first invitation.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invite Customer Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <UserPlus className="h-5 w-5 text-orange-500" />
              Invite Customer Organization
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              An invitation email will be delivered via Supabase Auth. The customer will click the link to set their password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit((d) => inviteCustomerMutation.mutate(d))} className="space-y-4">
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
                <Label className="text-xs text-zinc-300">Customer Email (For Invite)</Label>
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

            <div className="rounded-lg bg-orange-950/20 border border-orange-500/20 p-3">
              <p className="text-[11px] text-orange-300 leading-relaxed">
                Supabase Auth will dispatch a secure invitation link to their inbox. Upon setting their password, they will be redirected to the sign-in screen to enter their workspace.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowInviteModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20"
                disabled={isSubmitting || inviteCustomerMutation.isPending}
              >
                {(isSubmitting || inviteCustomerMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Customer Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Invitation Success Modal */}
      {inviteSuccess && (
        <Dialog open={!!inviteSuccess} onOpenChange={() => setInviteSuccess(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2 text-emerald-400">
                <MailCheck className="h-6 w-6" />
                <DialogTitle className="text-xl text-white">Invitation Dispatched!</DialogTitle>
              </div>
              <DialogDescription className="text-zinc-400 text-xs">
                The invitation email was sent to <span className="text-white font-medium">{inviteSuccess.email}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                  <span className="text-zinc-500">Organization</span>
                  <span className="text-white font-semibold">{inviteSuccess.companyName}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                  <span className="text-zinc-500">Admin Email</span>
                  <span className="text-zinc-200 select-all font-semibold">{inviteSuccess.email}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Plan</span>
                  <span className="text-orange-400 uppercase font-bold">{inviteSuccess.plan}</span>
                </div>
              </div>

              {inviteSuccess.inviteLink && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Direct Invitation Link (Backup / Instant Share):</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={inviteSuccess.inviteLink}
                      className="bg-zinc-950 border-zinc-800 text-xs font-mono text-zinc-300 h-9"
                    />
                    <Button
                      size="sm"
                      className="bg-zinc-800 hover:bg-zinc-700 text-white shrink-0"
                      onClick={() => copyToClipboard(inviteSuccess.inviteLink || '', 'link')}
                    >
                      {copiedKey === 'link' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs shadow-md shadow-orange-600/20"
                  onClick={() => copyToClipboard(emailTemplateText, 'emailText')}
                >
                  {copiedKey === 'emailText' ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                  Copy Invitation Message
                </Button>
              </div>

              <p className="text-[11px] text-zinc-500 text-center">
                The customer will click the link in their email, set their password, and then be redirected to the login page.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                className="border-zinc-700 text-white w-full"
                onClick={() => setInviteSuccess(null)}
              >
                Done
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
                  <option value="starter">Starter (5 Mailboxes)</option>
                  <option value="growth">Growth (20 Mailboxes)</option>
                  <option value="pro">Pro (50 Mailboxes)</option>
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
