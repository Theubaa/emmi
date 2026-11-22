import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Upload, Download, Search, Filter, Trash2, UserPlus, Mail, Building, Briefcase } from 'lucide-react'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AddLeadDialog } from './AddLeadDialog'
import type { Lead } from '@/types/database'

const statusColors: Record<string, string> = {
  active: 'success',
  contacted: 'secondary',
  replied: 'default',
  converted: 'success',
  unsubscribed: 'secondary',
  bounced: 'destructive',
  invalid: 'destructive',
}

export function LeadsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  const [showAddLead, setShowAddLead] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { currentWorkspace } = useAuthStore()
  const workspaceId = currentWorkspace?.id
  const queryClient = useQueryClient()

  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads', workspaceId, search, statusFilter],
    queryFn: async () => {
      if (!workspaceId) return []
      let query = supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (search) {
        query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`)
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Lead[]
    },
    enabled: !!workspaceId,
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('leads').delete().in('id', ids).eq('workspace_id', workspaceId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', workspaceId] })
      setSelected([])
      toast({ title: 'Leads deleted', description: `${selected.length} lead(s) removed.` })
    },
  })

  const handleCSVImport = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[]
        if (!rows.length) {
          toast({ title: 'Empty CSV', description: 'No data found in the file.', variant: 'destructive' })
          return
        }

        const leads = rows.map((row) => ({
          workspace_id: workspaceId!,
          email: row.email || row.Email || row.EMAIL || '',
          first_name: row.first_name || row['First Name'] || row.firstName || null,
          last_name: row.last_name || row['Last Name'] || row.lastName || null,
          company: row.company || row.Company || null,
          job_title: row.job_title || row['Job Title'] || row.jobTitle || null,
          phone: row.phone || row.Phone || null,
          website: row.website || row.Website || null,
          status: 'active' as const,
          email_validation_status: 'unknown' as const,
          custom_fields: {},
          tags: [],
          unsubscribed: false,
          bounced: false,
        })).filter(l => l.email)

        if (!leads.length) {
          toast({ title: 'No valid leads', description: 'Make sure your CSV has an "email" column.', variant: 'destructive' })
          return
        }

        const { error } = await supabase.from('leads').upsert(leads, { onConflict: 'workspace_id,email', ignoreDuplicates: true })
        if (error) {
          toast({ title: 'Import failed', description: error.message, variant: 'destructive' })
        } else {
          queryClient.invalidateQueries({ queryKey: ['leads', workspaceId] })
          toast({ title: 'Import complete', description: `${leads.length} leads imported.` })
        }
      },
      error: () => {
        toast({ title: 'Parse error', description: 'Could not parse the CSV file.', variant: 'destructive' })
      },
    })
  }

  const handleCSVExport = () => {
    if (!leads?.length) return
    const csv = Papa.unparse(leads.map(l => ({
      email: l.email,
      first_name: l.first_name,
      last_name: l.last_name,
      company: l.company,
      job_title: l.job_title,
      phone: l.phone,
      website: l.website,
      status: l.status,
    })))
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (!leads) return
    setSelected(prev => prev.length === leads.length ? [] : leads.map(l => l.id))
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            {leads ? `${leads.length} leads` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleCSVImport(e.target.files[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleCSVExport} disabled={!leads?.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddLead(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, company..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>

        {selected.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { if (confirm(`Delete ${selected.length} lead(s)?`)) deleteMutation.mutate(selected) }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete ({selected.length})
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-4 w-10">
                  <Checkbox
                    checked={leads?.length ? selected.length === leads.length : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="p-4 text-left text-sm font-medium text-muted-foreground">Email</th>
                <th className="p-4 text-left text-sm font-medium text-muted-foreground">Name</th>
                <th className="p-4 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">Company</th>
                <th className="p-4 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">Title</th>
                <th className="p-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                <th className="p-4 text-left text-sm font-medium text-muted-foreground hidden xl:table-cell">Added</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-4"><Skeleton className="h-4 w-4" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-48" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="p-4 hidden md:table-cell"><Skeleton className="h-4 w-28" /></td>
                    <td className="p-4 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="p-4 hidden xl:table-cell"><Skeleton className="h-4 w-20" /></td>
                  </tr>
                ))
              ) : leads?.length ? (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <Checkbox checked={selected.includes(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-sm font-medium">{lead.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm">
                        {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '-'}
                      </span>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        {lead.company && <Building className="h-3 w-3" />}
                        {lead.company || '-'}
                      </div>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        {lead.job_title && <Briefcase className="h-3 w-3" />}
                        {lead.job_title || '-'}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={statusColors[lead.status] as any || 'secondary'}>
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="p-4 hidden xl:table-cell">
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(lead.created_at)}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <UserPlus className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">No leads found</p>
                      <p className="text-sm text-muted-foreground">Import a CSV or add leads manually to get started</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-4 w-4 mr-2" /> Import CSV
                        </Button>
                        <Button size="sm" onClick={() => setShowAddLead(true)}>
                          <Plus className="h-4 w-4 mr-2" /> Add Lead
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AddLeadDialog open={showAddLead} onOpenChange={setShowAddLead} workspaceId={workspaceId!} />
    </div>
  )
}
