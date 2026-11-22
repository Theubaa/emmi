import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layers, Search, Ban, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { Workspace } from '@/types/database'

export function AdminWorkspacesPage() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['admin-workspaces', search],
    queryFn: async () => {
      let query = supabase.from('workspaces').select('*').order('created_at', { ascending: false })
      if (search) {
        query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return (data || []) as Workspace[]
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'suspended' }) => {
      const nextStatus = status === 'active' ? 'suspended' : 'active'
      const { error } = await supabase.from('workspaces').update({ status: nextStatus }).eq('id', id)
      if (error) throw error
      return nextStatus
    },
    onSuccess: (nextStatus) => {
      queryClient.invalidateQueries({ queryKey: ['admin-workspaces'] })
      toast({ title: 'Workspace updated', description: `Workspace status set to ${nextStatus}.` })
    },
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-orange-500" />
            Workspaces Directory
          </h1>
          <p className="text-muted-foreground text-sm">
            All tenant organizations created across the multi-tenant system.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search workspace..."
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
                <th className="p-3">Workspace</th>
                <th className="p-3">Slug / Domain</th>
                <th className="p-3">Timezone</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading workspaces...
                  </td>
                </tr>
              ) : workspaces && workspaces.length > 0 ? (
                workspaces.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold">{w.name}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">/{w.slug}</td>
                    <td className="p-3 text-xs">{w.settings?.timezone || 'UTC'}</td>
                    <td className="p-3">
                      <Badge variant={w.status === 'active' ? 'success' : 'destructive'}>
                        {w.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {formatRelativeTime(w.created_at)}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatusMutation.mutate({ id: w.id, status: w.status })}
                      >
                        {w.status === 'active' ? (
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
                    No workspaces found.
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
