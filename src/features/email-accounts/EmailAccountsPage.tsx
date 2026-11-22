import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Mail, Wifi, WifiOff, AlertCircle, RefreshCw, Trash2, Settings2, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConnectEmailDialog } from './ConnectEmailDialog'
import type { EmailAccount } from '@/types/database'

function StatusBadge({ status }: { status: EmailAccount['status'] }) {
  const variants: Record<EmailAccount['status'], { icon: React.ElementType; label: string; variant: string }> = {
    connected: { icon: CheckCircle, label: 'Connected', variant: 'success' },
    disconnected: { icon: WifiOff, label: 'Disconnected', variant: 'secondary' },
    error: { icon: AlertCircle, label: 'Error', variant: 'destructive' },
    syncing: { icon: RefreshCw, label: 'Syncing', variant: 'warning' },
  }
  const { icon: Icon, label, variant } = variants[status]
  return (
    <Badge variant={variant as any}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  )
}

const providerLabels: Record<string, string> = {
  gmail: 'Gmail',
  google_workspace: 'Google Workspace',
  microsoft365: 'Microsoft 365',
  outlook: 'Outlook',
  zoho: 'Zoho Mail',
  custom: 'Custom IMAP/SMTP',
}

export function EmailAccountsPage() {
  const [showConnect, setShowConnect] = useState(false)
  const { currentWorkspace } = useAuthStore()
  const workspaceId = currentWorkspace?.id
  const queryClient = useQueryClient()

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['email-accounts', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as EmailAccount[]
    },
    enabled: !!workspaceId,
  })

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.from('email_accounts').delete().eq('id', accountId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts', workspaceId] })
      toast({ title: 'Account removed', description: 'Email account has been disconnected.' })
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    },
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Accounts</h1>
          <p className="text-muted-foreground">Connect and manage your email sending accounts</p>
        </div>
        <Button onClick={() => setShowConnect(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Connect Account
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['Total', 'Connected', 'Errors', 'Syncing'].map((label, i) => {
          const counts = accounts
            ? [
                accounts.length,
                accounts.filter(a => a.status === 'connected').length,
                accounts.filter(a => a.status === 'error').length,
                accounts.filter(a => a.status === 'syncing').length,
              ]
            : [0, 0, 0, 0]
          return (
            <Card key={label}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{counts[i]}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Account list */}
      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts && accounts.length > 0 ? (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <Card key={account.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Mail className="h-6 w-6 text-blue-500" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{account.email}</h3>
                      <StatusBadge status={account.status} />
                      <Badge variant="outline">{providerLabels[account.provider] || account.provider}</Badge>
                    </div>
                    {account.display_name && (
                      <p className="text-sm text-muted-foreground mt-0.5">{account.display_name}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {account.smtp_host && (
                        <span>SMTP: {account.smtp_host}:{account.smtp_port}</span>
                      )}
                      {account.imap_host && (
                        <span>IMAP: {account.imap_host}:{account.imap_port}</span>
                      )}
                      <span>Sent today: {account.emails_sent_today}/{account.daily_send_limit}</span>
                      {account.last_sync_at && (
                        <span>Last sync: {formatRelativeTime(account.last_sync_at)}</span>
                      )}
                    </div>
                    {account.error_message && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {account.error_message}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toast({ title: 'Coming soon', description: 'Account settings will be available soon.' })}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm('Remove this email account?')) {
                          deleteMutation.mutate(account.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No email accounts connected</h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
              Connect your email accounts to start sending campaigns and managing your inbox.
            </p>
            <Button onClick={() => setShowConnect(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Your First Account
            </Button>
          </CardContent>
        </Card>
      )}

      <ConnectEmailDialog
        open={showConnect}
        onOpenChange={setShowConnect}
        workspaceId={workspaceId!}
      />
    </div>
  )
}
