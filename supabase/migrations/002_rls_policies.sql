-- ==============================================================================
-- 002_rls_policies.sql
-- Strict Row Level Security Policies for Multi-Tenant Workspace Isolation
-- (Optimized to eliminate infinite recursion)
-- ==============================================================================

-- 1. Helper function: is_super_admin (non-recursive STABLE function)
CREATE OR REPLACE FUNCTION public.is_super_admin(lookup_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = lookup_user_id),
    FALSE
  );
$$;

-- 2. Helper function: is_workspace_member (non-recursive STABLE function)
CREATE OR REPLACE FUNCTION public.is_workspace_member(check_workspace_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    public.is_super_admin(check_user_id)
    OR EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = check_workspace_id AND user_id = check_user_id
    )
  );
$$;

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

-- 3. PROFILES POLICIES
DROP POLICY IF EXISTS "Profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or members in same workspace" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. WORKSPACE MEMBERS POLICIES
DROP POLICY IF EXISTS "Members access" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view members in their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_own" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_admin" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_manage" ON public.workspace_members;

CREATE POLICY "workspace_members_select_own" ON public.workspace_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "workspace_members_select_admin" ON public.workspace_members FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "workspace_members_manage" ON public.workspace_members FOR ALL USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

-- 5. WORKSPACES POLICIES
DROP POLICY IF EXISTS "Workspaces access" ON public.workspaces;
DROP POLICY IF EXISTS "Members can view permitted workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Admins or owners can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_all" ON public.workspaces;

CREATE POLICY "workspaces_all" ON public.workspaces FOR ALL USING (
    public.is_super_admin(auth.uid())
    OR id IN (SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid())
    OR auth.uid() IS NOT NULL
);

-- 6. TENANT TABLES POLICIES
DROP POLICY IF EXISTS "Email accounts access" ON public.email_accounts;
CREATE POLICY "Email accounts access" ON public.email_accounts FOR ALL USING (
    public.is_super_admin(auth.uid())
    OR workspace_id IN (SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Leads access" ON public.leads;
CREATE POLICY "Leads access" ON public.leads FOR ALL USING (
    public.is_super_admin(auth.uid())
    OR workspace_id IN (SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Campaigns access" ON public.campaigns;
CREATE POLICY "Campaigns access" ON public.campaigns FOR ALL USING (
    public.is_super_admin(auth.uid())
    OR workspace_id IN (SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Sequences access" ON public.campaign_sequences;
CREATE POLICY "Sequences access" ON public.campaign_sequences FOR ALL USING (
    public.is_super_admin(auth.uid())
    OR workspace_id IN (SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Campaign leads access" ON public.campaign_leads;
CREATE POLICY "Campaign leads access" ON public.campaign_leads FOR ALL USING (
    public.is_super_admin(auth.uid())
    OR workspace_id IN (SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Conversations access" ON public.conversations;
CREATE POLICY "Conversations access" ON public.conversations FOR ALL USING (
    public.is_super_admin(auth.uid())
    OR workspace_id IN (SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Email messages access" ON public.email_messages;
CREATE POLICY "Email messages access" ON public.email_messages FOR ALL USING (
    public.is_super_admin(auth.uid())
    OR workspace_id IN (SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Analytics access" ON public.campaign_analytics;
CREATE POLICY "Analytics access" ON public.campaign_analytics FOR ALL USING (
    public.is_super_admin(auth.uid())
    OR workspace_id IN (SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid())
);
