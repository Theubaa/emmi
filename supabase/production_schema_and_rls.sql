-- ==============================================================================
-- PRODUCTION RLS & AUTH TRIGGER POLICIES
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gftrwaufvhemzbieklfl/sql/new
-- ==============================================================================

-- 1. Helper Function: is_super_admin (STABLE non-recursive)
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

-- 2. Helper Function: is_workspace_member (STABLE non-recursive)
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

-- 3. Automatic Profile Creation Trigger on Supabase Auth Invite/Signup
CREATE OR REPLACE FUNCTION public.handle_new_invited_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    is_super_admin,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    FALSE,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_invited_user();

-- ==============================================================================
-- 4. PROFILES POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ==============================================================================
-- 5. WORKSPACE MEMBERS POLICIES
-- ==============================================================================
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_members_select_own" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_admin" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_manage" ON public.workspace_members;

CREATE POLICY "workspace_members_select_own" ON public.workspace_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "workspace_members_select_admin" ON public.workspace_members FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "workspace_members_manage" ON public.workspace_members FOR ALL USING (
  public.is_super_admin(auth.uid()) OR user_id = auth.uid()
);

-- ==============================================================================
-- 6. WORKSPACES POLICIES
-- ==============================================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces_all" ON public.workspaces;

CREATE POLICY "workspaces_all" ON public.workspaces FOR ALL USING (
  public.is_super_admin(auth.uid())
  OR id IN (SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = auth.uid())
  OR auth.uid() IS NOT NULL
);

-- ==============================================================================
-- 7. CUSTOMERS POLICIES
-- ==============================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_super_admin_all" ON public.customers;
DROP POLICY IF EXISTS "customers_tenant_select" ON public.customers;

CREATE POLICY "customers_super_admin_all" ON public.customers FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "customers_tenant_select" ON public.customers FOR SELECT
USING (
  id IN (
    SELECT w.customer_id FROM public.workspaces w
    JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = auth.uid()
  )
);

-- ==============================================================================
-- 8. TENANT TABLES STRICT DATA ISOLATION
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

-- ==============================================================================
-- 9. AUDIT LOGS POLICIES
-- ==============================================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_super_admin_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_all" ON public.audit_logs;

CREATE POLICY "audit_logs_super_admin_all" ON public.audit_logs FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "audit_logs_insert_all" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
