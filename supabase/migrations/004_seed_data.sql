-- ==============================================================================
-- 004_seed_data.sql
-- Demo Workspace, Sample Campaign, Leads & Initial Seed Data
-- ==============================================================================

DO $$
DECLARE
    demo_customer_id UUID := gen_random_uuid();
    demo_ws_id UUID := gen_random_uuid();
    demo_lead_1 UUID := gen_random_uuid();
    demo_lead_2 UUID := gen_random_uuid();
    demo_lead_3 UUID := gen_random_uuid();
    demo_campaign_id UUID := gen_random_uuid();
    demo_account_id UUID := gen_random_uuid();
    demo_conv_id UUID := gen_random_uuid();
BEGIN
    -- 1. Create Default Customer
    INSERT INTO public.customers (id, name, email, status, plan)
    VALUES (demo_customer_id, 'Acme Outbound Corp', 'billing@acmeoutbound.com', 'active', 'hypergrowth')
    ON CONFLICT DO NOTHING;

    -- 2. Create Default Subscription
    INSERT INTO public.subscriptions (customer_id, plan, status, max_workspaces, max_email_accounts, max_leads, max_emails_per_month)
    VALUES (demo_customer_id, 'hypergrowth', 'active', 10, 15, 25000, 50000)
    ON CONFLICT DO NOTHING;

    -- 3. Create Demo Workspace
    INSERT INTO public.workspaces (id, customer_id, name, slug, status, settings)
    VALUES (
        demo_ws_id,
        demo_customer_id,
        'Acme Primary Workspace',
        'acme-primary',
        'active',
        '{
            "timezone": "America/New_York",
            "sending_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "sending_start_hour": 9,
            "sending_end_hour": 17,
            "daily_send_limit": 300,
            "track_opens": true,
            "track_clicks": false,
            "unsubscribe_text": "To unsubscribe from our emails, click here."
        }'::jsonb
    )
    ON CONFLICT DO NOTHING;

    -- 4. Create Demo Email Sending Account
    INSERT INTO public.email_accounts (
        id, workspace_id, email, display_name, provider, status,
        imap_host, imap_port, imap_encryption, smtp_host, smtp_port, smtp_encryption,
        daily_send_limit, emails_sent_today, sync_enabled
    )
    VALUES (
        demo_account_id,
        demo_ws_id,
        'alex@acmeoutbound.com',
        'Alex Mercer',
        'google_workspace',
        'connected',
        'imap.gmail.com', 993, 'ssl',
        'smtp.gmail.com', 587, 'tls',
        150, 24, true
    )
    ON CONFLICT DO NOTHING;

    -- 5. Seed Leads
    INSERT INTO public.leads (id, workspace_id, email, first_name, last_name, company, job_title, status)
    VALUES
        (demo_lead_1, demo_ws_id, 'sarah.connor@techlead.io', 'Sarah', 'Connor', 'TechLead Inc', 'VP of Engineering', 'active'),
        (demo_lead_2, demo_ws_id, 'marcus.vance@solardrive.co', 'Marcus', 'Vance', 'SolarDrive', 'Head of Growth', 'replied'),
        (demo_lead_3, demo_ws_id, 'elena.rostova@cloudscale.net', 'Elena', 'Rostova', 'CloudScale', 'Chief Technology Officer', 'contacted')
    ON CONFLICT DO NOTHING;

    -- 6. Create Demo Campaign
    INSERT INTO public.campaigns (
        id, workspace_id, name, status, from_name, reply_to,
        daily_send_limit, total_leads, emails_sent, emails_delivered, emails_opened, emails_replied
    )
    VALUES (
        demo_campaign_id,
        demo_ws_id,
        'Q1 Enterprise SaaS Decision Makers',
        'active',
        'Alex Mercer',
        'alex@acmeoutbound.com',
        100, 3, 24, 24, 18, 5
    )
    ON CONFLICT DO NOTHING;

    -- 7. Create Sequence Steps
    INSERT INTO public.campaign_sequences (campaign_id, workspace_id, step_number, subject, body_html, body_text, delay_days)
    VALUES
        (
            demo_campaign_id, demo_ws_id, 1,
            'Quick question regarding {{company}} outreach infrastructure',
            '<p>Hi {{first_name}},</p><p>Came across {{company}} and noticed your focus on scalable engineering. How are you currently scaling outbound pipeline without hitting inbox spam filters?</p><p>Best,<br>Alex</p>',
            'Hi {{first_name}},\n\nCame across {{company}} and noticed your focus on scalable engineering. How are you currently scaling outbound pipeline without hitting inbox spam filters?\n\nBest,\nAlex',
            0
        ),
        (
            demo_campaign_id, demo_ws_id, 2,
            'Following up on my note, {{first_name}}',
            '<p>Hey {{first_name}},</p><p>Just floating this back to the top of your inbox. Happy to share a 2-minute breakdown of how companies like yours protect domain reputation at scale.</p><p>Would Thursday work for a quick chat?</p>',
            'Hey {{first_name}},\n\nJust floating this back to the top of your inbox. Happy to share a 2-minute breakdown of how companies like yours protect domain reputation at scale.\n\nWould Thursday work for a quick chat?',
            3
        )
    ON CONFLICT DO NOTHING;

    -- 8. Create Demo Unibox Conversation
    INSERT INTO public.conversations (
        id, workspace_id, email_account_id, lead_id, campaign_id,
        subject, status, is_read, message_count, last_message_at
    )
    VALUES (
        demo_conv_id,
        demo_ws_id,
        demo_account_id,
        demo_lead_2,
        demo_campaign_id,
        'Re: Quick question regarding SolarDrive outreach infrastructure',
        'replied',
        false,
        2,
        timezone('utc'::text, now() - interval '25 minutes')
    )
    ON CONFLICT DO NOTHING;

    -- 9. Email Messages in Conversation
    INSERT INTO public.email_messages (
        conversation_id, workspace_id, email_account_id, message_id,
        direction, from_email, from_name, to_emails, subject,
        body_text, body_html, sent_at
    )
    VALUES
        (
            demo_conv_id, demo_ws_id, demo_account_id,
            '<outbound-msg-001@acmeoutbound.com>',
            'outbound', 'alex@acmeoutbound.com', 'Alex Mercer',
            ARRAY['marcus.vance@solardrive.co'],
            'Quick question regarding SolarDrive outreach infrastructure',
            'Hi Marcus, came across SolarDrive...',
            '<p>Hi Marcus,</p><p>Came across SolarDrive and loved what you are building.</p>',
            now() - interval '2 days'
        ),
        (
            demo_conv_id, demo_ws_id, demo_account_id,
            '<inbound-reply-002@solardrive.co>',
            'inbound', 'marcus.vance@solardrive.co', 'Marcus Vance',
            ARRAY['alex@acmeoutbound.com'],
            'Re: Quick question regarding SolarDrive outreach infrastructure',
            'Hi Alex, thanks for reaching out. Yes, we are currently reviewing our deliverability setup. Send over that 2-min breakdown.',
            '<p>Hi Alex,</p><p>Thanks for reaching out. Yes, we are currently reviewing our deliverability setup. Send over that 2-min breakdown.</p>',
            now() - interval '25 minutes'
        )
    ON CONFLICT DO NOTHING;

    -- 10. Sample Analytics History
    INSERT INTO public.campaign_analytics (
        workspace_id, campaign_id, date, emails_sent, emails_delivered, emails_opened, emails_replied
    )
    VALUES
        (demo_ws_id, demo_campaign_id, CURRENT_DATE - 4, 12, 12, 8, 2),
        (demo_ws_id, demo_campaign_id, CURRENT_DATE - 3, 20, 20, 14, 3),
        (demo_ws_id, demo_campaign_id, CURRENT_DATE - 2, 28, 27, 21, 5),
        (demo_ws_id, demo_campaign_id, CURRENT_DATE - 1, 35, 35, 26, 7),
        (demo_ws_id, demo_campaign_id, CURRENT_DATE,     15, 15, 11, 4)
    ON CONFLICT (campaign_id, date) DO UPDATE
    SET emails_sent = EXCLUDED.emails_sent;
END $$;
