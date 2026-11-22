-- ==============================================================================
-- FIX_RLS.SQL: ELIMINATE INFINITE RECURSION & ENABLE FULL ADMIN PRIVILEGES
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
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
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

-- Super admin update: Can update any profile (e.g. toggle admin)
CREATE POLICY "profiles_update_admin"
ON public.profiles FOR UPDATE
USING (public.is_super_admin(auth.uid()));

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

CREATE POLICY "workspace_members_select_own"
ON public.workspace_members FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "workspace_members_select_admin"
ON public.workspace_members FOR SELECT
USING (public.is_super_admin(auth.uid()));

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

-- ==============================================================================
-- 7. CUSTOMERS POLICIES (Super Admin Full Control + Tenant Org Isolation)
-- ==============================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_super_admin_all" ON public.customers;
DROP POLICY IF EXISTS "customers_tenant_select" ON public.customers;

-- Super admin can view, create, edit, delete all customers
CREATE POLICY "customers_super_admin_all"
ON public.customers FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Regular users can only view their own linked customer organization
CREATE POLICY "customers_tenant_select"
ON public.customers FOR SELECT
USING (
    id IN (
        SELECT w.customer_id FROM public.workspaces w
        JOIN public.workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = auth.uid()
    )
);

-- ==============================================================================
-- 8. AUDIT LOGS POLICIES
-- ==============================================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_super_admin_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_all" ON public.audit_logs;

CREATE POLICY "audit_logs_super_admin_all"
ON public.audit_logs FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "audit_logs_insert_all"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- ==============================================================================
-- 9. RPC FUNCTION: create_new_user (Direct Super Admin Provisioning)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_new_user(
  user_email TEXT,
  user_password TEXT,
  user_name TEXT DEFAULT '',
  make_super_admin BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_user_id UUID;
  encrypted_pw TEXT;
BEGIN
  -- Verify caller is super admin
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Only Super Administrators can create users.';
  END IF;

  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    RAISE EXCEPTION 'User with email "%" already exists.', user_email;
  END IF;

  new_user_id := gen_random_uuid();
  encrypted_pw := crypt(user_password, gen_salt('bf'));

  -- Insert into Supabase Auth
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    user_email,
    encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', user_name),
    now(),
    now(),
    '',
    ''
  );

  -- Insert identity
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', user_email),
    'email',
    now(),
    now(),
    now()
  );

  -- Insert or update public profile
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    is_super_admin,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    user_email,
    user_name,
    make_super_admin,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    is_super_admin = EXCLUDED.is_super_admin,
    updated_at = now();

  -- Audit log entry
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    auth.uid(),
    'admin_create_user',
    'user',
    new_user_id,
    jsonb_build_object('email', user_email, 'is_super_admin', make_super_admin),
    now()
  );

  RETURN jsonb_build_object(
    'id', new_user_id,
    'email', user_email,
    'full_name', user_name,
    'is_super_admin', make_super_admin
  );
END;
$$;

-- ==============================================================================
-- 10. RPC FUNCTION: delete_user_by_admin (Direct Super Admin Deletion)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Only Super Administrators can delete users.';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    created_at
  ) VALUES (
    auth.uid(),
    'admin_delete_user',
    'user',
    target_user_id,
    now()
  );

  RETURN TRUE;
END;
$$;

-- ==============================================================================
-- 11. MASTER RPC FUNCTION: onboard_new_customer (All-in-One Customer + Workspace + User)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.onboard_new_customer(
  company_name TEXT,
  owner_email TEXT,
  owner_password TEXT,
  owner_full_name TEXT,
  plan_tier TEXT DEFAULT 'starter'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_cust_id UUID;
  new_ws_id UUID;
  new_user_id UUID;
  encrypted_pw TEXT;
  ws_slug TEXT;
BEGIN
  -- Verify caller is super admin
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Only Super Administrators can onboard customers.';
  END IF;

  -- 1. Create Customer record
  new_cust_id := gen_random_uuid();
  INSERT INTO public.customers (id, name, email, plan, status, created_at, updated_at)
  VALUES (new_cust_id, company_name, owner_email, plan_tier, 'active', now(), now());

  -- 2. Create Workspace
  new_ws_id := gen_random_uuid();
  ws_slug := lower(regexp_replace(company_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(gen_random_uuid()::text from 1 for 4);
  INSERT INTO public.workspaces (id, customer_id, name, slug, status, created_at, updated_at)
  VALUES (new_ws_id, new_cust_id, company_name || ' Workspace', ws_slug, 'active', now(), now());

  -- 3. Check or Create User in auth.users
  SELECT id INTO new_user_id FROM auth.users WHERE email = owner_email;
  
  IF new_user_id IS NULL THEN
    new_user_id := gen_random_uuid();
    encrypted_pw := crypt(owner_password, gen_salt('bf'));

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id, 'authenticated', 'authenticated', owner_email, encrypted_pw,
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', owner_full_name),
      now(), now(), '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', owner_email),
      'email', now(), now(), now()
    );

    INSERT INTO public.profiles (
      id, email, full_name, is_super_admin, created_at, updated_at
    ) VALUES (
      new_user_id, owner_email, owner_full_name, FALSE, now(), now()
    );
  END IF;

  -- 4. Add User as Owner of the Workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
  VALUES (new_ws_id, new_user_id, 'owner', now(), now())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- 5. Audit log
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata, created_at)
  VALUES (auth.uid(), 'onboard_customer', 'customer', new_cust_id, jsonb_build_object('company', company_name, 'email', owner_email, 'plan', plan_tier), now());

  RETURN jsonb_build_object(
    'customer_id', new_cust_id,
    'workspace_id', new_ws_id,
    'user_id', new_user_id,
    'email', owner_email,
    'company_name', company_name
  );
END;
$$;
