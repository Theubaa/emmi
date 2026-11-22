import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Search, ShieldAlert, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatRelativeTime } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AuditLog } from '@/types/database'

export function AdminAuditLogsPage() {
  const [search, setSearch] = useState('')

  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin-audit-logs', search],
    queryFn: async () => {
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
      if (search) {
        query = query.or(`action.ilike.%${search}%,resource_type.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return (data || []) as AuditLog[]
    },
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-orange-500" />
            Security Audit Trail
          </h1>
          <p className="text-muted-foreground text-sm">
            Immutable log of high-privilege operations, authentication changes, and tenant updates.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search action or resource..."
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
                <th className="p-3">Action</th>
                <th className="p-3">Resource</th>
                <th className="p-3">User ID</th>
                <th className="p-3">Workspace ID</th>
                <th className="p-3">IP Address</th>
                <th className="p-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading security audit logs...
                  </td>
                </tr>
              ) : logs && logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold font-mono text-xs">{log.action}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {log.resource_type}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                      {log.user_id || 'System'}
                    </td>
                    <td className="p-3 text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                      {log.workspace_id || 'Global'}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{log.ip_address || '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {formatRelativeTime(log.created_at)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No audit events recorded yet.
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
