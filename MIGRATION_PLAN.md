# 🚀 EMMIL - Supabase Setup & Migration Guide

Is guide ko follow karke aap easily apne Supabase project ko connect aur migrate kar sakte hain.

---

## 1. Supabase Project Create Karna

1. [Supabase Dashboard](https://supabase.com/dashboard) par jayein aur **New Project** par click karein.
2. Project ka naam rakhein (jaise `emmil-saas`) aur strong Database Password select karein.
3. Region select karke **Create new project** par click karein.

---

## 2. API Keys Aur Credentials Copy Karna

Project create hone ke baad:
1. Left sidebar se **Project Settings** (Gear icon ⚙️) -> **API** par jayein.
2. Wahan se yeh 3 values copy karein:
   - **Project URL** (jaise `https://xyzcompany.supabase.co`)
   - **anon public key** (`eyJh...`)
   - **service_role secret key** (`eyJh...`) (⚠️ *Yeh key kisi ko mat dikhaiye, sirf worker ke liye hai*)

---

## 3. `.env` File Update Karna

Project ke root directory me `.env` file ko open karein aur apni actual values paste karein:

```env
# Frontend Keys
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend Worker Keys
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 32 Character Encryption Key (Kisi bhi random string ko rakh sakte hain)
ENCRYPTION_KEY=emmil_32_byte_secret_key_prod_99

# Redis Queue Connection (Local ya Upstash Redis)
REDIS_URL=redis://127.0.0.1:6379
```

---

## 4. Database Migrations Run Karna (Line-by-Line)

Aapke paas do options hain:

### Option A: 1-Click Master Migration (Sabse Easy & Recommended)
1. Supabase Dashboard me left sidebar se **SQL Editor** par jayein.
2. **New query** par click karein.
3. Repository me bani hui file `supabase/schema.sql` ko open karein, pura code **Select All (Ctrl+A) -> Copy** karein.
4. Supabase SQL Editor me Paste karein aur green **Run** button press karein.
5. Saare 25 tables, indexes, triggers, aur demo seed data 5 seconds me create ho jayenge!

---

### Option B: Step-by-Step Individual Migrations (Command Line / Manual)

Agar aap line-by-line chalana chahte hain, toh SQL Editor me yeh 4 queries sequentially run karein:

#### Step 1: Base Schema (Tables & Foreign Keys)
Run file: `supabase/migrations/001_initial_schema.sql`
- Creates:
  - `profiles`
  - `customers`
  - `workspaces`
  - `workspace_members`
  - `workspace_invitations`
  - `email_accounts`
  - `email_account_credentials`
  - `email_sync_states`
  - `email_folders`
  - `leads`
  - `lead_lists`
  - `lead_list_members`
  - `campaigns`
  - `campaign_sequences`
  - `campaign_leads`
  - `campaign_step_executions`
  - `conversations`
  - `email_messages`
  - `email_events`
  - `sending_queue`
  - `suppression_list`
  - `campaign_analytics`
  - `subscriptions`
  - `usage_logs`
  - `audit_logs`

#### Step 2: Row Level Security (RLS) & Multi-Tenant Isolation
Run file: `supabase/migrations/002_rls_policies.sql`
- Sets up workspace isolation functions `is_workspace_member`, `is_super_admin`.
- Enforces strict tenant containment so workspace A users cannot see workspace B data.

#### Step 3: Automated Triggers & Reply Detection
Run file: `supabase/migrations/003_triggers_and_functions.sql`
- Configures auto-profile creation on user signup.
- Configures reply detection: automatically stops outreach sequence for a lead when an inbound reply is received.
- Configures bounce and unsubscribe suppression triggers.

#### Step 4: Demo Data & Initial Seed
Run file: `supabase/migrations/004_seed_data.sql`
- Seeds a demo customer, demo workspace, sample campaign sequence, leads, unibox thread, and analytics chart points.

---

## 5. Application Start Karna

### Frontend:
```bash
# Terminal 1: Frontend Dev Server
npm run dev
```
Frontend `http://localhost:5173` par open ho jayega!

### Production Build:
```bash
npm run build
```

### Background Worker (Email Sending & IMAP Inbound Sync):
```bash
# Terminal 2: Worker directory
cd worker
npm install
npm run dev
```

---

## 6. Verification Checklist

- [x] Sign up a new user via `/register` -> Profile automatically created.
- [x] First user automatically becomes Super Admin.
- [x] Workspace creation via `/workspace/setup` -> Isolated tenant created.
- [x] Connect email accounts in Email Accounts tab.
- [x] Import CSV leads or add manually.
- [x] Launch campaign with multi-step sequence.
- [x] Verify real-time Unibox conversation threading and replies.
