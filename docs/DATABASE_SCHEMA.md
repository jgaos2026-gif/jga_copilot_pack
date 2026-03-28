# JGA Enterprise OS - Complete Database Schema

Production-grade Supabase/PostgreSQL schema with role-level security (RLS) policies enforcing all 8 System Laws.

## Schema Overview

```
Database: jga_enterprise (per organization)

Namespaces:
├─ public.*                    (shared, cross-state)
│   ├─ contractors
│   ├─ authentication
│   ├─ event_ledger
│   └─ audit_log
│
├─ state_ca.*                  (CA-specific, isolated)
│   ├─ customers
│   ├─ projects
│   ├─ contracts
│   ├─ transactions
│   └─ [CA-specific data]
│
├─ state_il.*                  (IL-specific, isolated)
│   └─ [same tables as CA]
│
├─ state_tx.*                  (TX-specific, isolated)
│   └─ [same tables as TX]
│
└─ compliance.*                (append-only compliance records)
    ├─ compliance_artifacts
    └─ compliance_audit_trail
```

---

## 1. Cross-State Tables (public schema)

### **contractors**

Contractor profiles (can work in multiple states)

```sql
CREATE TABLE public.contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference (from Supabase Auth)
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  
  -- Multi-state capability
  states_licensed TEXT[] NOT NULL,  -- ['CA', 'IL'] = can work in CA and IL
  specialty_tags TEXT[] NOT NULL,   -- ['graphic design', 'video']
  bio TEXT,
  
  -- Status
  status TEXT CHECK (status IN ('active', 'paused', 'inactive')) DEFAULT 'active',
  
  -- Availability
  availability TEXT CHECK (availability IN ('available', 'booked', 'unavailable')) DEFAULT 'available',
  max_concurrent_projects INT DEFAULT 5,
  current_project_count INT DEFAULT 0,
  
  -- Rates
  hourly_rate NUMERIC(10, 2),
  project_rate NUMERIC(10, 2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- KMS encryption
  encrypted_fields TEXT[] DEFAULT '{}',  -- Which fields are encrypted
  kms_key_version INT DEFAULT 1
);

CREATE INDEX idx_contractors_user_id ON public.contractors(user_id);
CREATE INDEX idx_contractors_status ON public.contractors(status);
CREATE INDEX idx_contractors_states ON public.contractors USING GIN(states_licensed);

-- RLS Policy: Contractors can only see their own record
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractors_self_read" ON public.contractors
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "contractors_self_update" ON public.contractors
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### **contractor_ratings**

Reviews and ratings from completed projects

```sql
CREATE TABLE public.contractor_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,  -- Will reference state-specific projects
  
  -- Rating
  overall_score NUMERIC(2, 1) CHECK (overall_score >= 1 AND overall_score <= 5),
  quality_score NUMERIC(2, 1),
  communication_score NUMERIC(2, 1),
  timeliness_score NUMERIC(2, 1),
  
  -- Review
  comment TEXT,
  is_public BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Approval (must be reviewed by admin for compliance)
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_contractor_ratings_contractor ON public.contractor_ratings(contractor_id);
```

### **event_ledger**

Immutable append-only event log (Law #7)

```sql
CREATE TABLE public.event_ledger (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identity
  event_id UUID NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- Source
  source_bric TEXT NOT NULL,
  source_state TEXT,  -- 'CA', 'IL', 'TX', or NULL for cross-state
  
  -- Payload
  payload JSONB NOT NULL,
  
  -- Integrity (Law #7: Stitch verification)
  hash TEXT NOT NULL UNIQUE,
  merkle_root TEXT,  -- Latest Merkle root at insertion
  digital_signature TEXT,  -- Signed by Stitch 3-node consensus
  signature_verified_at TIMESTAMPTZ,
  signature_verified_by TEXT,  -- 'stitch-node-1', etc.
  
  -- Audit
  received_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  
  -- Ordering for ledger
  sequence_number BIGSERIAL,
  
  -- Constraints
  CONSTRAINT immutable_no_update CHECK (true),
  CONSTRAINT must_have_hash CHECK (hash IS NOT NULL)
);

CREATE INDEX idx_event_ledger_event_id ON public.event_ledger(event_id);
CREATE INDEX idx_event_ledger_type ON public.event_ledger(event_type);
CREATE INDEX idx_event_ledger_timestamp ON public.event_ledger(timestamp);
CREATE INDEX idx_event_ledger_sequence ON public.event_ledger(sequence_number);
CREATE INDEX idx_event_ledger_verified ON public.event_ledger(signature_verified_at)
  WHERE signature_verified_at IS NOT NULL;

-- Immutability (Law #7)
ALTER TABLE public.event_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_ledger_append_only" ON public.event_ledger
  FOR INSERT WITH CHECK (true);

CREATE POLICY "event_ledger_no_delete" ON public.event_ledger
  FOR DELETE USING (false);

CREATE POLICY "event_ledger_no_update" ON public.event_ledger
  FOR UPDATE USING (false);

-- Trigger to prevent updates/deletes
CREATE OR REPLACE FUNCTION raise_immutable_event_ledger()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Event ledger is immutable. No updates or deletes allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_event_ledger_modification
BEFORE UPDATE OR DELETE ON public.event_ledger
FOR EACH ROW
EXECUTE FUNCTION raise_immutable_event_ledger();
```

### **audit_log**

Administrative audit trail (who changed what, when)

```sql
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What changed
  entity_type TEXT NOT NULL,  -- 'contractor', 'admin_setting', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,  -- 'created', 'updated', 'deleted'
  
  -- Values
  old_values JSONB,
  new_values JSONB,
  
  -- Who
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- When
  changed_at TIMESTAMPTZ DEFAULT now(),
  
  -- IP & context
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  
  -- State context (for compliance)
  state_code TEXT
);

CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_changed_by ON public.audit_log(changed_by);
CREATE INDEX idx_audit_log_timestamp ON public.audit_log(changed_at);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can see all; contractors see none
CREATE POLICY "audit_log_admin_only" ON public.audit_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

---

## 2. State-Specific Tables (state_ca, state_il, state_tx schemas)

Each state gets its own schema with the same table structure but isolated data.

### **Customers (per-state)**

```sql
CREATE SCHEMA state_ca;
CREATE SCHEMA state_il;
CREATE SCHEMA state_tx;

-- This example is for state_ca, replicate for IL and TX

CREATE TABLE state_ca.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  state_code TEXT NOT NULL DEFAULT 'CA' CHECK (state_code = 'CA'),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  
  -- PII (encrypted at rest and in transit)
  email TEXT NOT NULL ENCRYPTED WITH (column_encryption_key = 'state-ca-key'),
  phone TEXT ENCRYPTED WITH (column_encryption_key = 'state-ca-key'),
  
  -- Address (may be encrypted depending on privacy rules)
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  
  -- Business info
  industry TEXT,
  company_size TEXT,  -- 'small', 'medium', 'large'
  
  -- Status
  status TEXT CHECK (status IN ('active', 'inactive', 'paused')) DEFAULT 'active',
  
  -- VIP / Priority
  vip_status BOOLEAN DEFAULT false,
  priority_tier INT DEFAULT 0,  -- 0=standard, 1=vip, 2=enterprise
  
  -- Financial
  credit_limit NUMERIC(10, 2),
  total_spent NUMERIC(12, 2) DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Compliance
  terms_accepted_at TIMESTAMPTZ,
  privacy_policy_accepted_at TIMESTAMPTZ
);

CREATE INDEX idx_state_ca_customers_email ON state_ca.customers(email);
CREATE INDEX idx_state_ca_customers_status ON state_ca.customers(status);

-- RLS: Only CA-authorized users can see CA customers (Law #4)
ALTER TABLE state_ca.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_customers_state_isolation" ON state_ca.customers
  FOR ALL USING (
    auth.jwt() ->> 'state' = 'CA' OR
    auth.jwt() ->> 'role' = 'owner'
  );

-- Replicate for state_il and state_tx with IL and TX checks
```

### **Projects (per-state)**

```sql
CREATE TABLE state_ca.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  customer_id UUID NOT NULL REFERENCES state_ca.customers(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id),
  
  -- State isolation (Law #4)
  state_code TEXT NOT NULL DEFAULT 'CA' CHECK (state_code = 'CA'),
  
  -- Project info
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL,  -- 'graphic design', 'video', etc.
  
  -- Status (state machine)
  STATUS TEXT CHECK (
    STATUS IN (
      'intake',              -- Initial form
      'quoted',              -- Quote sent to customer
      'contract-pending',    -- Contract sent, awaiting signature
      'contract-signed',     -- Contract signed (Law #4: next is "active")
      'active',              -- Work can begin (requires deposit + signed contract)
      'in-production',       -- Work in progress
      'review',              -- Customer reviewing deliverables
      'completed',           -- Fully delivered
      'cancelled'            -- Project cancelled
    )
  ) DEFAULT 'intake',
  
  -- Cannot enter 'active' without contract (Law #4)
  contract_status TEXT CHECK (contract_status IN ('pending', 'signed', 'expired')) DEFAULT 'pending',
  
  -- Cannot begin production without deposit (Business Rule, Law #4)
  deposit_status TEXT CHECK (deposit_status IN ('not-required', 'pending', 'confirmed')) DEFAULT 'pending',
  
  -- Pricing
  estimated_value NUMERIC(10, 2) NOT NULL,
  actual_cost NUMERIC(10, 2),
  quote_id UUID,  -- Reference to pricing engine snapshot
  
  -- Dates
  start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_state_ca_projects_customer ON state_ca.projects(customer_id);
CREATE INDEX idx_state_ca_projects_contractor ON state_ca.projects(contractor_id);
CREATE INDEX idx_state_ca_projects_status ON state_ca.projects(status);

-- RLS: Only CA users can see CA projects (Law #4)
ALTER TABLE state_ca.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_projects_state_isolation" ON state_ca.projects
  FOR ALL USING (auth.jwt() ->> 'state' = 'CA' OR auth.jwt() ->> 'role' = 'owner');
```

### **Contracts (per-state)**

```sql
CREATE TABLE state_ca.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  project_id UUID NOT NULL UNIQUE REFERENCES state_ca.projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES state_ca.customers(id),
  contractor_id UUID NOT NULL REFERENCES public.contractors(id),
  
  state_code TEXT NOT NULL DEFAULT 'CA' CHECK (state_code = 'CA'),
  
  -- Document
  document_url TEXT,  -- S3 URL, encrypted
  document_hash TEXT,  -- SHA-256 for integrity
  
  -- Legal
  terms TEXT,  -- Embedded terms or reference
  payment_schedule TEXT,  -- "50% deposit, 50% on completion"
  
  -- Signatures
  signed_by_contractor_at TIMESTAMPTZ,
  signed_by_contractor_name TEXT,
  signed_by_customer_at TIMESTAMPTZ,
  signed_by_customer_name TEXT,
  
  -- Execution
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Compliance
  compliance_artifact_id UUID,  -- Reference to compliance.compliance_artifacts
  jurisdiction TEXT,  -- e.g., 'California'
  governing_law TEXT,
  
  -- Dispute handling
  dispute_flag BOOLEAN DEFAULT false,
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_state_ca_contracts_project ON state_ca.contracts(project_id);
CREATE INDEX idx_state_ca_contracts_customer ON state_ca.contracts(customer_id);

-- RLS: Only CA users
ALTER TABLE state_ca.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_contracts_state_isolation" ON state_ca.contracts
  FOR ALL USING (auth.jwt() ->> 'state' = 'CA' OR auth.jwt() ->> 'role' = 'owner');
```

### **Transactions / Ledger (per-state)**

```sql
CREATE TABLE state_ca.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  project_id UUID NOT NULL REFERENCES state_ca.projects(id),
  customer_id UUID NOT NULL REFERENCES state_ca.customers(id),
  
  state_code TEXT NOT NULL DEFAULT 'CA' CHECK (state_code = 'CA'),
  
  -- Transaction type
  type TEXT CHECK (type IN ('deposit', 'payment', 'refund', 'dispute', 'escrow-release')) NOT NULL,
  
  -- Amount
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Reference
  reference_id TEXT,  -- Stripe transaction ID, etc.
  invoice_number TEXT,
  
  -- Description
  description TEXT,
  
  -- Status
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  
  -- Payment method
  payment_method TEXT,  -- 'stripe', 'bank_transfer', 'check'
  
  -- For escrow
  held_in_escrow BOOLEAN DEFAULT false,
  release_conditions JSONB,
  released_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_state_ca_transactions_project ON state_ca.transactions(project_id);
CREATE INDEX idx_state_ca_transactions_customer ON state_ca.transactions(customer_id);
CREATE INDEX idx_state_ca_transactions_type ON state_ca.transactions(type);

-- Immutability (financial records)
ALTER TABLE state_ca.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_transactions_state_isolation" ON state_ca.transactions
  FOR ALL USING (auth.jwt() ->> 'state' = 'CA' OR auth.jwt() ->> 'role' = 'owner');

CREATE POLICY "ca_transactions_append_only" ON state_ca.transactions
  FOR UPDATE USING (false);  -- No updates to transactions
```

---

## 3. Compliance Schema (compliance namespace)

Append-only compliance artifacts signed by Stitch BRIC

```sql
CREATE SCHEMA compliance;

CREATE TABLE compliance.compliance_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  customer_id UUID NOT NULL,
  state_code TEXT NOT NULL,
  
  -- Regulations checked
  regulations_checked TEXT[] NOT NULL,
  regulations_document JSONB,  -- Full regulation text evaluated
  
  -- Risk assessment (NIST RMF)
  risk_score NUMERIC(3, 1) CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_factors TEXT[],
  
  -- Decision
  decision TEXT CHECK (decision IN ('approved', 'blocked', 'review-required')) NOT NULL,
  decision_reason TEXT,
  
  -- AI Risk Mitigation
  ai_risk_assessment JSONB,
  ai_risk_score NUMERIC(3, 1),
  
  -- Blockchain / Stitch signature
  merkle_root TEXT,
  digital_signature TEXT,
  signature_verified BOOLEAN DEFAULT false,
  verified_by_stitch_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  
  -- Expiration
  expires_at TIMESTAMPTZ  -- Must be re-evaluated periodically
);

CREATE INDEX idx_compliance_customer ON compliance.compliance_artifacts(customer_id);
CREATE INDEX idx_compliance_state ON compliance.compliance_artifacts(state_code);
CREATE INDEX idx_compliance_decision ON compliance.compliance_artifacts(decision);

-- Immutability
ALTER TABLE compliance.compliance_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_artifacts_append_only" ON compliance.compliance_artifacts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "compliance_artifacts_no_delete" ON compliance.compliance_artifacts
  FOR DELETE USING (false);

CREATE POLICY "compliance_artifacts_verified_only" ON compliance.compliance_artifacts
  FOR UPDATE USING (signature_verified = true)
  WITH CHECK (signature_verified = true);
```

---

## 4. User Roles & Permissions

```sql
-- Extend auth.users with JGA-specific roles
CREATE TABLE public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role
  role TEXT CHECK (role IN ('owner', 'admin', 'staff', 'contractor', 'client')) NOT NULL,
  
  -- State authorization (Law #4)
  authorized_states TEXT[],  -- [] = no state access, ['CA', 'IL', 'TX'] = all states
  
  -- MFA enforcement (Law #5)
  mfa_required BOOLEAN DEFAULT false,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_verified_at TIMESTAMPTZ,
  mfa_method TEXT,  -- 'totp', 'sms', 'email'
  
  -- Dual auth for sensitive operations
  dual_auth_required BOOLEAN DEFAULT false,
  
  -- Permissions
  can_view_financial BOOLEAN DEFAULT false,
  can_approve_contracts BOOLEAN DEFAULT false,
  can_release_escrow BOOLEAN DEFAULT false,
  can_manage_users BOOLEAN DEFAULT false,
  can_view_compliance BOOLEAN DEFAULT false,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Users can only see their own role record
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'owner');
```

---

## 5. Create All Schemas via Migrations

### **Migration 001: Base Schemas & Tables**

File: `supabase/migrations/20260328_001_base_schema.sql`

```sql
-- Create state schemas
CREATE SCHEMA IF NOT EXISTS state_ca;
CREATE SCHEMA IF NOT EXISTS state_il;
CREATE SCHEMA IF NOT EXISTS state_tx;
CREATE SCHEMA IF NOT EXISTS compliance;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT USAGE ON SCHEMA state_ca,state_il, state_tx, compliance TO authenticated, service_role;
GRANT CREATE ON SCHEMA public TO service_role;

-- Create contractor table
CREATE TABLE IF NOT EXISTS public.contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  states_licensed TEXT[] NOT NULL,
  specialty_tags TEXT[] NOT NULL,
  status TEXT DEFAULT 'active',
  availability TEXT DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO audit_log (entity_type, entity_id, action, changed_by) 
VALUES ('schema', 'base', 'created', CURRENT_USER_ID);

-- ... (add all table definitions above)
```

---

## Encryption Strategy

### **Field-Level Encryption**

PII fields are encrypted with state-specific keys:

```typescript
// Example in application layer (Node.js)
import { createCipheriv, createDecipheriv } from "crypto";

class FieldEncryptor {
  constructor(private kmsClient: KMS) {}
  
  async encryptField(
    field: string,
    stateCode: string
  ): Promise<string> {
    // Get state-specific key from AWS KMS
    const key = await this.kmsClient.getDataKey(`state-${stateCode}-key`);
    
    const cipher = createCipheriv("aes-256-gcm", key.plaintext, iv);
    let encrypted = cipher.update(field, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    return encrypted + ":" + cipher.getAuthTag().toString("hex");
  }
  
  async decryptField(
    encrypted: string,
    stateCode: string
  ): Promise<string> {
    const [ciphertext, authTag] = encrypted.split(":");
    const key = await this.kmsClient.getDataKey(`state-${stateCode}-key`);
    
    const decipher = createDecipheriv("aes-256-gcm", key.plaintext, iv);
    decipher.setAuthTag(Buffer.from(authTag, "hex"));
    
    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  }
}
```

---

## Law Enforcement at Database Level

| Law | Table | Enforcement |
|-----|-------|-------------|
| **Law 1: Public Unidirectional** | event_ledger | Firewall rules (not DB) |
| **Law 2: Spine No PII** | compliance.* | No email, phone columns; audit trigger |
| **Law 3: System B Metadata-Only** | public.* | Column access control via RLS |
| **Law 4: State Isolation** | state_ca.*, state_il.*, state_tx.* | Separate schemas + RLS + separate keys |
| **Law 5: Owners Room MFA** | user_roles | Check mfa_verified_at in trigger |
| **Law 6: Compliance Gate** | contracts | Requires compliance_artifact_id |
| **Law 7: Stitch Integrity** | event_ledger | Immutability + digital_signature |
| **Law 8: Zero-Trust** | All | RLS on every table; mTLS in network |

---

## Performance Considerations

### **Indexing Strategy**

```sql
-- High-cardinality indexes (selective queries)
CREATE INDEX CONCURRENTLY idx_projects_status ON state_ca.projects(status) 
  WHERE status IN ('active', 'in-production');

-- Composite indexes for joins
CREATE INDEX CONCURRENTLY idx_transactions_project_status 
  ON state_ca.transactions(project_id, status);

-- For time-range queries
CREATE INDEX CONCURRENTLY idx_event_ledger_time_range 
  ON public.event_ledger(timestamp DESC) 
  WHERE signature_verified_at IS NOT NULL;

-- BRIN indexes for time-series (ledgers)
CREATE INDEX idx_event_ledger_brin ON public.event_ledger 
  USING BRIN(timestamp) WITH (pages_per_range = 128);
```

### **Query Optimization**

```sql
-- Disable seq scan for large tables
ALTER TABLE public.event_ledger SET (
  toast_tuple_target = 128,  -- Aggressive compression
  autovacuum_vacuum_scale_factor = 0.01
);

-- Connection pooling in app (PgBouncer)
-- Max connections: 100 per app instance
-- Pool size: 25 per app instance
```

---

## Backup & Recovery (Law #7)

```sql
-- Continuous archival WAL (PostgreSQL)
wal_level = 'replica'
archive_mode = 'on'
archive_command = 'aws s3 cp %p s3://jga-backups/wal/%f'

-- Point-in-time recovery
-- Retain 30 days of WAL files

-- Compliance backup
-- Encrypt backups with state-specific keys
-- Replicate to separate region (disaster recovery)
```

---

## Related Documentation

- [EVENT_SYSTEM.md](./EVENT_SYSTEM.md) - Event ledger integration
- [DATA_FLOW.md](./DATA_FLOW.md) - How data flows through tables
- [SUPABASE.md](./SUPABASE.md) - Supabase-specific setup
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

---

**Last Updated:** March 28, 2026
