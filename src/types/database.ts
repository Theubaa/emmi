export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      customers: {
        Row: Customer
        Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Customer, 'id' | 'created_at'>>
      }
      workspaces: {
        Row: Workspace
        Insert: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Workspace, 'id' | 'created_at'>>
      }
      workspace_members: {
        Row: WorkspaceMember
        Insert: Omit<WorkspaceMember, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<WorkspaceMember, 'id' | 'created_at'>>
      }
      workspace_invitations: {
        Row: WorkspaceInvitation
        Insert: Omit<WorkspaceInvitation, 'id' | 'created_at'>
        Update: Partial<Omit<WorkspaceInvitation, 'id' | 'created_at'>>
      }
      email_accounts: {
        Row: EmailAccount
        Insert: Omit<EmailAccount, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EmailAccount, 'id' | 'created_at'>>
      }
      email_account_credentials: {
        Row: EmailAccountCredential
        Insert: Omit<EmailAccountCredential, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EmailAccountCredential, 'id' | 'created_at'>>
      }
      leads: {
        Row: Lead
        Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Lead, 'id' | 'created_at'>>
      }
      lead_lists: {
        Row: LeadList
        Insert: Omit<LeadList, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<LeadList, 'id' | 'created_at'>>
      }
      lead_list_members: {
        Row: LeadListMember
        Insert: Omit<LeadListMember, 'id' | 'created_at'>
        Update: Partial<Omit<LeadListMember, 'id' | 'created_at'>>
      }
      campaigns: {
        Row: Campaign
        Insert: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Campaign, 'id' | 'created_at'>>
      }
      campaign_sequences: {
        Row: CampaignSequence
        Insert: Omit<CampaignSequence, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CampaignSequence, 'id' | 'created_at'>>
      }
      campaign_leads: {
        Row: CampaignLead
        Insert: Omit<CampaignLead, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CampaignLead, 'id' | 'created_at'>>
      }
      campaign_step_executions: {
        Row: CampaignStepExecution
        Insert: Omit<CampaignStepExecution, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CampaignStepExecution, 'id' | 'created_at'>>
      }
      conversations: {
        Row: Conversation
        Insert: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Conversation, 'id' | 'created_at'>>
      }
      email_messages: {
        Row: EmailMessage
        Insert: Omit<EmailMessage, 'id' | 'created_at'>
        Update: Partial<Omit<EmailMessage, 'id' | 'created_at'>>
      }
      email_events: {
        Row: EmailEvent
        Insert: Omit<EmailEvent, 'id' | 'created_at'>
        Update: Partial<Omit<EmailEvent, 'id' | 'created_at'>>
      }
      sending_queue: {
        Row: SendingQueueItem
        Insert: Omit<SendingQueueItem, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SendingQueueItem, 'id' | 'created_at'>>
      }
      suppression_list: {
        Row: SuppressionEntry
        Insert: Omit<SuppressionEntry, 'id' | 'created_at'>
        Update: Partial<Omit<SuppressionEntry, 'id' | 'created_at'>>
      }
      campaign_analytics: {
        Row: CampaignAnalytics
        Insert: Omit<CampaignAnalytics, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CampaignAnalytics, 'id' | 'created_at'>>
      }
      subscriptions: {
        Row: Subscription
        Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Subscription, 'id' | 'created_at'>>
      }
      audit_logs: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at'>
        Update: never
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// ============== ENTITY TYPES ==============

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_super_admin: boolean
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  name: string
  email: string
  status: 'active' | 'suspended' | 'trial'
  plan: string | null
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  customer_id: string
  name: string
  slug: string
  logo_url: string | null
  settings: WorkspaceSettings
  status: 'active' | 'suspended'
  created_at: string
  updated_at: string
}

export interface WorkspaceSettings {
  timezone: string
  sending_days: string[]
  sending_start_hour: number
  sending_end_hour: number
  daily_send_limit: number
  track_opens: boolean
  track_clicks: boolean
  unsubscribe_text: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  created_at: string
  updated_at: string
  // Joined
  profile?: Profile
}

export type WorkspaceRole = 'owner' | 'admin' | 'campaign_manager' | 'member'

export interface WorkspaceInvitation {
  id: string
  workspace_id: string
  email: string
  role: WorkspaceRole
  invited_by: string
  token: string
  status: 'pending' | 'accepted' | 'expired'
  expires_at: string
  created_at: string
}

export interface EmailAccount {
  id: string
  workspace_id: string
  email: string
  display_name: string | null
  provider: EmailProvider
  status: 'connected' | 'disconnected' | 'error' | 'syncing'
  imap_host: string | null
  imap_port: number | null
  imap_encryption: 'ssl' | 'tls' | 'none'
  smtp_host: string | null
  smtp_port: number | null
  smtp_encryption: 'ssl' | 'tls' | 'none'
  daily_send_limit: number
  emails_sent_today: number
  last_sync_at: string | null
  sync_enabled: boolean
  error_message: string | null
  created_at: string
  updated_at: string
}

export type EmailProvider = 'gmail' | 'google_workspace' | 'microsoft365' | 'outlook' | 'zoho' | 'custom'

export interface EmailAccountCredential {
  id: string
  email_account_id: string
  credential_type: 'password' | 'oauth2'
  encrypted_data: string
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  workspace_id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  job_title: string | null
  phone: string | null
  website: string | null
  linkedin_url: string | null
  status: LeadStatus
  email_validation_status: 'valid' | 'invalid' | 'unknown' | 'catch_all'
  custom_fields: Record<string, string>
  tags: string[]
  unsubscribed: boolean
  bounced: boolean
  created_at: string
  updated_at: string
}

export type LeadStatus = 'active' | 'contacted' | 'replied' | 'converted' | 'unsubscribed' | 'bounced' | 'invalid'

export interface LeadList {
  id: string
  workspace_id: string
  name: string
  description: string | null
  lead_count: number
  created_at: string
  updated_at: string
}

export interface LeadListMember {
  id: string
  lead_list_id: string
  lead_id: string
  created_at: string
}

export interface Campaign {
  id: string
  workspace_id: string
  name: string
  status: CampaignStatus
  from_name: string | null
  reply_to: string | null
  track_opens: boolean
  track_clicks: boolean
  stop_on_reply: boolean
  stop_on_unsubscribe: boolean
  stop_on_bounce: boolean
  daily_send_limit: number
  sending_days: string[]
  sending_start_hour: number
  sending_end_hour: number
  timezone: string
  total_leads: number
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_clicked: number
  emails_replied: number
  emails_bounced: number
  emails_unsubscribed: number
  created_at: string
  updated_at: string
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived'

export interface CampaignSequence {
  id: string
  campaign_id: string
  workspace_id: string
  step_number: number
  subject: string
  body_html: string
  body_text: string
  delay_days: number
  delay_hours: number
  created_at: string
  updated_at: string
}

export interface CampaignLead {
  id: string
  campaign_id: string
  workspace_id: string
  lead_id: string
  email_account_id: string | null
  status: CampaignLeadStatus
  current_step: number
  next_send_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
  // Joined
  lead?: Lead
}

export type CampaignLeadStatus = 'pending' | 'active' | 'paused' | 'replied' | 'unsubscribed' | 'bounced' | 'completed' | 'failed'

export interface CampaignStepExecution {
  id: string
  campaign_id: string
  campaign_lead_id: string
  sequence_step_id: string
  workspace_id: string
  lead_id: string
  email_account_id: string
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  sent_at: string | null
  message_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  workspace_id: string
  email_account_id: string
  lead_id: string | null
  campaign_id: string | null
  subject: string
  status: ConversationStatus
  is_read: boolean
  is_starred: boolean
  is_archived: boolean
  assigned_to: string | null
  tags: string[]
  last_message_at: string
  message_count: number
  created_at: string
  updated_at: string
  // Joined
  email_account?: EmailAccount
  lead?: Lead
  messages?: EmailMessage[]
}

export type ConversationStatus = 'open' | 'replied' | 'closed'

export interface EmailMessage {
  id: string
  conversation_id: string
  workspace_id: string
  email_account_id: string
  message_id: string
  in_reply_to: string | null
  references: string[] | null
  direction: 'inbound' | 'outbound'
  from_email: string
  from_name: string | null
  to_emails: string[]
  cc_emails: string[]
  bcc_emails: string[]
  subject: string
  body_html: string | null
  body_text: string | null
  has_attachments: boolean
  is_read: boolean
  sent_at: string
  created_at: string
}

export interface EmailEvent {
  id: string
  workspace_id: string
  campaign_id: string | null
  email_message_id: string | null
  lead_id: string | null
  event_type: EmailEventType
  metadata: Record<string, Json>
  created_at: string
}

export type EmailEventType = 'sent' | 'delivered' | 'bounced' | 'opened' | 'clicked' | 'replied' | 'unsubscribed' | 'failed'

export interface SendingQueueItem {
  id: string
  workspace_id: string
  campaign_id: string
  campaign_lead_id: string
  sequence_step_id: string
  email_account_id: string
  lead_id: string
  scheduled_at: string
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  attempts: number
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface SuppressionEntry {
  id: string
  workspace_id: string
  email: string
  reason: 'unsubscribe' | 'bounce' | 'complaint' | 'manual'
  created_at: string
}

export interface CampaignAnalytics {
  id: string
  workspace_id: string
  campaign_id: string
  date: string
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_clicked: number
  emails_replied: number
  emails_bounced: number
  emails_unsubscribed: number
  emails_failed: number
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  customer_id: string
  plan: string
  status: 'active' | 'cancelled' | 'past_due' | 'trial'
  trial_ends_at: string | null
  current_period_start: string
  current_period_end: string
  max_workspaces: number
  max_email_accounts: number
  max_leads: number
  max_emails_per_month: number
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  workspace_id: string | null
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  metadata: Record<string, Json>
  ip_address: string | null
  created_at: string
}
