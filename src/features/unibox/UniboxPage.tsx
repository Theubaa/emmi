import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Star, Archive, Mail, Reply, Forward, Tag, ChevronDown, Inbox, Circle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTime, truncate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { Conversation, EmailMessage } from '@/types/database'

function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation & { email_account?: { email: string } }
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border-b border-border transition-colors hover:bg-muted/50 ${
        isActive ? 'bg-muted' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {conversation.lead?.email?.slice(0, 2).toUpperCase() || 'UN'}
            </AvatarFallback>
          </Avatar>
          {!conversation.is_read && (
            <Circle className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 fill-blue-500 text-blue-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-sm truncate ${!conversation.is_read ? 'font-semibold' : 'font-medium'}`}>
              {conversation.lead?.email || 'Unknown'}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatRelativeTime(conversation.last_message_at)}
            </span>
          </div>
          <p className={`text-sm truncate ${!conversation.is_read ? 'font-medium' : 'text-muted-foreground'}`}>
            {conversation.subject}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground truncate">
              {conversation.email_account?.email}
            </span>
            {conversation.message_count > 1 && (
              <Badge variant="secondary" className="text-xs">{conversation.message_count}</Badge>
            )}
            {conversation.is_starred && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
          </div>
        </div>
      </div>
    </button>
  )
}

function MessageThread({ messages }: { messages: EmailMessage[] }) {
  return (
    <div className="space-y-4">
      {messages.map((msg, i) => (
        <div key={msg.id} className={`rounded-lg border ${msg.direction === 'outbound' ? 'bg-primary/5 border-primary/20' : 'bg-background'}`}>
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-sm">{msg.from_name || msg.from_email}</span>
                <span className="text-muted-foreground text-sm ml-1">&lt;{msg.from_email}&gt;</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={msg.direction === 'outbound' ? 'default' : 'secondary'} className="text-xs">
                  {msg.direction}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(msg.sent_at)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              To: {msg.to_emails.join(', ')}
            </p>
          </div>
          <div className="p-4">
            <div
              className="text-sm prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: msg.body_html || `<p>${msg.body_text || ''}</p>` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function UniboxPage() {
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isSendingReply, setIsSendingReply] = useState(false)
  const { currentWorkspace } = useAuthStore()
  const workspaceId = currentWorkspace?.id
  const queryClient = useQueryClient()

  const { data: emailAccounts } = useQuery({
    queryKey: ['email-accounts', workspaceId],
    queryFn: async () => {
      const { data } = await supabase.from('email_accounts').select('id, email').eq('workspace_id', workspaceId!)
      return data || []
    },
    enabled: !!workspaceId,
  })

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', workspaceId, search, accountFilter, statusFilter],
    queryFn: async () => {
      if (!workspaceId) return []
      let query = supabase
        .from('conversations')
        .select('*, lead:leads(email, first_name, last_name), email_account:email_accounts(email)')
        .eq('workspace_id', workspaceId)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false })

      if (search) query = query.ilike('subject', `%${search}%`)
      if (accountFilter !== 'all') query = query.eq('email_account_id', accountFilter)
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)

      const { data, error } = await query
      if (error) throw error
      return (data || []) as (Conversation & { email_account?: { email: string } })[]
    },
    enabled: !!workspaceId,
  })

  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return []
      const { data } = await supabase
        .from('email_messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('sent_at', { ascending: true })
      return (data || []) as EmailMessage[]
    },
    enabled: !!selectedConversation,
  })

  // Mark as read when selected
  useEffect(() => {
    if (selectedConversation && !selectedConversation.is_read) {
      supabase.from('conversations').update({ is_read: true }).eq('id', selectedConversation.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations', workspaceId] })
      })
    }
  }, [selectedConversation?.id])

  // Realtime subscription
  useEffect(() => {
    if (!workspaceId) return
    const channel = supabase
      .channel('conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `workspace_id=eq.${workspaceId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversations', workspaceId] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [workspaceId])

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConversation) return
    setIsSendingReply(true)
    // This would call the worker API in production
    // For now, store the message in DB and queue for sending
    try {
      const { error } = await supabase.from('email_messages').insert({
        conversation_id: selectedConversation.id,
        workspace_id: workspaceId!,
        email_account_id: selectedConversation.email_account_id,
        message_id: `draft-${Date.now()}@emmil.local`,
        direction: 'outbound',
        from_email: selectedConversation.email_account?.email || '',
        to_emails: [selectedConversation.lead?.email || ''],
        cc_emails: [],
        bcc_emails: [],
        subject: `Re: ${selectedConversation.subject}`,
        body_text: replyText,
        body_html: `<p>${replyText.replace(/\n/g, '</p><p>')}</p>`,
        has_attachments: false,
        is_read: true,
        sent_at: new Date().toISOString(),
      })

      if (error) throw error

      await supabase.from('conversations')
        .update({ last_message_at: new Date().toISOString(), message_count: (selectedConversation.message_count || 0) + 1 })
        .eq('id', selectedConversation.id)

      toast({ title: 'Reply queued', description: 'Your reply has been queued for sending by the email worker.' })
      setReplyText('')
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.id] })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
    setIsSendingReply(false)
  }

  const unreadCount = conversations?.filter(c => !c.is_read).length || 0

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Left: Conversation list */}
      <div className="w-80 flex flex-col border-r border-border shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              <h2 className="font-semibold">Unibox</h2>
              {unreadCount > 0 && (
                <Badge className="text-xs">{unreadCount}</Badge>
              )}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-9 h-8 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-border flex gap-2">
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {emailAccounts?.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="replied">Replied</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-4 border-b border-border flex gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))
          ) : conversations?.length ? (
            conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={selectedConversation?.id === conv.id}
                onClick={() => setSelectedConversation(conv)}
              />
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs opacity-60 mt-1">Conversations will appear here once emails are synced</p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Conversation detail */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Thread header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{selectedConversation.subject}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedConversation.lead?.email} · {selectedConversation.message_count} message(s)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await supabase.from('conversations')
                    .update({ is_starred: !selectedConversation.is_starred })
                    .eq('id', selectedConversation.id)
                  queryClient.invalidateQueries({ queryKey: ['conversations', workspaceId] })
                }}
              >
                <Star className={`h-4 w-4 ${selectedConversation.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await supabase.from('conversations')
                    .update({ is_archived: true })
                    .eq('id', selectedConversation.id)
                  setSelectedConversation(null)
                  queryClient.invalidateQueries({ queryKey: ['conversations', workspaceId] })
                }}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {messages?.length ? (
              <MessageThread messages={messages} />
            ) : (
              <div className="flex items-center justify-center h-32">
                <Skeleton className="h-24 w-full" />
              </div>
            )}
          </ScrollArea>

          <Separator />

          {/* Reply box */}
          <div className="p-4 space-y-3">
            <Textarea
              placeholder="Type your reply..."
              className="min-h-[100px] resize-none"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Sending from: {selectedConversation.email_account?.email}
              </p>
              <Button
                size="sm"
                onClick={handleSendReply}
                disabled={!replyText.trim() || isSendingReply}
              >
                <Reply className="h-4 w-4 mr-2" />
                Send Reply
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <h3 className="font-medium">Select a conversation</h3>
            <p className="text-sm opacity-60 mt-1">Choose a conversation from the left to view messages</p>
          </div>
        </div>
      )}
    </div>
  )
}
