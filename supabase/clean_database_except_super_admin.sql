-- ==============================================================================
-- CLEAN DATABASE SCRIPT: WIPES ALL TEST DATA EXCEPT SUPER ADMIN
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gftrwaufvhemzbieklfl/sql/new
-- ==============================================================================

DO $$
DECLARE
  super_admin_id UUID := 'e910ed63-4e1a-4399-8f65-1acd02058953';
BEGIN
  -- 1. Wipe all outreach activity & campaigns
  DELETE FROM public.campaign_step_executions;
  DELETE FROM public.campaign_leads;
  DELETE FROM public.campaign_sequences;
  DELETE FROM public.campaign_analytics;
  DELETE FROM public.campaigns;

  -- 2. Wipe all inbox & communication logs
  DELETE FROM public.email_events;
  DELETE FROM public.email_messages;
  DELETE FROM public.conversations;
  DELETE FROM public.sending_queue;
  DELETE FROM public.suppression_list;

  -- 3. Wipe all leads & contacts
  DELETE FROM public.lead_list_members;
  DELETE FROM public.lead_lists;
  DELETE FROM public.leads;

  -- 4. Wipe all connected email accounts & credentials
  DELETE FROM public.email_account_credentials;
  DELETE FROM public.email_sync_states;
  DELETE FROM public.email_folders;
  DELETE FROM public.email_accounts;

  -- 5. Wipe all workspace memberships & invitations
  DELETE FROM public.workspace_invitations;
  DELETE FROM public.workspace_members;

  -- 6. Wipe all customer organizations & tenant workspaces
  DELETE FROM public.workspaces;
  DELETE FROM public.subscriptions;
  DELETE FROM public.usage_logs;
  DELETE FROM public.customers;

  -- 7. Clean audit logs except super admin's actions
  DELETE FROM public.audit_logs 
  WHERE user_id IS NULL OR user_id != super_admin_id;

  -- 8. Clean public profiles (KEEP ONLY SUPER ADMIN)
  DELETE FROM public.profiles 
  WHERE id != super_admin_id;

  -- 9. Clean Supabase Auth identities (KEEP ONLY SUPER ADMIN)
  DELETE FROM auth.identities 
  WHERE user_id != super_admin_id;

  -- 10. Clean Supabase Auth users (KEEP ONLY SUPER ADMIN)
  DELETE FROM auth.users 
  WHERE id != super_admin_id;

  -- 11. Ensure Super Admin profile is 100% verified & active
  UPDATE public.profiles
  SET 
    is_super_admin = TRUE,
    updated_at = now()
  WHERE id = super_admin_id;

  RAISE NOTICE 'Database successfully cleaned! Only Super Admin % remains.', super_admin_id;
END $$;
