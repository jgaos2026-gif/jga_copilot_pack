# Supabase Configuration & Schema

Complete guide to JGA Enterprise OS Supabase setup, schema, and row-level security policies.

## Quick Start

### 1. Initialize Supabase Project

```bash
# Install Supabase CLI
npm install -g supabase

# Link to existing Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Or create new
supabase projects create
```

### 2. Apply Migrations

```bash
# Create initial schema
supabase db pull  # If pulling existing schema

# Or apply migrations
supabase migration up

# Run specific migration
supabase migration up --version 20240101000000
```

### 3. Seed Demo Data

```bash
# Apply seed data for development
supabase seed run
```

## Database Schema

### Core Tables

#### `customers`
```sql
id (uuid, PK)
state_code (text, 2-char code: IL, TX, CA, etc.)
company_name (text)
contact_name (text)
email (text)
phone (text)
status (enum: active, inactive, paused)
created_at (timestamp)
updated_at (timestamp)
metadata (jsonb)
___
-- State isolation key
-- Row Level Security: Clients can only see their own record
```

#### `projects`
```sql
id (uuid, PK)
customer_id (uuid, FK → customers)
state_code (text, inherited from customer)
name (text)
description (text)
status (enum: intake, quoted, contract_pending, active, production, completed, cancelled)
deposit_status (enum: not_required, pending, confirmed)
contract_status (enum: pending, signed, expired)
estimated_value (numeric)
service_type (text)
created_at (timestamp)
updated_at (timestamp)
___
-- Cannot enter 'active' without signed contract (enforced by application)
-- Cannot begin production without deposit confirmed
```

#### `transactions`
```sql
id (uuid, PK)
project_id (uuid, FK → projects)
customer_id (uuid, FK → customers)
state_code (text)
type (enum: deposit, payment, refund, adjustment)
amount (numeric)
description (text)
reference_id (text, e.g., invoice number)
created_by (uuid, FK → auth.users)
created_at (timestamp)
___
-- Immutable - never updated after creation
-- All financial history is append-only
```

#### `contracts`
```sql
id (uuid, PK)
project_id (uuid, FK → projects)
customer_id (uuid, FK → customers)
state_code (text)
document_url (text)
signed_at (timestamp)
expires_at (timestamp)
terms (jsonb)
metadata (jsonb)
created_at (timestamp)
___
-- Referenced by projects.contract_status
-- Signature required before project.status = 'active'
```

#### `audit_log`
```sql
id (uuid, PK)
event_type (text)
entity_type (text)
entity_id (uuid)
state_code (text)
old_values (jsonb)
new_values (jsonb)
changed_by (uuid, FK → auth.users)
changed_at (timestamp)
ip_address (text)
user_agent (text)
___
-- Append-only audit trail
-- Cannot be deleted
-- Captures all sensitive changes
```

#### `contractors`
```sql
id (uuid, PK)
user_id (uuid, FK → auth.users)
state_code (text)
specialty (text)
availability (enum: available, booked, unavailable)
rate_per_hour (numeric)
metadata (jsonb)
created_at (timestamp)
updated_at (timestamp)
___
-- Contractors have limited visibility
-- Can only see assigned projects and tasks
```

### State Isolation Tables

Data must be physically isolated by state. Consider state-specific schemas:

```
public.customers_ca
public.customers_il
public.customers_tx
-- or RLS policies enforcing state separation
```

## Row-Level Security (RLS) Policies

### Enable RLS

```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
```

### Customer RLS Policy

```sql
CREATE POLICY "customers_self_isolation" ON customers
  FOR ALL USING (
    auth.uid() = ANY(
      SELECT user_id FROM customer_users 
      WHERE customer_id = customers.id
    )
  );
```

### Contractor RLS Policy

```sql
CREATE POLICY "contractors_view_assigned" ON projects
  FOR SELECT USING (
    id = ANY(
      SELECT project_id FROM project_assignments
      WHERE contractor_id = (
        SELECT id FROM contractors WHERE user_id = auth.uid()
      )
    )
  );
```

### Admin Policy (with MFA requirement)

```sql
-- Admins can see all, but this is enforced at application layer
-- Application must verify MFA before allowing admin API calls
CREATE POLICY "admins_all_access" ON customers
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin' AND
    auth.jwt() ->> 'mfa_verified' = 'true'
  );
```

### Audit Log - Append Only

```sql
CREATE POLICY "audit_log_append_only" ON audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "audit_log_no_delete" ON audit_log
  FOR DELETE USING (false);

CREATE POLICY "audit_log_no_update" ON audit_log
  FOR UPDATE USING (false);
```

### State Code Isolation

```sql
-- Enforce state-based access
CREATE POLICY "state_isolation_ca" ON customers
  FOR ALL USING (
    state_code = 'CA' AND
    EXISTS (
      SELECT 1 FROM admin_state_access
      WHERE user_id = auth.uid()
      AND state_code = customers.state_code
    )
  );
-- Repeat for each state
```

## Migrations

Store migrations in `supabase/migrations/TIMESTAMP_description.sql`

### Example Migration

```sql
-- supabase/migrations/20240101000000_initial_schema.sql

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code text NOT NULL,
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  status text DEFAULT 'active',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  state_code text NOT NULL,
  name text NOT NULL,
  description text,
  status text DEFAULT 'intake',
  deposit_status text DEFAULT 'pending',
  contract_status text DEFAULT 'pending',
  estimated_value numeric,
  service_type text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_projects_customer_id ON projects(customer_id);
CREATE INDEX idx_projects_state_code ON projects(state_code);
CREATE INDEX idx_customers_state_code ON customers(state_code);
```

## Seeding Data

Create `supabase/seed.sql`:

```sql
-- Seed companies
INSERT INTO customers (state_code, company_name, contact_name, email, status)
VALUES
  ('CA', 'TechCorp', 'Alice', 'alice@techcorp.com', 'active'),
  ('IL', 'DesignStudio', 'Bob', 'bob@design.com', 'active'),
  ('TX', 'Marketing Pro', 'Carol', 'carol@mktgpro.com', 'active');

-- Seed projects
INSERT INTO projects (customer_id, state_code, name, status, deposit_status)
SELECT 
  id,
  state_code,
  'Project: ' || company_name,
  'active',
  'confirmed'
FROM customers LIMIT 3;
```

Apply with:
```bash
supabase seed run
```

## Authentication & Authorization

### Setup Auth

```typescript
// lib/auth.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side with service role
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### User Roles

```sql
-- Create roles table
CREATE TABLE user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  role text CHECK (role IN ('owner', 'admin', 'staff', 'contractor', 'client')),
  state_codes text[] DEFAULT '{}',
  mfa_enabled boolean DEFAULT false,
  mfa_verified_at timestamp,
  created_at timestamp DEFAULT now()
);
```

### MFA Implementation

Admins and owners must use MFA:

```typescript
// Verify MFA before sensitive operations
if (user.role === 'admin' || user.role === 'owner') {
  if (!user.mfa_verified || isExpired(user.mfa_verified_at)) {
    return unauthorized('MFA required');
  }
}
```

## Compliance Checkpoints

### System Law #2: Spine Has No Customer Data

Ensure policy engine (Spine) never accesses:
- ❌ Customer names
- ❌ Email addresses
- ❌ Phone numbers
- ❌ Project details
- ❌ Contract terms
- ✅ Only: Policy references, state codes, status flags

### System Law #3: System B Metadata-Only

Capture layer access:
- ✅ Allowed: Event timestamps, action types, state codes, status changes
- ❌ Forbidden: Customer data, financial amounts, contract details

### System Law #4: State Isolation

Enforce in RLS:
```sql
-- If user is CA admin, they cannot query IL data
CREATE POLICY "state_isolation" ON customers
  FOR ALL USING (
    state_code = ANY(
      SELECT state_codes FROM user_roles WHERE user_id = auth.uid()
    )
  );
```

## Backup & Recovery

### Automated Backups

Supabase backs up daily. Configure retention:
```bash
supabase projects update --backup-retain-days 30
```

### Manual Backup

```bash
supabase db dump > backup.sql
```

### Restore

```bash
supabase db push < backup.sql
```

## Monitoring

### Check Replication

```bash
supabase projects describe
```

### Monitor Realtime

```typescript
// Listen for changes
const subscription = supabase
  .from('customers')
  .on('*', payload => {
    console.log('Change:', payload);
  })
  .subscribe();
```

## Troubleshooting

### RLS Denying All Access

```sql
-- Check if RLS is blocking legitimate access
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;  -- Temporary debug
-- Then re-enable and fix policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
```

### Performance Issues

```sql
-- Check indexes
SELECT * FROM pg_indexes WHERE tablename = 'projects';

-- Add missing indexes
CREATE INDEX idx_transactions_state_code ON transactions(state_code);
```

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/introduction)
- [Vector for AI Features](https://supabase.com/docs/guides/database/extensions/pgvector)

---

**Last Updated:** March 2026
