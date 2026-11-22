# EMMIL Platform Architecture

## Overview

EMMIL is a multi-tenant SaaS email outreach platform built with a modern web stack.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USERS                                 │
│              (Browser - React SPA)                           │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────────────┐
│                   REACT FRONTEND                             │
│          Vite + TypeScript + Tailwind + shadcn/ui            │
│          Deployed on Vercel                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │ Supabase Client SDK
         ┌──────────────▼──────────────────────────┐
         │              SUPABASE                    │
         │  ┌──────────┐  ┌──────────┐  ┌────────┐ │
         │  │   Auth   │  │   DB     │  │Storage │ │
         │  │  (JWT)   │  │PostgreSQL│  │  (S3)  │ │
         │  └──────────┘  └──────────┘  └────────┘ │
         │  ┌──────────┐  ┌──────────┐             │
         │  │ Realtime │  │  Edge    │             │
         │  │(WebSocket)│  │Functions │             │
         │  └──────────┘  └──────────┘             │
         └─────────────────────────────────────────┘
                        │
         ┌──────────────▼──────────────────────────┐
         │          BACKGROUND WORKER (VPS)         │
         │   Node.js + BullMQ + Redis               │
         │   - IMAP sync jobs                       │
         │   - Email sending queue                  │
         │   - Follow-up scheduler                  │
         │   - Bounce processor                     │
         └─────────────────────────────────────────┘
                        │
         ┌──────────────▼──────────────────────────┐
         │          EMAIL PROVIDERS                 │
         │   Gmail / Microsoft 365 / SMTP/IMAP      │
         └─────────────────────────────────────────┘
```

## Multi-Tenant Architecture

```
Super Admin
│
├── Customer A (tenant)
│   ├── Workspace A1
│   │   ├── Members (Owner, Admin, Manager, Member)
│   │   ├── Email Accounts (IMAP/SMTP)
│   │   ├── Leads & Lead Lists
│   │   ├── Campaigns & Sequences
│   │   ├── Unibox (Conversations)
│   │   └── Analytics
│   └── Workspace A2
│       └── ...
│
└── Customer B (tenant)
    └── Workspace B1
        └── ...
```

## Security Model

- **Authentication**: Supabase Auth (JWT)
- **Authorization**: PostgreSQL Row Level Security (RLS)
- **Workspace isolation**: `workspace_id` on all tenant tables
- **Secret storage**: Encrypted credentials (AES-256-GCM) server-side
- **Service role key**: Never exposed to browser
- **API keys**: Environment variables only

## Data Flow: Email Sending

```
Campaign → Sequence Step → BullMQ Queue → Worker → SMTP Provider
                                            ↑
                                    Rate limiting &
                                    Sending windows
```

## Data Flow: Email Receiving

```
Email Provider → IMAP Worker (Node.js) → Parse → Store in DB
                                                     ↓
                                             Supabase Realtime
                                                     ↓
                                               Unibox (UI)
```

## Frontend Structure

```
src/
├── app/           # App shell, router, providers
├── components/    # Shared UI components
│   └── ui/        # shadcn/ui components
├── features/      # Feature modules
│   ├── auth/
│   ├── workspace/
│   ├── email-accounts/
│   ├── campaigns/
│   ├── leads/
│   ├── unibox/
│   ├── analytics/
│   ├── team/
│   └── admin/
├── hooks/         # Custom React hooks
├── lib/           # Utility functions, supabase client
├── store/         # Global state (Zustand)
└── types/         # TypeScript type definitions
```

## Worker Structure

```
worker/
├── src/
│   ├── jobs/
│   │   ├── imap-sync.ts
│   │   ├── email-sender.ts
│   │   ├── follow-up-scheduler.ts
│   │   └── bounce-processor.ts
│   ├── lib/
│   │   ├── imap.ts
│   │   ├── smtp.ts
│   │   ├── crypto.ts
│   │   └── supabase.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```
