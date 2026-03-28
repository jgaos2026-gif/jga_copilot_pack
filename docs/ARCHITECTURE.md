# ARCHITECTURE

## Recommended stack

- Next.js App Router
- TypeScript
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Tailwind CSS
- shadcn/ui
- Zod
- Playwright
- Vitest

## App zones

### 1. Public
Unauthenticated marketing and intake.

Routes:
- `/`
- `/services`
- `/pricing`
- `/intake`
- `/legal`
- `/about`
- `/contact`

### 2. Auth
Login and role routing.

Routes:
- `/login`
- `/reset-password`

### 3. Owner/Admin Dashboard
Restricted management interface.

Routes:
- `/dashboard`
- `/dashboard/clients`
- `/dashboard/projects`
- `/dashboard/transactions`
- `/dashboard/contracts`
- `/dashboard/contractors`
- `/dashboard/ledger`
- `/dashboard/system-load`
- `/dashboard/stability`
- `/dashboard/settings`

### 4. Contractor Portal
Restricted low-authority interface.

Routes:
- `/contractor`
- `/contractor/onboarding`
- `/contractor/leads`
- `/contractor/calls`
- `/contractor/earnings`
- `/contractor/docs`

### 5. Client Portal
Optional but useful.

Routes:
- `/client`
- `/client/projects`
- `/client/contracts`
- `/client/invoices`
- `/client/files`

## Domain modules

### Business Engine
- services
- clients
- intake submissions
- projects
- deliverables metadata

### Revenue Engine
- invoices
- payment stages
- allocations
- tax reserve
- payout batches
- transaction ledger

### Intelligence Engine
- pricing rules
- urgency multipliers
- system load snapshots
- demand metrics
- quote calculations

### Control & Compliance
- contracts
- policy acknowledgements
- audit events
- state tagging
- access roles
- legal template metadata

### System B
- contractors
- lead briefs
- call logs
- commission escrow
- payout visibility
- training/rules

### Stability Layer
- daily checklist
- weekly review
- revenue tracker
- applications tracker
- health tracker

## RBAC model

### owner
Full access.

### admin
Manage operations but no owner-only continuity settings unless explicitly allowed.

### staff
Can work internal projects but cannot access contractor or owner financial controls by default.

### contractor
Limited access to own onboarding, assigned leads, own call logs, own earnings, own docs.

### client
Access only to own projects/contracts/files/invoices.

## Data design principles

- Use UUIDs
- Timestamp everything
- Store `state_tag` where relevant
- Use append-only event ledger for important actions
- Prefer explicit enums for statuses
- Store payment stages separately from project status

## Pricing engine

Server-side only.
Never trust client-calculated totals.

Formula:

`adjusted_price = base_price * demand_multiplier * urgency_multiplier * load_factor`

Inputs:
- active project count
- weekly inquiry volume
- production capacity hours
- client urgency
- service tier

## Critical guards

- `project.status = active` requires:
  - signed contract
  - paid deposit

- `project.delivery_ready = true` requires:
  - final payment paid
  - QC passed

- contractor commission release requires:
  - escrow matured OR early-release rule met
  - no dispute
  - no clawback flag

## Storage strategy

Use Supabase Storage buckets:
- `client-files`
- `contracts`
- `contractor-kyc`
- `deliverables`
- `audit-exports`

Use metadata for:
- project_id
- client_id
- contractor_id
- state_tag
- retention_class
