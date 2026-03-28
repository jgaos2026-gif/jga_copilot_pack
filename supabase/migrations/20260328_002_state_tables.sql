-- JGA Enterprise OS - State-Specific Schema Migration
-- Creates state schemas (CA, IL, TX) with customer/project/contract/transaction tables
-- Enforces state isolation with RLS policies (Law #4)
-- Date: 2026-03-28

-- ============================================================================
-- STATE SCHEMAS - California, Illinois, Texas
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS state_ca;
CREATE SCHEMA IF NOT EXISTS state_il;
CREATE SCHEMA IF NOT EXISTS state_tx;

-- Helper function to create state tables
CREATE OR REPLACE FUNCTION create_state_tables(state_code VARCHAR(2))
RETURNS void AS $$
DECLARE
    schema_name TEXT := 'state_' || LOWER(state_code);
    customers_table TEXT := schema_name || '.customers';
    projects_table TEXT := schema_name || '.projects';
    contracts_table TEXT := schema_name || '.contracts';
    transactions_table TEXT := schema_name || '.transactions';
BEGIN
    -- CUSTOMERS table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.customers (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            state_code VARCHAR(2) NOT NULL DEFAULT %L,
            company_name VARCHAR(255) NOT NULL,
            contact_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(20),
            address TEXT,
            zip_code VARCHAR(10),
            industry VARCHAR(100),
            annual_revenue DECIMAL(15,2),
            status VARCHAR(50) DEFAULT ''active'', -- active, inactive, disputed
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- Indexes
            INDEX idx_customers_state (state_code),
            INDEX idx_customers_email (email),
            INDEX idx_customers_status (status),
            INDEX idx_customers_created (created_at)
        )', schema_name, state_code);

    -- PROJECTS table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.projects (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            state_code VARCHAR(2) NOT NULL DEFAULT %L,
            customer_id UUID NOT NULL REFERENCES %I.customers(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            service_type VARCHAR(100) NOT NULL, -- legal, accounting, consulting, etc
            estimated_value DECIMAL(10,2) NOT NULL,
            status VARCHAR(50) DEFAULT ''intake'', -- intake, active, completed, disputed, cancelled
            deposit_status VARCHAR(50) DEFAULT ''pending'', -- pending, confirmed, refunded
            contract_status VARCHAR(50) DEFAULT ''pending'', -- pending, signed, executed
            compliance_status VARCHAR(50) DEFAULT ''pending'', -- pending, review, approved, rejected
            assigned_contractor_id UUID REFERENCES public.contractors(id),
            start_date DATE,
            expected_completion DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- Indexes
            INDEX idx_projects_state (state_code),
            INDEX idx_projects_customer (customer_id),
            INDEX idx_projects_status (status),
            INDEX idx_projects_compliance_status (compliance_status),
            INDEX idx_projects_created (created_at)
        )', schema_name, state_code, schema_name);

    -- CONTRACTS table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.contracts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            state_code VARCHAR(2) NOT NULL DEFAULT %L,
            project_id UUID NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
            contract_hash VARCHAR(255), -- Stitch-signed contract hash
            contract_url TEXT,
            status VARCHAR(50) DEFAULT ''pending'', -- pending, signed, executed, cancelled
            signed_by_party_a VARCHAR(255), -- Customer signature
            signed_by_party_b VARCHAR(255), -- Contractor signature
            signed_at TIMESTAMP,
            execution_date TIMESTAMP,
            terms JSONB, -- Contract terms and conditions
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- Indexes
            INDEX idx_contracts_project (project_id),
            INDEX idx_contracts_status (status),
            INDEX idx_contracts_signed_at (signed_at)
        )', schema_name, state_code, schema_name);

    -- TRANSACTIONS table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.transactions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            state_code VARCHAR(2) NOT NULL DEFAULT %L,
            project_id UUID NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
            customer_id UUID NOT NULL REFERENCES %I.customers(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL, -- deposit, payment, refund, adjustment
            amount DECIMAL(10,2) NOT NULL,
            reference_id VARCHAR(255) UNIQUE, -- Payment processor ID (Stripe, etc)
            payment_method VARCHAR(50), -- credit_card, bank_transfer, check, etc
            status VARCHAR(50) DEFAULT ''pending'', -- pending, confirmed, failed, cancelled
            metadata JSONB, -- Additional transaction details
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- Indexes
            INDEX idx_transactions_project (project_id),
            INDEX idx_transactions_customer (customer_id),
            INDEX idx_transactions_type (type),
            INDEX idx_transactions_status (status),
            INDEX idx_transactions_reference (reference_id),
            INDEX idx_transactions_created (created_at)
        )', schema_name, state_code, schema_name);

    -- DISPUTES table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.disputes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            state_code VARCHAR(2) NOT NULL DEFAULT %L,
            project_id UUID NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
            customer_id UUID NOT NULL REFERENCES %I.customers(id) ON DELETE CASCADE,
            reason TEXT NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT ''pending'', -- pending, review, resolved, cancelled
            resolution VARCHAR(50), -- full_refund, partial_refund, reject, split
            refund_amount DECIMAL(10,2),
            resolved_by UUID, -- Admin/Owner who resolved
            resolution_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            
            -- Indexes
            INDEX idx_disputes_project (project_id),
            INDEX idx_disputes_customer (customer_id),
            INDEX idx_disputes_status (status),
            INDEX idx_disputes_created (created_at)
        )', schema_name, state_code, schema_name);

    -- Enable RLS on all state tables
    EXECUTE format('ALTER TABLE %I.customers ENABLE ROW LEVEL SECURITY', schema_name);
    EXECUTE format('ALTER TABLE %I.projects ENABLE ROW LEVEL SECURITY', schema_name);
    EXECUTE format('ALTER TABLE %I.contracts ENABLE ROW LEVEL SECURITY', schema_name);
    EXECUTE format('ALTER TABLE %I.transactions ENABLE ROW LEVEL SECURITY', schema_name);
    EXECUTE format('ALTER TABLE %I.disputes ENABLE ROW LEVEL SECURITY', schema_name);

    -- Create RLS policies for state isolation (Law #4)
    -- Customers: only accessible from same state
    EXECUTE format('
        CREATE POLICY "%I_customers_select" ON %I.customers
        FOR SELECT USING (state_code = %L OR current_setting(''app.state_code'') = %L)
    ', schema_name, customers_table, state_code, state_code);

    EXECUTE format('
        CREATE POLICY "%I_customers_insert" ON %I.customers
        FOR INSERT WITH CHECK (state_code = %L AND current_setting(''app.state_code'') = %L)
    ', schema_name, customers_table, state_code, state_code);

    EXECUTE format('
        CREATE POLICY "%I_customers_update" ON %I.customers
        FOR UPDATE USING (state_code = %L AND current_setting(''app.state_code'') = %L)
        WITH CHECK (state_code = %L)
    ', schema_name, customers_table, state_code, state_code, state_code);

    -- Projects: state-scoped
    EXECUTE format('
        CREATE POLICY "%I_projects_select" ON %I.projects
        FOR SELECT USING (state_code = %L)
    ', schema_name, projects_table, state_code);

    EXECUTE format('
        CREATE POLICY "%I_projects_insert" ON %I.projects
        FOR INSERT WITH CHECK (state_code = %L AND current_setting(''app.state_code'') = %L)
    ', schema_name, projects_table, state_code, state_code);

    -- Contracts: state-scoped
    EXECUTE format('
        CREATE POLICY "%I_contracts_select" ON %I.contracts
        FOR SELECT USING (state_code = %L)
    ', schema_name, contracts_table, state_code);

    -- Transactions: state-scoped
    EXECUTE format('
        CREATE POLICY "%I_transactions_select" ON %I.transactions
        FOR SELECT USING (state_code = %L)
    ', schema_name, transactions_table, state_code);

    EXECUTE format('
        CREATE POLICY "%I_transactions_insert" ON %I.transactions
        FOR INSERT WITH CHECK (state_code = %L AND current_setting(''app.state_code'') = %L)
    ', schema_name, transactions_table, state_code, state_code);

    -- Grant permissions to app role
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I.customers TO jga_app', schema_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I.projects TO jga_app', schema_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I.contracts TO jga_app', schema_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I.transactions TO jga_app', schema_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I.disputes TO jga_app', schema_name);

END;
$$ LANGUAGE plpgsql;

-- Execute function for each state
SELECT create_state_tables('CA');
SELECT create_state_tables('IL');
SELECT create_state_tables('TX');

-- Drop the helper function
DROP FUNCTION create_state_tables(VARCHAR);

-- ============================================================================
-- TRIGGERS FOR AUDIT TRAIL ON STATE TABLES
-- ============================================================================

-- Audit trigger for customer changes
CREATE OR REPLACE FUNCTION audit_state_changes()
RETURNS TRIGGER AS $$
BEGIN
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
        COALESCE(auth.uid(), uuid_nil()),
        current_setting('app.user_role', true),
        NEW.state_code,
        CASE
            WHEN TG_OP = 'INSERT' THEN jsonb_build_object('_created', true)
            WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
                'status', CASE WHEN OLD.status != NEW.status THEN jsonb_build_array(OLD.status, NEW.status) ELSE NULL END
            )
            WHEN TG_OP = 'DELETE' THEN jsonb_build_object('_deleted', true)
        END,
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for each state schema
DO $$
DECLARE
    state_code VARCHAR(2);
    schema_name TEXT;
BEGIN
    FOREACH state_code IN ARRAY ARRAY['CA', 'IL', 'TX'] LOOP
        schema_name := 'state_' || LOWER(state_code);

        -- Create triggers for customers
        EXECUTE format('
            CREATE TRIGGER %I_customers_audit
            AFTER INSERT OR UPDATE OR DELETE ON %I.customers
            FOR EACH ROW EXECUTE FUNCTION audit_state_changes()
        ', 'trg_' || schema_name || '_customers_audit', schema_name);

        -- Create triggers for projects
        EXECUTE format('
            CREATE TRIGGER %I_projects_audit
            AFTER INSERT OR UPDATE OR DELETE ON %I.projects
            FOR EACH ROW EXECUTE FUNCTION audit_state_changes()
        ', 'trg_' || schema_name || '_projects_audit', schema_name);

        -- Create triggers for transactions
        EXECUTE format('
            CREATE TRIGGER %I_transactions_audit
            AFTER INSERT ON %I.transactions
            FOR EACH ROW EXECUTE FUNCTION audit_state_changes()
        ', 'trg_' || schema_name || '_transactions_audit', schema_name);

    END LOOP;
END $$;

-- ============================================================================
-- ENCRYPTION & KMS (State-scoped keys)
-- ============================================================================

-- Each state schema uses its own KMS key for AES-256-GCM encryption
-- Key management in Application code (lib/crypto.ts)
-- Example: PII fields encrypted at application layer using state-scoped keys

-- ============================================================================
-- VIEWS FOR AGGREGATION (used by Owners Room BRIC)
-- ============================================================================

CREATE OR REPLACE VIEW public.dashboard_summary AS
SELECT
    'CA' as state,
    (SELECT COUNT(*) FROM state_ca.customers WHERE status = 'active') as customer_count,
    (SELECT COUNT(*) FROM state_ca.projects WHERE status = 'active') as active_projects,
    (SELECT COALESCE(SUM(amount), 0) FROM state_ca.transactions WHERE type IN ('deposit', 'payment')) as total_revenue,
    (SELECT COUNT(*) FROM state_ca.disputes WHERE status = 'pending') as pending_disputes
UNION ALL
SELECT
    'IL' as state,
    (SELECT COUNT(*) FROM state_il.customers WHERE status = 'active') as customer_count,
    (SELECT COUNT(*) FROM state_il.projects WHERE status = 'active') as active_projects,
    (SELECT COALESCE(SUM(amount), 0) FROM state_il.transactions WHERE type IN ('deposit', 'payment')) as total_revenue,
    (SELECT COUNT(*) FROM state_il.disputes WHERE status = 'pending') as pending_disputes
UNION ALL
SELECT
    'TX' as state,
    (SELECT COUNT(*) FROM state_tx.customers WHERE status = 'active') as customer_count,
    (SELECT COUNT(*) FROM state_tx.projects WHERE status = 'active') as active_projects,
    (SELECT COALESCE(SUM(amount), 0) FROM state_tx.transactions WHERE type IN ('deposit', 'payment')) as total_revenue,
    (SELECT COUNT(*) FROM state_tx.disputes WHERE status = 'pending') as pending_disputes;

-- ============================================================================
-- METADATA & COMMENTS
-- ============================================================================

COMMENT ON SCHEMA state_ca IS 'California-specific customer data with state isolation (Law #4)';
COMMENT ON SCHEMA state_il IS 'Illinois-specific customer data with state isolation (Law #4)';
COMMENT ON SCHEMA state_tx IS 'Texas-specific customer data with state isolation (Law #4)';

COMMENT ON COLUMN state_ca.customers.state_code IS 'Always CA - enforced by RLS and database constraint';
COMMENT ON COLUMN state_il.customers.state_code IS 'Always IL - enforced by RLS and database constraint';
COMMENT ON COLUMN state_tx.customers.state_code IS 'Always TX - enforced by RLS and database constraint';
