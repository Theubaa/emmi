-- ==============================================================================
-- EMMIL OUTREACH PLATFORM - FULL PRODUCTION SCHEMA & SEED DATA
-- Copy and run this entire file in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- ==============================================================================
-- STEP 1: EXTENSIONS & TABLES
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
    plan TEXT DEFAULT 'starter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    settings JSONB NOT NULL DEFAULT '{
        "timezone": "UTC",
        "sending_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "sending_start_hour": 9,
        "sending_end_hour": 18,
        "daily_send_limit": 200,
        "track_opens": true,
        "track_clicks": false,
        "unsubscribe_text": "If you wish to stop receiving these emails, click here to unsubscribe."
    }'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- WORKSPACE MEMBERS
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'campaign_manager', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(workspace_id, user_id)
);

-- WORKSPACE INVITATIONS
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'campaign_manager', 'member')),
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- EMAIL ACCOUNTS
CREATE TABLE IF NOT EXISTS public.email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    provider TEXT NOT NULL DEFAULT 'custom' CHECK (provider IN ('gmail', 'google_workspace', 'microsoft365', 'outlook', 'zoho', 'custom')),
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')),
    imap_host TEXT,
    imap_port INTEGER DEFAULT 993,
    imap_encryption TEXT DEFAULT 'ssl' CHECK (imap_encryption IN ('ssl', 'tls', 'none')),
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_encryption TEXT DEFAULT 'tls' CHECK (smtp_encryption IN ('ssl', 'tls', 'none')),
    daily_send_limit INTEGER NOT NULL DEFAULT 100,
    emails_sent_today INTEGER NOT NULL DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(workspace_id, email)
);

-- EMAIL ACCOUNT CREDENTIALS
CREATE TABLE IF NOT EXISTS public.email_account_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE UNIQUE,
    credential_type TEXT NOT NULL DEFAULT 'password' CHECK (credential_type IN ('password', 'oauth2')),
    encrypted_data TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- EMAIL SYNC STATES
CREATE TABLE IF NOT EXISTS public.email_sync_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE UNIQUE,
    last_uid BIGINT DEFAULT 0,
    highest_modseq BIGINT DEFAULT 0,
    last_sync_started_at TIMESTAMPTZ,
    last_sync_completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'idle',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- EMAIL FOLDERS
CREATE TABLE IF NOT EXISTS public.email_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
    folder_name TEXT NOT NULL,
    delimiter TEXT DEFAULT '/',
    unread_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(email_account_id, folder_name)
);

-- LEADS
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    job_title TEXT,
    phone TEXT,
    website TEXT,
    linkedin_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'contacted', 'replied', 'converted', 'unsubscribed', 'bounced', 'invalid')),
    email_validation_status TEXT NOT NULL DEFAULT 'unknown' CHECK (email_validation_status IN ('valid', 'invalid', 'unknown', 'catch_all')),
    custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags TEXT[] NOT NULL DEFAULT '{}',
    unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
    bounced BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(workspace_id, email)
);

-- LEAD LISTS
CREATE TABLE IF NOT EXISTS public.lead_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    lead_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- LEAD LIST MEMBERS
CREATE TABLE IF NOT EXISTS public.lead_list_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_list_id UUID NOT NULL REFERENCES public.lead_lists(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(lead_list_id, lead_id)
);

-- CAMPAIGNS
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    from_name TEXT,
    reply_to TEXT,
    track_opens BOOLEAN NOT NULL DEFAULT TRUE,
    track_clicks BOOLEAN NOT NULL DEFAULT FALSE,
    stop_on_reply BOOLEAN NOT NULL DEFAULT TRUE,
    stop_on_unsubscribe BOOLEAN NOT NULL DEFAULT TRUE,
    stop_on_bounce BOOLEAN NOT NULL DEFAULT TRUE,
    daily_send_limit INTEGER NOT NULL DEFAULT 100,
    sending_days TEXT[] NOT NULL DEFAULT ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    sending_start_hour INTEGER NOT NULL DEFAULT 9,
    sending_end_hour INTEGER NOT NULL DEFAULT 18,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    total_leads INTEGER NOT NULL DEFAULT 0,
    emails_sent INTEGER NOT NULL DEFAULT 0,
    emails_delivered INTEGER NOT NULL DEFAULT 0,
    emails_opened INTEGER NOT NULL DEFAULT 0,
    emails_clicked INTEGER NOT NULL DEFAULT 0,
    emails_replied INTEGER NOT NULL DEFAULT 0,
    emails_bounced INTEGER NOT NULL DEFAULT 0,
    emails_unsubscribed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- CAMPAIGN SEQUENCES
CREATE TABLE IF NOT EXISTS public.campaign_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL,
    delay_days INTEGER NOT NULL DEFAULT 0,
    delay_hours INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(campaign_id, step_number)
);

-- CAMPAIGN LEADS
CREATE TABLE IF NOT EXISTS public.campaign_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'replied', 'unsubscribed', 'bounced', 'completed', 'failed')),
    current_step INTEGER NOT NULL DEFAULT 0,
    next_send_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(campaign_id, lead_id)
);

-- CAMPAIGN STEP EXECUTIONS
CREATE TABLE IF NOT EXISTS public.campaign_step_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    campaign_lead_id UUID NOT NULL REFERENCES public.campaign_leads(id) ON DELETE CASCADE,
    sequence_step_id UUID NOT NULL REFERENCES public.campaign_sequences(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    sent_at TIMESTAMPTZ,
    message_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'closed')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_starred BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    message_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- EMAIL MESSAGES
CREATE TABLE IF NOT EXISTS public.email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    in_reply_to TEXT,
    "references" TEXT[],
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_emails TEXT[] NOT NULL,
    cc_emails TEXT[] NOT NULL DEFAULT '{}',
    bcc_emails TEXT[] NOT NULL DEFAULT '{}',
    subject TEXT NOT NULL,
    body_html TEXT,
    body_text TEXT,
    has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
    is_read BOOLEAN NOT NULL DEFAULT TRUE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(workspace_id, message_id)
);

-- EMAIL EVENTS
CREATE TABLE IF NOT EXISTS public.email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'bounced', 'opened', 'clicked', 'replied', 'unsubscribed', 'failed')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- SENDING QUEUE
CREATE TABLE IF NOT EXISTS public.sending_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    campaign_lead_id UUID NOT NULL REFERENCES public.campaign_leads(id) ON DELETE CASCADE,
    sequence_step_id UUID NOT NULL REFERENCES public.campaign_sequences(id) ON DELETE CASCADE,
    email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- SUPPRESSION LIST
CREATE TABLE IF NOT EXISTS public.suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(workspace_id, email)
);

-- CAMPAIGN ANALYTICS
CREATE TABLE IF NOT EXISTS public.campaign_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    emails_sent INTEGER NOT NULL DEFAULT 0,
    emails_delivered INTEGER NOT NULL DEFAULT 0,
    emails_opened INTEGER NOT NULL DEFAULT 0,
    emails_clicked INTEGER NOT NULL DEFAULT 0,
    emails_replied INTEGER NOT NULL DEFAULT 0,
    emails_bounced INTEGER NOT NULL DEFAULT 0,
    emails_unsubscribed INTEGER NOT NULL DEFAULT 0,
    emails_failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(campaign_id, date)
);

-- SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE UNIQUE,
    plan TEXT NOT NULL DEFAULT 'starter',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trial')),
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now() + interval '30 days'),
    max_workspaces INTEGER NOT NULL DEFAULT 3,
    max_email_accounts INTEGER NOT NULL DEFAULT 5,
    max_leads INTEGER NOT NULL DEFAULT 2500,
    max_emails_per_month INTEGER NOT NULL DEFAULT 10000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- USAGE LOGS
CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- STEP 2: PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_ws ON public.email_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_ws_email ON public.leads(workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_campaigns_ws_status ON public.campaigns(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_ws ON public.conversations(workspace_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_conv ON public.email_messages(conversation_id, sent_at ASC);
CREATE INDEX IF NOT EXISTS idx_sending_queue_sched ON public.sending_queue(status, scheduled_at ASC);
CREATE INDEX IF NOT EXISTS idx_suppression_lookup ON public.suppression_list(workspace_id, email);

-- ==============================================================================
-- STEP 3: ROW LEVEL SECURITY POLICIES
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin(lookup_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = lookup_user_id AND is_super_admin = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_workspace_member(check_workspace_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF public.is_super_admin(check_user_id) THEN
        RETURN TRUE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = check_workspace_id AND user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_workspaces(check_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
    IF public.is_super_admin(check_user_id) THEN
        RETURN QUERY SELECT id FROM public.workspaces;
    ELSE
        RETURN QUERY SELECT workspace_id FROM public.workspace_members WHERE user_id = check_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_account_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sending_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Workspace-scoped Access Policies
DROP POLICY IF EXISTS "Profiles access" ON public.profiles;
CREATE POLICY "Profiles access" ON public.profiles FOR ALL USING (
    auth.uid() = id OR public.is_super_admin(auth.uid()) OR
    id IN (SELECT user_id FROM public.workspace_members WHERE workspace_id IN (SELECT public.get_user_workspaces(auth.uid())))
);

DROP POLICY IF EXISTS "Workspaces access" ON public.workspaces;
CREATE POLICY "Workspaces access" ON public.workspaces FOR ALL USING (
    public.is_workspace_member(id, auth.uid()) OR auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Members access" ON public.workspace_members;
CREATE POLICY "Members access" ON public.workspace_members FOR ALL USING (
    public.is_workspace_member(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS "Email accounts access" ON public.email_accounts;
CREATE POLICY "Email accounts access" ON public.email_accounts FOR ALL USING (
    public.is_workspace_member(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS "Leads access" ON public.leads;
CREATE POLICY "Leads access" ON public.leads FOR ALL USING (
    public.is_workspace_member(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS "Campaigns access" ON public.campaigns;
CREATE POLICY "Campaigns access" ON public.campaigns FOR ALL USING (
    public.is_workspace_member(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS "Sequences access" ON public.campaign_sequences;
CREATE POLICY "Sequences access" ON public.campaign_sequences FOR ALL USING (
    public.is_workspace_member(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS "Campaign leads access" ON public.campaign_leads;
CREATE POLICY "Campaign leads access" ON public.campaign_leads FOR ALL USING (
    public.is_workspace_member(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS "Conversations access" ON public.conversations;
CREATE POLICY "Conversations access" ON public.conversations FOR ALL USING (
    public.is_workspace_member(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS "Email messages access" ON public.email_messages;
CREATE POLICY "Email messages access" ON public.email_messages FOR ALL USING (
    public.is_workspace_member(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS "Analytics access" ON public.campaign_analytics;
CREATE POLICY "Analytics access" ON public.campaign_analytics FOR ALL USING (
    public.is_workspace_member(workspace_id, auth.uid())
);

-- ==============================================================================
-- STEP 4: TRIGGERS & AUTOMATION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto Sync Signup Auth User to Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    is_first_user BOOLEAN;
BEGIN
    SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

    INSERT INTO public.profiles (id, email, full_name, avatar_url, is_super_admin)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        is_first_user
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Automatic Sequence Stop on Reply Received
CREATE OR REPLACE FUNCTION public.handle_inbound_reply_received()
RETURNS TRIGGER AS $$
DECLARE
    matched_lead_id UUID;
    v_campaign_id UUID;
BEGIN
    IF NEW.direction = 'inbound' THEN
        SELECT id INTO matched_lead_id
        FROM public.leads
        WHERE workspace_id = NEW.workspace_id
        AND email = NEW.from_email
        LIMIT 1;

        IF matched_lead_id IS NOT NULL THEN
            UPDATE public.leads SET status = 'replied' WHERE id = matched_lead_id;

            FOR v_campaign_id IN
                SELECT cl.campaign_id
                FROM public.campaign_leads cl
                JOIN public.campaigns c ON c.id = cl.campaign_id
                WHERE cl.lead_id = matched_lead_id
                AND cl.status IN ('pending', 'active')
                AND c.stop_on_reply = TRUE
            LOOP
                UPDATE public.campaign_leads
                SET status = 'replied', finished_at = timezone('utc'::text, now())
                WHERE campaign_id = v_campaign_id AND lead_id = matched_lead_id;

                UPDATE public.sending_queue
                SET status = 'cancelled'
                WHERE campaign_id = v_campaign_id AND lead_id = matched_lead_id AND status = 'pending';

                UPDATE public.campaigns
                SET emails_replied = emails_replied + 1
                WHERE id = v_campaign_id;
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_email_message_inserted ON public.email_messages;
CREATE TRIGGER on_email_message_inserted
    AFTER INSERT ON public.email_messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_inbound_reply_received();
