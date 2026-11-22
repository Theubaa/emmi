# Architectural Decisions Record (ADR) - EMMIL

## 1. Multi-Tenant Workspace Model
- **Decision:** Use shared database with discriminator column (`workspace_id`) on all tenant tables and strict PostgreSQL Row Level Security (RLS).
- **Rationale:** Ensures clean multi-tenant isolation without the operational overhead of running separate database clusters per customer, while guaranteeing security at the database engine level.

## 2. Decoupled Background Worker Architecture
- **Decision:** Split frontend React SPA and heavy email operations into a standalone Node.js service running BullMQ and Redis.
- **Rationale:** Sending thousands of cold emails and long-polling/syncing IMAP folders cannot be executed directly from a serverless frontend or client browser. Redis + BullMQ provides retry backoffs, distributed locking, rate-limiting, and fault tolerance.

## 3. Cryptographic Storage of Email Passwords
- **Decision:** Use AES-256-GCM authenticated encryption with PBKDF2 key derivation and 100,000 rounds.
- **Rationale:** SMTP and IMAP require access to user app passwords or OAuth refresh tokens to authenticate on their behalf. Plain text storage is a critical vulnerability. With AES-256-GCM, credentials are encrypted with a backend-controlled key and decrypted only within the isolated worker memory.

## 4. Email Threading Resolution
- **Decision:** Thread messages by standard RFC headers (`Message-ID`, `In-Reply-To`, `References`) with fallback to subject matching and sender email lookup.
- **Rationale:** Ensures replies in the Unibox correctly group into conversations regardless of whether the recipient used Gmail, Outlook, Apple Mail, or Thunderbird.

## 5. Automated Sequence Halting via PostgreSQL Trigger
- **Decision:** Implement reply stopping using a PostgreSQL database trigger (`handle_inbound_reply_received`) on `email_messages`.
- **Rationale:** Immediate transactional guarantee. When an inbound reply arrives, the sequence is automatically stopped and pending sending jobs are cancelled before any subsequent follow-up step can accidentally trigger.
