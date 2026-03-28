-- JGA Enterprise OS: Base Schema Migration
-- Timestamp: 20260328_001
-- Purpose: Create all core tables, schemas, and RLS policies
-- Law Enforcement: Law #1 (Public Unidirectional), Law #4 (State Isolation), Law #7 (Stitch Integrity)

-- ============================================================================
-- STEP 1: Create all namespaces
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS state_ca;
CREATE SCHEMA IF NOT EXISTS state_il;
CREATE SCHEMA IF NOT EXISTS state_tx;
CREATE SCHEMA IF NOT EXISTS compliance;

-- Grant permissions
GRANT USAGE ON SCHEMA state_ca, state_il, state_tx, compliance TO authenticated, service_role;
GRANT CREATE ON SCHEMA public TO service_role;

-- ============================================================================
-- STEP 2: Public Cross-State Tables
-- ============================================================================

-- contractors: Profiles for contractors who work across states
CREATE TABLE public.contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  states_licensed TEXT[] NOT NULL DEFAULT '{}',
  specialty_tags TEXT[] NOT NULL DEFAULT '{}',
  bio TEXT,
  status TEXT CHECK (status IN ('active', 'paused', 'inactive')) DEFAULT 'active',
  availability TEXT CHECK (availability IN ('available', 'booked', 'unavailable')) DEFAULT 'available',
  max_concurrent_projects INT DEFAULT 5,
  current_project_count INT DEFAULT 0,
  hourly_rate NUMERIC(10, 2),
  project_rate NUMERIC(10, 2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  encrypted_fields TEXT[] DEFAULT '{}',
  kms_key_version INT DEFAULT 1
);

CREATE INDEX idx_contractors_user_id ON public.contractors(user_id);
CREATE INDEX idx_contractors_status ON public.contractors(status);
CREATE INDEX idx_contractors_states ON public.contractors USING GIN(states_licensed);

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractors_self_read" ON public.contractors
  FOR SELECT USING (auth.uid() = user_id OR (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "contractors_self_update" ON public.contractors
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- contractor_ratings: Reviews from completed projects
CREATE TABLE public.contractor_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  overall_score NUMERIC(2, 1) CHECK (overall_score >= 1 AND overall_score <= 5),
  quality_score NUMERIC(2, 1),
  communication_score NUMERIC(2, 1),
  timeliness_score NUMERIC(2, 1),
  comment TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  approved_at TIMESTAMPTZ,
  approved_by UUID
);

CREATE INDEX idx_contractor_ratings_contractor ON public.contractor_ratings(contractor_id);

-- user_roles: Role and permission mappings
CREATE TABLE public.user_roles (
  user_id UUID PRIMARY KEY,
  role TEXT CHECK (role IN ('owner', 'admin', 'staff', 'contractor', 'client')) NOT NULL,
  authorized_states TEXT[] DEFAULT '{}',
  mfa_required BOOLEAN DEFAULT false,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_verified_at TIMESTAMPTZ,
  mfa_method TEXT,
  dual_auth_required BOOLEAN DEFAULT false,
  can_view_financial BOOLEAN DEFAULT false,
  can_approve_contracts BOOLEAN DEFAULT false,
  can_release_escrow BOOLEAN DEFAULT false,
  can_manage_users BOOLEAN DEFAULT false,
  can_view_compliance BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner');

-- event_ledger: Immutable append-only event log (Law #7: Stitch Integrity)
CREATE TABLE public.event_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  source_bric TEXT NOT NULL,
  source_state TEXT,
  payload JSONB NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  merkle_root TEXT,
  digital_signature TEXT,
  signature_verified_at TIMESTAMPTZ,
  signature_verified_by TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  sequence_number BIGSERIAL,
  CONSTRAINT must_have_hash CHECK (hash IS NOT NULL)
);

CREATE INDEX idx_event_ledger_event_id ON public.event_ledger(event_id);
CREATE INDEX idx_event_ledger_type ON public.event_ledger(event_type);
CREATE INDEX idx_event_ledger_timestamp ON public.event_ledger(timestamp);
CREATE INDEX idx_event_ledger_sequence ON public.event_ledger(sequence_number);
CREATE INDEX idx_event_ledger_brin ON public.event_ledger USING BRIN(timestamp) WITH (pages_per_range = 128);

ALTER TABLE public.event_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_ledger_append_only" ON public.event_ledger
  FOR INSERT WITH CHECK (true);

CREATE POLICY "event_ledger_no_delete" ON public.event_ledger
  FOR DELETE USING (false);

CREATE POLICY "event_ledger_no_update" ON public.event_ledger
  FOR UPDATE USING (false);

-- Trigger to enforce immutability of event ledger
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

-- audit_log: Administrative audit trail
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  state_code TEXT
);

CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_changed_by ON public.audit_log(changed_by);
CREATE INDEX idx_audit_log_timestamp ON public.audit_log(changed_at);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin_only" ON public.audit_log
  FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin' OR (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'owner');

-- ============================================================================
-- STEP 3: State-Specific Tables (CA, IL, TX)
-- ============================================================================

-- Macro to create state tables (executed for CA, IL, TX)
-- This will be done via separate migration files for clarity

-- ============================================================================
-- STEP 4: Compliance Schema
-- ============================================================================

CREATE TABLE compliance.compliance_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  state_code TEXT NOT NULL,
  regulations_checked TEXT[] NOT NULL DEFAULT '{}',
  regulations_document JSONB,
  risk_score NUMERIC(3, 1) CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_factors TEXT[],
  decision TEXT CHECK (decision IN ('approved', 'blocked', 'review-required')) NOT NULL,
  decision_reason TEXT,
  ai_risk_assessment JSONB,
  ai_risk_score NUMERIC(3, 1),
  merkle_root TEXT,
  digital_signature TEXT,
  signature_verified BOOLEAN DEFAULT false,
  verified_by_stitch_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_compliance_customer ON compliance.compliance_artifacts(customer_id);
CREATE INDEX idx_compliance_state ON compliance.compliance_artifacts(state_code);
CREATE INDEX idx_compliance_decision ON compliance.compliance_artifacts(decision);

ALTER TABLE compliance.compliance_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_artifacts_append_only" ON compliance.compliance_artifacts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "compliance_artifacts_no_delete" ON compliance.compliance_artifacts
  FOR DELETE USING (false);

CREATE POLICY "compliance_artifacts_verified_only" ON compliance.compliance_artifacts
  FOR UPDATE USING (signature_verified = true)
  WITH CHECK (signature_verified = true);

-- ============================================================================
-- STEP 5: Stored Procedures
-- ============================================================================

-- Function to log schema changes to audit_log
CREATE OR REPLACE FUNCTION log_schema_change()
RETURNS void AS $$
BEGIN
  INSERT INTO public.audit_log (
    entity_type, entity_id, action, changed_by, changed_at
  ) VALUES (
    'schema', gen_random_uuid(), 'created', auth.uid(), now()
  );
END;
$$ LANGUAGE plpgsql;

-- Call audit logging
SELECT log_schema_change();

-- ============================================================================
-- STEP 6: Verification
-- ============================================================================

-- Verify tables exist
DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables 
  WHERE table_schema IN ('public', 'state_ca', 'state_il', 'state_tx', 'compliance');
  
  RAISE NOTICE 'Base schema migration complete. Created % tables.', table_count;
END;
$$;
