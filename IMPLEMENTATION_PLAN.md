# EMMIL Outreach Platform - Implementation Plan

## Phase 1: Architecture & Foundation
- Setup Vite React + TypeScript project with modern ESM tooling
- Configure Tailwind CSS & shadcn/ui design tokens with light/dark theme support
- Implement TanStack Query client & Zustand store with persistence
- Define centralized database types & Supabase client integration

## Phase 2: Multi-Tenant Workspace & Role-Based Auth
- Supabase Auth integration (login, registration, password recovery)
- Automatic profile creation and superadmin assignment via database triggers
- Workspace switcher, creation flow, and membership assignment
- Strict Row Level Security policies enforcing workspace data containment

## Phase 3: Email Account Infrastructure
- Connect email account interface supporting Gmail, M365, Zoho, custom IMAP/SMTP
- AES-256-GCM symmetric encryption for credential storage
- IMAP and SMTP connection validation routines

## Phase 4: Lead Management Engine
- Lead manual creation and table view with filtering and status tags
- PapaParse CSV import with variable mapping (first_name, last_name, company, etc.)
- CSV export for reporting
- Duplicate detection and suppression list checking

## Phase 5: Campaign Builder & Follow-Up Sequence
- Sequence builder with configurable delay steps (Day 0, Day 2, Day 4, etc.)
- Dynamic variable substitution (`{{first_name}}`, `{{company}}`, `{{job_title}}`)
- Sending schedule windows (timezones, active hours, sending days)
- Stop sequence conditions (stop on reply, stop on bounce, stop on unsubscribe)

## Phase 6: Unibox (Unified Inbox)
- Unified message inbox with email thread reconstruction
- Thread grouping by Message-ID, In-Reply-To, and References
- Direct reply composer preserving original sending identity
- Realtime Supabase updates on new inbound messages

## Phase 7: Analytics & Reporting
- Daily sending volume and engagement breakdown charts (Recharts)
- Calculation of SMTP acceptance, open rates, reply rates, bounce rates
- Aggregated campaign performance views

## Phase 8: Super Admin Platform Management
- Platform-wide dashboard with total metrics across all tenants
- Customer suspension and activation management
- Workspace directory and status controls
- Security audit logs tracking privileged events

## Phase 9: Background Worker Service
- BullMQ + Redis task queue for rate-limited SMTP email dispatch
- IMAP sync daemon fetching new inbound messages
- Follow-up scheduler polling and advancing sequence steps
- Bounce and unsubscribe processor updating suppression lists
