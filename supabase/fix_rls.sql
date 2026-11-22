-- ==============================================================================
-- FIX_RLS.SQL: ELIMINATE INFINITE RECURSION (ERROR 42P17)
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gftrwaufvhemzbieklfl/sql/new
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

-- ==============================================================================
-- 3. PROFILES POLICIES (Simple & Zero Recursion)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or members in same workspace" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

-- Self read: User reads their own profile directly with ZERO joins or function calls
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Super admin read: Can read all profiles
CREATE POLICY "profiles_select_admin"
ON public.profiles FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Self update: User updates their own profile
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Self insert: Trigger sync
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ==============================================================================
-- 4. WORKSPACE MEMBERS POLICIES (Zero Recursion)
-- ==============================================================================
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members access" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view members in their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_own" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_admin" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_manage" ON public.workspace_members;

-- Users can view their own membership rows directly
CREATE POLICY "workspace_members_select_own"
ON public.workspace_members FOR SELECT
USING (user_id = auth.uid());

-- Super admin can view all memberships
CREATE POLICY "workspace_members_select_admin"
ON public.workspace_members FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Manage memberships
CREATE POLICY "workspace_members_manage"
ON public.workspace_members FOR ALL
USING (
    public.is_super_admin(auth.uid())
    OR user_id = auth.uid()
);

-- ==============================================================================
-- 5. WORKSPACES POLICIES
-- ==============================================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspaces access" ON public.workspaces;
DROP POLICY IF EXISTS "Members can view permitted workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Admins or owners can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_all" ON public.workspaces;

CREATE POLICY "workspaces_all"
ON public.workspaces FOR ALL
USING (
    public.is_super_admin(auth.uid())
    OR id IN (SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid())
    OR auth.uid() IS NOT NULL
);

-- ==============================================================================
-- 6. TENANT TABLES POLICIES (Email accounts, Leads, Campaigns, Unibox)
-- ==============================================================================
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
