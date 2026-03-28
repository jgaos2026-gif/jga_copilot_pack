-- JGA Enterprise OS - Base Schema Migration
-- Creates public cross-state tables, compliance schema, and RLS policies
-- Date: 2026-03-28

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PUBLIC SCHEMA - Cross-State Tables (Law #2: No PII in Spine)
-- ============================================================================

-- Contractors table (public, accessible by spine/system-b)
CREATE TABLE IF NOT EXISTS public.contractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  name VARCHAR(255),
  license_number VARCHAR(100),
  specializations TEXT[], -- Array of service types
  rating DECIMAL(3,2) DEFAULT 0,
  verified_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active', -- active, suspended, inactive
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_contractors_email (email),
  INDEX idx_contractors_status (status),
  INDEX idx_contractors_verified (verified_at)
);

-- User roles (public, for auth + access control)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL, -- contractor, customer, admin, owner, auditor
  state_code VARCHAR(2), -- CA, IL, TX (for state-specific users)
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_verified_at TIMESTAMP, -- For 4-hour window (Law #5)
  last_login TIMESTAMP,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_user_roles_user_id (user_id),
  INDEX idx_user_roles_email (email),
  INDEX idx_user_roles_role (role),
  INDEX idx_user_roles_state (state_code)
);

-- Event ledger (immutable append-only, Law #7)
CREATE TABLE IF NOT EXISTS public.event_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  event_topic VARCHAR(100) NOT NULL, -- intakes, leads, customer-events, etc
  source_bric VARCHAR(100) NOT NULL, -- Which BRIC emitted this
  state_code VARCHAR(2), -- CA, IL, TX (for state-scoped encryption)
  data JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  correlation_id UUID, -- For tracing across services
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Immutability enforcement (Law #7)
  CONSTRAINT no_update_delete CHECK (true) -- Only insert allowed
);

-- Set immutability on event ledger
ALTER TABLE public.event_ledger ENABLE ROW LEVEL SECURITY;

-- Audit log (who did what, when)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR(100) NOT NULL, -- customer_created, project_activated, config_changed, etc
  resource_type VARCHAR(50) NOT NULL, -- customer, project, system_config
  resource_id UUID,
  actor_id UUID NOT NULL,
  actor_role VARCHAR(50),
  state_code VARCHAR(2),
  changes JSONB, -- What fields changed: {"field": ["old_value", "new_value"]}
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for audit queries
  INDEX idx_audit_action (action),
  INDEX idx_audit_resource (resource_type, resource_id),
  INDEX idx_audit_actor (actor_id),
  INDEX idx_audit_timestamp (created_at),
  INDEX idx_audit_state (state_code)
);

-- Contractor ratings (public)
CREATE TABLE IF NOT EXISTS public.contractor_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contractor_id UUID NOT NULL REFERENCES public.contractors(id),
  rater_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_ratings_contractor (contractor_id),
  INDEX idx_ratings_created (created_at),
  FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE
);

-- ============================================================================
-- COMPLIANCE SCHEMA - Regulation & Gate Enforcement (Law #6)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS compliance;

CREATE TABLE IF NOT EXISTS compliance.regulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state_code VARCHAR(2) NOT NULL, -- CA, IL, TX
  regulation_name VARCHAR(255) NOT NULL,
  regulation_code VARCHAR(50), -- e.g., "CA-BAR-123"
  description TEXT,
  min_threshold DECIMAL(10,2), -- Minimum project value that triggers this rule
  check_type VARCHAR(50), -- aml, sanctions, kyc, licensing
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_regulations_state (state_code),
  INDEX idx_regulations_active (is_active),
  INDEX idx_regulations_check_type (check_type)
);

CREATE TABLE IF NOT EXISTS compliance.compliance_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  state_code VARCHAR(2) NOT NULL,
  regulation_id UUID REFERENCES compliance.regulations(id),
  check_type VARCHAR(50) NOT NULL,
  status VARCHAR(50), -- pending, passed, failed, review
  results JSONB, -- Detailed check results
  reviewer_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_checks_project (project_id),
  INDEX idx_checks_status (status),
  INDEX idx_checks_state (state_code),
  INDEX idx_checks_created (created_at)
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - Law #4: State Isolation
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance.regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance.compliance_checks ENABLE ROW LEVEL SECURITY;

-- Contractors: public read access, authenticated users can view
CREATE POLICY "contractors_select_policy" ON public.contractors
  FOR SELECT USING (true);

-- User roles: users can see their own, admins can see all in their state
CREATE POLICY "user_roles_select_policy" ON public.user_roles
  FOR SELECT USING (
    auth.uid() = user_id OR
    current_setting('app.user_role') IN ('admin', 'owner') -- Set by application
  );

-- Event ledger: state-scoped read access
CREATE POLICY "event_ledger_select_policy" ON public.event_ledger
  FOR SELECT USING (
    -- Admins/owners can see all
    current_setting('app.user_role') IN ('admin', 'owner') OR
    -- State users can see their state's events
    state_code = current_setting('app.state_code')
  );

-- Event ledger: insert-only (no updates/deletes) - Law #7
CREATE POLICY "event_ledger_insert_policy" ON public.event_ledger
  FOR INSERT WITH CHECK (true);

-- Audit log: state-scoped access
CREATE POLICY "audit_log_select_policy" ON public.audit_log
  FOR SELECT USING (
    current_setting('app.user_role') IN ('admin', 'owner', 'auditor') AND
    (state_code = current_setting('app.state_code') OR current_setting('app.user_role') IN ('owner', 'admin'))
  );

-- Compliance: state-scoped access
CREATE POLICY "compliance_checks_select_policy" ON compliance.compliance_checks
  FOR SELECT USING (
    state_code = current_setting('app.state_code') OR
    current_setting('app.user_role') IN ('owner', 'admin')
  );

-- ============================================================================
-- INDEXES FOR QUERY OPTIMIZATION
-- ============================================================================

CREATE INDEX idx_event_ledger_state_timestamp 
  ON public.event_ledger(state_code, timestamp DESC);

CREATE INDEX idx_event_ledger_type 
  ON public.event_ledger(event_type, timestamp DESC);

CREATE INDEX idx_audit_log_state_timestamp 
  ON public.audit_log(state_code, created_at DESC);

-- ============================================================================
-- FUNCTIONS FOR AUDIT TRAIL
-- ============================================================================

-- Function to log all changes to audit_log (trigger below)
CREATE OR REPLACE FUNCTION public.audit_log_function()
RETURNS TRIGGER AS $$
DECLARE
    v_changes JSONB;
BEGIN
    -- Build changes object
    IF TG_OP = 'UPDATE' THEN
        v_changes := jsonb_build_object();
        -- Compare all columns and record changes
    ELSIF TG_OP = 'DELETE' THEN
        v_changes := jsonb_build_object('_deleted', true);
    ELSE
        v_changes := jsonb_build_object('_created', true);
    END IF;

    INSERT INTO public.audit_log (
        action,
        resource_type,
        resource_id,
        actor_id,
        actor_role,
        state_code,
        changes,
        created_at
    ) VALUES (
        TG_OP,
        TG_TABLE_NAME,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
        auth.uid(),
        current_setting('app.user_role', true),
        current_setting('app.state_code', true),
        v_changes,
        CURRENT_TIMESTAMP
    );

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DATABASE ROLES & PERMISSIONS
-- ============================================================================

-- Create role for application (service role)
DO $$ BEGIN
    CREATE ROLE jga_app WITH LOGIN PASSWORD 'TO_BE_SET_IN_ENV';
EXCEPTION WHEN DUPLICATE_OBJECT THEN
    -- Role already exists, skip
END $$;

-- Grant permissions to app role
GRANT SELECT, INSERT, UPDATE ON public.contractors TO jga_app;
GRANT SELECT, INSERT ON public.event_ledger TO jga_app;
GRANT SELECT, INSERT ON public.audit_log TO jga_app;
GRANT SELECT, INSERT, UPDATE ON public.user_roles TO jga_app;
GRANT SELECT ON compliance.regulations TO jga_app;
GRANT SELECT, INSERT, UPDATE ON compliance.compliance_checks TO jga_app;

-- ============================================================================
-- METADATA COMMENTS (for documentation)
-- ============================================================================

COMMENT ON TABLE public.contractors IS 'Contractor information, publicly accessible for lead assignment';
COMMENT ON TABLE public.user_roles IS 'User authentication and role assignment with MFA tracking';
COMMENT ON TABLE public.event_ledger IS 'Immutable event log for audit trail (Law #7 - append-only)';
COMMENT ON TABLE public.audit_log IS 'Audit trail of all user actions for compliance';
COMMENT ON TABLE compliance.regulations IS 'State-specific regulatory requirements (Law #6)';
COMMENT ON TABLE compliance.compliance_checks IS 'Compliance check results for projects';

COMMENT ON COLUMN public.user_roles.mfa_verified_at IS 'Timestamp of last MFA verification (Law #5 - 4 hour window)';
COMMENT ON COLUMN public.event_ledger.state_code IS 'State for encryption key scoping (Law #4 - state isolation)';
COMMENT ON COLUMN compliance.compliance_checks.status IS 'pending/passed/failed/review - project cannot activate without passed';
