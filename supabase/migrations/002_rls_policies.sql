-- ==============================================================================
-- 002_rls_policies.sql
-- Strict Row Level Security Policies for Multi-Tenant Workspace Isolation
-- ==============================================================================

-- Helper Functions to enforce RLS cleanly and avoid recursion
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
    -- Super admin has universal access
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

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_account_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sync_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_step_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sending_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES POLICIES
DROP POLICY IF EXISTS "Users can view own profile or members in same workspace" ON public.profiles;
CREATE POLICY "Users can view own profile or members in same workspace"
ON public.profiles FOR SELECT
USING (
    auth.uid() = id
    OR public.is_super_admin(auth.uid())
    OR id IN (
        SELECT user_id FROM public.workspace_members
        WHERE workspace_id IN (SELECT public.get_user_workspaces(auth.uid()))
    )
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id OR public.is_super_admin(auth.uid()));

-- 2. CUSTOMERS POLICIES
DROP POLICY IF EXISTS "Customers accessible by superadmin or customer members" ON public.customers;
CREATE POLICY "Customers accessible by superadmin or customer members"
ON public.customers FOR ALL
USING (
    public.is_super_admin(auth.uid())
    OR id IN (
        SELECT customer_id FROM public.workspaces
        WHERE id IN (SELECT public.get_user_workspaces(auth.uid()))
    )
);

-- 3. WORKSPACES POLICIES
DROP POLICY IF EXISTS "Members can view permitted workspaces" ON public.workspaces;
CREATE POLICY "Members can view permitted workspaces"
ON public.workspaces FOR SELECT
USING (public.is_workspace_member(id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
CREATE POLICY "Authenticated users can create workspaces"
ON public.workspaces FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins or owners can update workspaces" ON public.workspaces;
CREATE POLICY "Admins or owners can update workspaces"
ON public.workspaces FOR UPDATE
USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = workspaces.id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- 4. WORKSPACE MEMBERS POLICIES
DROP POLICY IF EXISTS "Members can view members in their workspaces" ON public.workspace_members;
CREATE POLICY "Members can view members in their workspaces"
ON public.workspace_members FOR SELECT
USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can manage members" ON public.workspace_members;
CREATE POLICY "Admins can manage members"
ON public.workspace_members FOR ALL
USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.workspace_members m
        WHERE m.workspace_id = workspace_members.workspace_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
);

-- 5. WORKSPACE INVITATIONS
DROP POLICY IF EXISTS "Invitations viewable and manageable by workspace admins" ON public.workspace_invitations;
CREATE POLICY "Invitations viewable and manageable by workspace admins"
ON public.workspace_invitations FOR ALL
USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = workspace_invitations.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- 6. EMAIL ACCOUNTS
DROP POLICY IF EXISTS "Workspace members can access email accounts" ON public.email_accounts;
CREATE POLICY "Workspace members can access email accounts"
ON public.email_accounts FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 7. EMAIL CREDENTIALS (Protected: service role & workspace admins only)
DROP POLICY IF EXISTS "Admins can manage credentials" ON public.email_account_credentials;
CREATE POLICY "Admins can manage credentials"
ON public.email_account_credentials FOR ALL
USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.email_accounts ea
        JOIN public.workspace_members wm ON wm.workspace_id = ea.workspace_id
        WHERE ea.id = email_account_credentials.email_account_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
);

-- 8. LEADS
DROP POLICY IF EXISTS "Workspace members can access leads" ON public.leads;
CREATE POLICY "Workspace members can access leads"
ON public.leads FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 9. LEAD LISTS & MEMBERS
DROP POLICY IF EXISTS "Workspace members can access lead lists" ON public.lead_lists;
CREATE POLICY "Workspace members can access lead lists"
ON public.lead_lists FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access lead list members" ON public.lead_list_members;
CREATE POLICY "Workspace members can access lead list members"
ON public.lead_list_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.lead_lists ll
        WHERE ll.id = lead_list_members.lead_list_id
        AND public.is_workspace_member(ll.workspace_id, auth.uid())
    )
);

-- 10. CAMPAIGNS & SEQUENCES
DROP POLICY IF EXISTS "Workspace members can access campaigns" ON public.campaigns;
CREATE POLICY "Workspace members can access campaigns"
ON public.campaigns FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access sequences" ON public.campaign_sequences;
CREATE POLICY "Workspace members can access sequences"
ON public.campaign_sequences FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access campaign leads" ON public.campaign_leads;
CREATE POLICY "Workspace members can access campaign leads"
ON public.campaign_leads FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 11. UNIBOX CONVERSATIONS & MESSAGES
DROP POLICY IF EXISTS "Workspace members can access conversations" ON public.conversations;
CREATE POLICY "Workspace members can access conversations"
ON public.conversations FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access email messages" ON public.email_messages;
CREATE POLICY "Workspace members can access email messages"
ON public.email_messages FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 12. ANALYTICS & EVENTS
DROP POLICY IF EXISTS "Workspace members can view analytics" ON public.campaign_analytics;
CREATE POLICY "Workspace members can view analytics"
ON public.campaign_analytics FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can view events" ON public.email_events;
CREATE POLICY "Workspace members can view events"
ON public.email_events FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 13. SUPPRESSION LIST
DROP POLICY IF EXISTS "Workspace members can manage suppression list" ON public.suppression_list;
CREATE POLICY "Workspace members can manage suppression list"
ON public.suppression_list FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 14. AUDIT LOGS
DROP POLICY IF EXISTS "Super admins and workspace owners can view audit logs" ON public.audit_logs;
CREATE POLICY "Super admins and workspace owners can view audit logs"
ON public.audit_logs FOR SELECT
USING (
    public.is_super_admin(auth.uid())
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
);
