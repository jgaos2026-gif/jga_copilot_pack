-- JGA Enterprise OS: State-Specific Tables Migration
-- Timestamp: 20260328_002
-- Purpose: Create customer, project, contract, and transaction tables for each state (CA, IL, TX)
-- Law Enforcement: Law #4 (State Isolation), Law #6 (Compliance Gate)

-- ============================================================================
-- STEP 1: Create California StateB RIC Tables
-- ============================================================================

-- state_ca.customers
CREATE TABLE state_ca.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code TEXT NOT NULL DEFAULT 'CA' CHECK (state_code = 'CA'),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  industry TEXT,
  company_size TEXT,
  status TEXT CHECK (status IN ('active', 'inactive', 'paused')) DEFAULT 'active',
  vip_status BOOLEAN DEFAULT false,
  priority_tier INT DEFAULT 0,
  credit_limit NUMERIC(10, 2),
  total_spent NUMERIC(12, 2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  terms_accepted_at TIMESTAMPTZ,
  privacy_policy_accepted_at TIMESTAMPTZ
);

CREATE INDEX idx_state_ca_customers_email ON state_ca.customers(email);
CREATE INDEX idx_state_ca_customers_status ON state_ca.customers(status);
CREATE INDEX idx_state_ca_customers_priority ON state_ca.customers(priority_tier) WHERE vip_status = true;

ALTER TABLE state_ca.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_customers_state_isolation_read" ON state_ca.customers
  FOR SELECT USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'CA' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

CREATE POLICY "ca_customers_state_isolation_write" ON state_ca.customers
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'CA' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

CREATE POLICY "ca_customers_state_isolation_update" ON state_ca.customers
  FOR UPDATE USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'CA' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

-- state_ca.projects
CREATE TABLE state_ca.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES state_ca.customers(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id),
  state_code TEXT NOT NULL DEFAULT 'CA' CHECK (state_code = 'CA'),
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL,
  status TEXT CHECK (
    status IN (
      'intake', 'quoted', 'contract-pending', 'contract-signed',
      'active', 'in-production', 'review', 'completed', 'cancelled'
    )
  ) DEFAULT 'intake',
  contract_status TEXT CHECK (contract_status IN ('pending', 'signed', 'expired')) DEFAULT 'pending',
  deposit_status TEXT CHECK (deposit_status IN ('not-required', 'pending', 'confirmed')) DEFAULT 'pending',
  estimated_value NUMERIC(10, 2) NOT NULL,
  actual_cost NUMERIC(10, 2),
  quote_id UUID,
  start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_state_ca_projects_customer ON state_ca.projects(customer_id);
CREATE INDEX idx_state_ca_projects_contractor ON state_ca.projects(contractor_id);
CREATE INDEX idx_state_ca_projects_status ON state_ca.projects(status) 
  WHERE status IN ('active', 'in-production');
CREATE INDEX idx_state_ca_projects_dates ON state_ca.projects(start_date, target_completion_date);

ALTER TABLE state_ca.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_projects_state_isolation" ON state_ca.projects
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'CA' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

-- state_ca.contracts (Law #6: Compliance Gate)
CREATE TABLE state_ca.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES state_ca.projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES state_ca.customers(id),
  contractor_id UUID NOT NULL REFERENCES public.contractors(id),
  state_code TEXT NOT NULL DEFAULT 'CA' CHECK (state_code = 'CA'),
  document_url TEXT,
  document_hash TEXT,
  terms TEXT,
  payment_schedule TEXT,
  signed_by_contractor_at TIMESTAMPTZ,
  signed_by_contractor_name TEXT,
  signed_by_customer_at TIMESTAMPTZ,
  signed_by_customer_name TEXT,
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  compliance_artifact_id UUID NOT NULL REFERENCES compliance.compliance_artifacts(id),
  jurisdiction TEXT,
  governing_law TEXT,
  dispute_flag BOOLEAN DEFAULT false,
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_state_ca_contracts_project ON state_ca.contracts(project_id);
CREATE INDEX idx_state_ca_contracts_customer ON state_ca.contracts(customer_id);
CREATE INDEX idx_state_ca_contracts_compliance ON state_ca.contracts(compliance_artifact_id);

ALTER TABLE state_ca.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_contracts_state_isolation" ON state_ca.contracts
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'CA' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

-- state_ca.transactions (Financial ledger - immutable)
CREATE TABLE state_ca.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES state_ca.projects(id),
  customer_id UUID NOT NULL REFERENCES state_ca.customers(id),
  state_code TEXT NOT NULL DEFAULT 'CA' CHECK (state_code = 'CA'),
  type TEXT CHECK (type IN ('deposit', 'payment', 'refund', 'dispute', 'escrow-release')) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  reference_id TEXT,
  invoice_number TEXT,
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  payment_method TEXT,
  held_in_escrow BOOLEAN DEFAULT false,
  release_conditions JSONB,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_state_ca_transactions_project ON state_ca.transactions(project_id);
CREATE INDEX idx_state_ca_transactions_customer ON state_ca.transactions(customer_id);
CREATE INDEX idx_state_ca_transactions_type ON state_ca.transactions(type);
CREATE INDEX idx_state_ca_transactions_status ON state_ca.transactions(status);

ALTER TABLE state_ca.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_transactions_state_isolation" ON state_ca.transactions
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'CA' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

CREATE POLICY "ca_transactions_append_only" ON state_ca.transactions
  FOR UPDATE USING (false);

-- ============================================================================
-- STEP 2: Create Illinois State BRICs Tables
-- ============================================================================

CREATE TABLE state_il.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code TEXT NOT NULL DEFAULT 'IL' CHECK (state_code = 'IL'),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  industry TEXT,
  company_size TEXT,
  status TEXT CHECK (status IN ('active', 'inactive', 'paused')) DEFAULT 'active',
  vip_status BOOLEAN DEFAULT false,
  priority_tier INT DEFAULT 0,
  credit_limit NUMERIC(10, 2),
  total_spent NUMERIC(12, 2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  terms_accepted_at TIMESTAMPTZ,
  privacy_policy_accepted_at TIMESTAMPTZ
);

CREATE INDEX idx_state_il_customers_email ON state_il.customers(email);
CREATE INDEX idx_state_il_customers_status ON state_il.customers(status);

ALTER TABLE state_il.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "il_customers_state_isolation" ON state_il.customers
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'IL' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

CREATE TABLE state_il.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES state_il.customers(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id),
  state_code TEXT NOT NULL DEFAULT 'IL' CHECK (state_code = 'IL'),
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL,
  status TEXT CHECK (
    status IN (
      'intake', 'quoted', 'contract-pending', 'contract-signed',
      'active', 'in-production', 'review', 'completed', 'cancelled'
    )
  ) DEFAULT 'intake',
  contract_status TEXT CHECK (contract_status IN ('pending', 'signed', 'expired')) DEFAULT 'pending',
  deposit_status TEXT CHECK (deposit_status IN ('not-required', 'pending', 'confirmed')) DEFAULT 'pending',
  estimated_value NUMERIC(10, 2) NOT NULL,
  actual_cost NUMERIC(10, 2),
  quote_id UUID,
  start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_state_il_projects_customer ON state_il.projects(customer_id);
CREATE INDEX idx_state_il_projects_status ON state_il.projects(status);

ALTER TABLE state_il.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "il_projects_state_isolation" ON state_il.projects
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'IL' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

CREATE TABLE state_il.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES state_il.projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES state_il.customers(id),
  contractor_id UUID NOT NULL REFERENCES public.contractors(id),
  state_code TEXT NOT NULL DEFAULT 'IL' CHECK (state_code = 'IL'),
  document_url TEXT,
  document_hash TEXT,
  terms TEXT,
  payment_schedule TEXT,
  signed_by_contractor_at TIMESTAMPTZ,
  signed_by_contractor_name TEXT,
  signed_by_customer_at TIMESTAMPTZ,
  signed_by_customer_name TEXT,
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  compliance_artifact_id UUID NOT NULL REFERENCES compliance.compliance_artifacts(id),
  jurisdiction TEXT,
  governing_law TEXT,
  dispute_flag BOOLEAN DEFAULT false,
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_state_il_contracts_project ON state_il.contracts(project_id);

ALTER TABLE state_il.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "il_contracts_state_isolation" ON state_il.contracts
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'IL' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

CREATE TABLE state_il.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES state_il.projects(id),
  customer_id UUID NOT NULL REFERENCES state_il.customers(id),
  state_code TEXT NOT NULL DEFAULT 'IL' CHECK (state_code = 'IL'),
  type TEXT CHECK (type IN ('deposit', 'payment', 'refund', 'dispute', 'escrow-release')) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  reference_id TEXT,
  invoice_number TEXT,
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  payment_method TEXT,
  held_in_escrow BOOLEAN DEFAULT false,
  release_conditions JSONB,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_state_il_transactions_project ON state_il.transactions(project_id);

ALTER TABLE state_il.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "il_transactions_state_isolation" ON state_il.transactions
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'IL' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

-- ============================================================================
-- STEP 3: Create Texas State BRICs Tables
-- ============================================================================

CREATE TABLE state_tx.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code TEXT NOT NULL DEFAULT 'TX' CHECK (state_code = 'TX'),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  industry TEXT,
  company_size TEXT,
  status TEXT CHECK (status IN ('active', 'inactive', 'paused')) DEFAULT 'active',
  vip_status BOOLEAN DEFAULT false,
  priority_tier INT DEFAULT 0,
  credit_limit NUMERIC(10, 2),
  total_spent NUMERIC(12, 2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  terms_accepted_at TIMESTAMPTZ,
  privacy_policy_accepted_at TIMESTAMPTZ
);

CREATE INDEX idx_state_tx_customers_email ON state_tx.customers(email);
CREATE INDEX idx_state_tx_customers_status ON state_tx.customers(status);

ALTER TABLE state_tx.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tx_customers_state_isolation" ON state_tx.customers
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'TX' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

CREATE TABLE state_tx.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES state_tx.customers(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id),
  state_code TEXT NOT NULL DEFAULT 'TX' CHECK (state_code = 'TX'),
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL,
  status TEXT CHECK (
    status IN (
      'intake', 'quoted', 'contract-pending', 'contract-signed',
      'active', 'in-production', 'review', 'completed', 'cancelled'
    )
  ) DEFAULT 'intake',
  contract_status TEXT CHECK (contract_status IN ('pending', 'signed', 'expired')) DEFAULT 'pending',
  deposit_status TEXT CHECK (deposit_status IN ('not-required', 'pending', 'confirmed')) DEFAULT 'pending',
  estimated_value NUMERIC(10, 2) NOT NULL,
  actual_cost NUMERIC(10, 2),
  quote_id UUID,
  start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_state_tx_projects_customer ON state_tx.projects(customer_id);
CREATE INDEX idx_state_tx_projects_status ON state_tx.projects(status);

ALTER TABLE state_tx.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tx_projects_state_isolation" ON state_tx.projects
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'TX' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

CREATE TABLE state_tx.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES state_tx.projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES state_tx.customers(id),
  contractor_id UUID NOT NULL REFERENCES public.contractors(id),
  state_code TEXT NOT NULL DEFAULT 'TX' CHECK (state_code = 'TX'),
  document_url TEXT,
  document_hash TEXT,
  terms TEXT,
  payment_schedule TEXT,
  signed_by_contractor_at TIMESTAMPTZ,
  signed_by_contractor_name TEXT,
  signed_by_customer_at TIMESTAMPTZ,
  signed_by_customer_name TEXT,
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  compliance_artifact_id UUID NOT NULL REFERENCES compliance.compliance_artifacts(id),
  jurisdiction TEXT,
  governing_law TEXT,
  dispute_flag BOOLEAN DEFAULT false,
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_state_tx_contracts_project ON state_tx.contracts(project_id);

ALTER TABLE state_tx.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tx_contracts_state_isolation" ON state_tx.contracts
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'TX' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

CREATE TABLE state_tx.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES state_tx.projects(id),
  customer_id UUID NOT NULL REFERENCES state_tx.customers(id),
  state_code TEXT NOT NULL DEFAULT 'TX' CHECK (state_code = 'TX'),
  type TEXT CHECK (type IN ('deposit', 'payment', 'refund', 'dispute', 'escrow-release')) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  reference_id TEXT,
  invoice_number TEXT,
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  payment_method TEXT,
  held_in_escrow BOOLEAN DEFAULT false,
  release_conditions JSONB,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_state_tx_transactions_project ON state_tx.transactions(project_id);

ALTER TABLE state_tx.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tx_transactions_state_isolation" ON state_tx.transactions
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'state' = 'TX' OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner'
  );

-- ============================================================================
-- STEP 4: Verification
-- ============================================================================

DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables 
  WHERE table_schema IN ('state_ca', 'state_il', 'state_tx');
  
  RAISE NOTICE 'State-specific schema migration complete. Created % tables across CA, IL, TX.', table_count;
END;
$$;
