import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Search, CheckCircle, Ban, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Customer } from '@/types/database'

export function AdminCustomersPage() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

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

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'suspended' }) => {
      const nextStatus = status === 'active' ? 'suspended' : 'active'
      const { error } = await supabase.from('customers').update({ status: nextStatus }).eq('id', id)
      if (error) throw error
      return nextStatus
    },
    onSuccess: (nextStatus) => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      toast({ title: 'Customer status updated', description: `Customer is now ${nextStatus}.` })
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' })
    },
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-orange-500" />
            Customer Accounts
          </h1>
          <p className="text-muted-foreground text-sm">
            View, suspend, or reactivate platform-wide customer accounts.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                <th className="p-3">Customer Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Registered</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading customer accounts...
                  </td>
                </tr>
              ) : customers && customers.length > 0 ? (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold">{c.name}</td>
                    <td className="p-3 text-muted-foreground">{c.email}</td>
                    <td className="p-3 capitalize">{c.plan || 'Free / Trial'}</td>
                    <td className="p-3">
                      <Badge variant={c.status === 'active' ? 'success' : 'destructive'}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {formatRelativeTime(c.created_at)}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatusMutation.mutate({ id: c.id, status: c.status as any })}
                      >
                        {c.status === 'active' ? (
                          <>
                            <Ban className="h-3.5 w-3.5 mr-1 text-destructive" /> Suspend
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Activate
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
