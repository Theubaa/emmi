-- ==============================================================================
-- 003_triggers_and_functions.sql
-- Automated Triggers, Profiling, Counters, and Sequence State Handlers
-- ==============================================================================

-- 1. Automatic updated_at Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach updated_at triggers
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_workspace_members_updated_at BEFORE UPDATE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_email_accounts_updated_at BEFORE UPDATE ON public.email_accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Auth User Signup -> Profiles Sync Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    is_first_user BOOLEAN;
BEGIN
    -- Check if this is the very first registered user on the platform to assign superadmin
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

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Automatic Sequence Stopping upon Reply Received
CREATE OR REPLACE FUNCTION public.handle_inbound_reply_received()
RETURNS TRIGGER AS $$
DECLARE
    matched_lead_id UUID;
    v_campaign_id UUID;
    v_workspace_id UUID;
BEGIN
    -- Only process inbound incoming emails
    IF NEW.direction = 'inbound' THEN
        -- Find lead by email in this workspace
        SELECT id INTO matched_lead_id
        FROM public.leads
        WHERE workspace_id = NEW.workspace_id
        AND email = NEW.from_email
        LIMIT 1;

        IF matched_lead_id IS NOT NULL THEN
            -- Update lead status to replied
            UPDATE public.leads
            SET status = 'replied'
            WHERE id = matched_lead_id;

            -- Find active campaign enrollment for this lead
            FOR v_campaign_id IN
                SELECT cl.campaign_id
                FROM public.campaign_leads cl
                JOIN public.campaigns c ON c.id = cl.campaign_id
                WHERE cl.lead_id = matched_lead_id
                AND cl.status IN ('pending', 'active')
                AND c.stop_on_reply = TRUE
            LOOP
                -- Stop further sequence execution for this lead
                UPDATE public.campaign_leads
                SET status = 'replied',
                    finished_at = timezone('utc'::text, now())
                WHERE campaign_id = v_campaign_id AND lead_id = matched_lead_id;

                -- Cancel any pending scheduled send jobs for this lead
                UPDATE public.sending_queue
                SET status = 'cancelled'
                WHERE campaign_id = v_campaign_id AND lead_id = matched_lead_id AND status = 'pending';

                -- Increment campaign replied counter
                UPDATE public.campaigns
                SET emails_replied = emails_replied + 1
                WHERE id = v_campaign_id;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_email_message_inserted
    AFTER INSERT ON public.email_messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_inbound_reply_received();

-- 4. Bounce & Unsubscribe Handler
CREATE OR REPLACE FUNCTION public.handle_email_event_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_type = 'bounced' AND NEW.lead_id IS NOT NULL THEN
        UPDATE public.leads SET bounced = TRUE, status = 'bounced' WHERE id = NEW.lead_id;
        IF NEW.campaign_id IS NOT NULL THEN
            UPDATE public.campaign_leads SET status = 'bounced', finished_at = now() WHERE campaign_id = NEW.campaign_id AND lead_id = NEW.lead_id;
            UPDATE public.campaigns SET emails_bounced = emails_bounced + 1 WHERE id = NEW.campaign_id;
        END IF;
        -- Add to suppression list
        INSERT INTO public.suppression_list (workspace_id, email, reason)
        SELECT workspace_id, email, 'bounce' FROM public.leads WHERE id = NEW.lead_id
        ON CONFLICT DO NOTHING;
    ELSIF NEW.event_type = 'unsubscribed' AND NEW.lead_id IS NOT NULL THEN
        UPDATE public.leads SET unsubscribed = TRUE, status = 'unsubscribed' WHERE id = NEW.lead_id;
        IF NEW.campaign_id IS NOT NULL THEN
            UPDATE public.campaign_leads SET status = 'unsubscribed', finished_at = now() WHERE campaign_id = NEW.campaign_id AND lead_id = NEW.lead_id;
            UPDATE public.campaigns SET emails_unsubscribed = emails_unsubscribed + 1 WHERE id = NEW.campaign_id;
        END IF;
        -- Add to suppression list
        INSERT INTO public.suppression_list (workspace_id, email, reason)
        SELECT workspace_id, email, 'unsubscribe' FROM public.leads WHERE id = NEW.lead_id
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_email_event_logged
    AFTER INSERT ON public.email_events
    FOR EACH ROW EXECUTE FUNCTION public.handle_email_event_status();
