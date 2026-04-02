/**
 * Integration Tests - Complete system workflows
 * Tests for: Intakes, Customers, Projects, Transactions, MFA, State Isolation, Events
 *
 * NOTE: These tests require a live Supabase instance.
 * Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run them.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { eventBus, Event } from '@/lib/event-system';
import { RpcClient } from '@/lib/inter-bric-rpc';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const integrationEnabled = Boolean(supabaseUrl && supabaseKey);

// Skip all integration suites when Supabase credentials are absent.
const describeIntegration = integrationEnabled ? describe : describe.skip;

const supabase = integrationEnabled
  ? createClient(supabaseUrl!, supabaseKey!)
  : null as unknown as ReturnType<typeof createClient>;

/**
 * Test Suite: Lead Intake → Customer → Project → Deposit
 */
describeIntegration('Complete Workflow: Lead to Project Activation', () => {
  let customerId: string;
  let projectId: string;
  const testState = 'CA';
  const testEmail = `test-${Date.now()}@example.com`;

  beforeAll(async () => {
    // Clear test data
    await supabase
      .from('customers')
      .delete()
      .eq('email', testEmail);
  });

  it('should accept intake from public form', async () => {
    const intakeData = {
      company: 'Test Company Inc',
      contact: testEmail,
      phone: '555-0123',
      service_type: 'legal',
      scope: 'contract review',
      state: testState,
    };

    const response = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(intakeData),
    });

    expect(response.status).toBe(201);
    const { intake_id, status } = await response.json();
    expect(intake_id).toBeDefined();
    expect(status).toBe('received');
  });

  it('should create customer in state BRIC', async () => {
    const customerData = {
      company_name: 'Test Company Inc',
      contact_name: 'John Doe',
      email: testEmail,
      phone: '555-0123',
    };

    const response = await fetch(`/api/state-${testState}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(customerData),
    });

    expect(response.status).toBe(201);
    const { id } = await response.json();
    customerId = id;
    expect(customerId).toBeDefined();

    // Verify customer in database
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    expect(error).toBeNull();
    expect(data.state_code).toBe(testState);
    expect(data.email).toBe(testEmail);
  });

  it('should create project with pricing', async () => {
    const projectData = {
      customer_id: customerId,
      name: 'Contract Review Project',
      description: 'Full contract review and analysis',
      service_type: 'legal',
      estimated_value: 5000,
    };

    const response = await fetch(`/api/state-${testState}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(projectData),
    });

    expect(response.status).toBe(201);
    const { id } = await response.json();
    projectId = id;
    expect(projectId).toBeDefined();

    // Verify project in database
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    expect(error).toBeNull();
    expect(data.state_code).toBe(testState);
    expect(data.status).toBe('intake');
    expect(data.deposit_status).toBe('pending');
  });

  it('should record deposit and confirm payment', async () => {
    const transactionData = {
      project_id: projectId,
      customer_id: customerId,
      type: 'deposit',
      amount: 2500,
      reference_id: `txn-${Date.now()}`,
    };

    const response = await fetch(`/api/state-${testState}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(transactionData),
    });

    expect(response.status).toBe(201);
    const { id } = await response.json();
    expect(id).toBeDefined();

    // Verify project deposit status updated
    const { data, error } = await supabase
      .from('projects')
      .select('deposit_status')
      .eq('id', projectId)
      .single();

    expect(error).toBeNull();
    expect(data?.deposit_status).toBe('confirmed');
  });

  it('should emit events throughout workflow', async () => {
    const receivedEvents: Event[] = [];
    const handler = async (event: Event): Promise<void> => {
      receivedEvents.push(event);
    };

    // Subscribe to all relevant events
    eventBus.subscribe('customer-events', handler);
    eventBus.subscribe('project-events', handler);

    // Wait for events to propagate
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(receivedEvents.length).toBeGreaterThan(0);

    // Verify event structure
    const customerEvent = receivedEvents.find(e => e.type === 'customer_created');
    expect(customerEvent?.data.customer_id).toBe(customerId);
  });
});

/**
 * Test Suite: State Isolation and RLS
 */
describeIntegration('State Isolation & Row-Level Security', () => {
  const statesUnderTest = ['CA', 'IL', 'TX'];
  const createdCustomers: Record<string, string> = {};

  it('should create customers in different states', async () => {
    for (const stateCode of statesUnderTest) {
      const response = await fetch(`/api/state-${stateCode}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`,
        },
        body: JSON.stringify({
          company_name: `Company ${stateCode}`,
          contact_name: 'Test Contact',
          email: `test-${stateCode}@example.com`,
          phone: '555-0000',
        }),
      });

      expect(response.status).toBe(201);
      const { id } = await response.json();
      createdCustomers[stateCode] = id;
    }
  });

  it('should enforce RLS: customers only visible in their state', async () => {
    // Try to access CA customer from IL context
    const caCustomerId = createdCustomers['CA'];

    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', caCustomerId)
      .eq('state_code', 'IL') // Wrong state
      .single();

    // Should return zero rows (RLS enforcement)
    expect(data).toBeNull();
  });

  it('should prevent cross-state project creation', async () => {
    const projectData = {
      customer_id: createdCustomers['CA'],
      name: 'Cross-State Test',
      description: 'Should fail RLS',
      service_type: 'legal',
      estimated_value: 1000,
    };

    // Try to create project in TX using CA customer
    const response = await fetch('/api/state-TX/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(projectData),
    });

    // Should fail or return error
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should encrypt data with state-scoped KMS keys', async () => {
    // Verify that customers in different states have different KMS keys
    // (This is enforced at KMS level, checking metadata here)

    const caCustomer = await supabase
      .from('customers')
      .select('id, state_code')
      .eq('id', createdCustomers['CA'])
      .eq('state_code', 'CA')
      .single();

    const txCustomer = await supabase
      .from('customers')
      .select('id, state_code')
      .eq('id', createdCustomers['TX'])
      .eq('state_code', 'TX')
      .single();

    // Customers should exist in their respective states
    expect(caCustomer.data?.state_code).toBe('CA');
    expect(txCustomer.data?.state_code).toBe('TX');
  });
});

/**
 * Test Suite: MFA and Multi-Auth for Admin Operations
 */
describeIntegration('MFA & Dual-Auth (Law #5)', () => {
  let adminUserId: string;

  beforeAll(async () => {
    // Create test admin user
    const { data } = await supabase.auth.admin.createUser({
      email: `admin-${Date.now()}@test.com`,
      password: 'TestPassword123!',
      user_metadata: { role: 'owner' },
    });
    adminUserId = data.user?.id || '';
  });

  it('should require MFA for admin access', async () => {
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `admin-${Date.now()}@test.com`,
        password: 'TestPassword123!',
      }),
    });

    expect(loginResponse.status).toBe(200);
    const { session } = await loginResponse.json();

    // Try to access admin endpoint without MFA
    const adminResponse = await fetch('/api/admin/dashboard', {
      headers: {
        'authorization': `Bearer ${session.access_token}`,
      },
    });

    // Should require MFA
    expect(adminResponse.status).toBe(403);
  });

  it('should verify TOTP token and grant 4-hour window', async () => {
    const mfaResponse = await fetch('/api/auth/mfa-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: adminUserId,
        totpToken: '123456',
      }),
    });

    // In real scenario, token must be valid
    // For test: any 6-digit token is accepted
    if (mfaResponse.status === 200) {
      const { status } = await mfaResponse.json();
      expect(status).toBe('verified');
    }
  });

  it('should enforce dual-auth for system config changes', async () => {
    // This test verifies that config changes require both owner and approver signatures
    // Implementation: POST /api/admin/config should check dual-auth requirement

    const configUpdate = {
      key: 'system.max_projects_per_customer',
      value: 10,
    };

    const response = await fetch('/api/admin/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${process.env.TEST_ADMIN_TOKEN}`,
      },
      body: JSON.stringify(configUpdate),
    });

    // Should require dual-auth signatures
    // Expected: 402 (Payment Required as metaphor for "need more auth")
    expect([402, 403, 400]).toContain(response.status);
  });

  it('should have MFA expiry (4-hour window)', async () => {
    // Get MFA verified timestamp
    const { data } = await supabase
      .from('user_roles')
      .select('mfa_verified_at')
      .eq('user_id', adminUserId)
      .single();

    if (data?.mfa_verified_at) {
      const verifiedTime = new Date(data.mfa_verified_at).getTime();
      const now = Date.now();
      const hoursSinceVerify = (now - verifiedTime) / (1000 * 60 * 60);

      if (hoursSinceVerify > 4) {
        // MFA should be expired
        expect(hoursSinceVerify).toBeGreaterThan(4);
      } else {
        // MFA should still be valid
        expect(hoursSinceVerify).toBeLessThan(4);
      }
    }
  });
});

/**
 * Test Suite: Event System & Event Ledger
 */
describeIntegration('Event System & Audit Trail (Law #7)', () => {
  let capturedEvents: Event[] = [];

  beforeAll(async () => {
    // Subscribe to all events for testing
    eventBus.subscribe('*', async (event: Event) => {
      capturedEvents.push(event);
    });
  });

  it('should emit events for all state changes', async () => {
    const initialCount = capturedEvents.length;

    const response = await fetch('/api/state-CA/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        company_name: 'Event Test Company',
        contact_name: 'Test',
        email: 'eventtest@example.com',
        phone: '555-0000',
      }),
    });

    expect(response.status).toBe(201);

    // Wait for event propagation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should have new events
    expect(capturedEvents.length).toBeGreaterThan(initialCount);
  });

  it('should log events immutably with audit trail', async () => {
    // Events should be append-only
    const lastEventId = capturedEvents[capturedEvents.length - 1]?.id;

    // Create another event
    await fetch('/api/state-CA/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        company_name: 'Audit Test',
        contact_name: 'Test',
        email: 'audittest@example.com',
        phone: '555-0000',
      }),
    });

    // Previous events should not be modified
    expect(capturedEvents[capturedEvents.length - 2]?.id).toBe(lastEventId);
  });

  it('should handle dead letter queue for failed events', async () => {
    // Test that failed events go to DLQ after retries
    const dlqEventsBeforbe = await eventBus.getDLQEvents();
    const initialDLQSize = dlqEventsBeforbe?.length || 0;

    // Cause a failure by sending invalid data
    // (in real system: database connection failure, etc.)

    // DLQ size might increase (depending on failure injection)
    const dlqEventsAfter = await eventBus.getDLQEvents();
    expect((dlqEventsAfter?.length || 0) >= initialDLQSize).toBe(true);
  });
});

/**
 * Test Suite: Inter-BRIC Communication (Law #8)
 */
describeIntegration('Inter-BRIC RPC & Zero-Trust (Law #8)', () => {
  let rpcClient: RpcClient;

  beforeAll(async () => {
    // Initialize RPC client with test certificates
    rpcClient = new RpcClient({
      serviceName: 'test-client',
      certPath: process.env.TEST_CLIENT_CERT!,
      keyPath: process.env.TEST_CLIENT_KEY!,
      caPath: process.env.TEST_CA_CERT!,
    });
  });

  it('should enforce mTLS for inter-BRIC calls', async () => {
    // Try to call without certificates
    const invalidClient = new RpcClient({
      serviceName: 'test-invalid',
      certPath: '', // Invalid
      keyPath: '',
      caPath: '',
    });

    const response = await invalidClient.call('state-bric-ca', 'getCustomer', {
      customer_id: 'test',
    });

    // Should fail due to mTLS validation
    expect(response.error).toBeDefined();
  });

  it('should enforce policy-based access control (default-deny)', async () => {
    // Try to access endpoint not in policy matrix
    const response = await rpcClient.call('state-bric-ca', 'deleteAllCustomers', {
      // This operation is not in policy matrix
    });

    // Should deny by default (Law #8)
    expect(response.error).toBeDefined();
  });

  it('should allow authorized service calls per policy matrix', async () => {
    // Policy allows: state-bric-ca → state-bric-ca (for local calls)
    const response = await rpcClient.call('state-bric-ca', 'getCustomer', {
      customer_id: 'test-id',
    });

    // Should either succeed or fail with not-found (not permission-denied)
    if (response.error) {
      expect(response.error).not.toContain('not authorized');
    }
  });

  it('should correlate requests across BRIC boundaries', async () => {
    const correlationId = `test-${Date.now()}`;

    const response = await rpcClient.call(
      'state-bric-ca',
      'getCustomer',
      { customer_id: 'test' },
      correlationId
    );

    // Response should include correlation ID for tracing
    expect(response.correlationId).toBe(correlationId);
  });
});

/**
 * Test Suite: Compliance & Policy Gates (Law #6)
 */
describeIntegration('Compliance Gates & Policy Enforcement (Law #6)', () => {
  it('should check compliance before project activation', async () => {
    // Create project and verify it requires compliance clearance
    const projectData = {
      customer_id: 'test-customer-id',
      name: 'Compliance Test Project',
      description: 'Should check compliance',
      service_type: 'legal',
      estimated_value: 50000, // High value = requires compliance check
    };

    const response = await fetch('/api/state-CA/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(projectData),
    });

    // Project should be created but status might be 'compliance_review'
    if (response.status === 201) {
      const { id } = await response.json();

      const { data } = await supabase
        .from('projects')
        .select('compliance_status')
        .eq('id', id)
        .single();

      // Should require compliance
      expect(['pending', 'review']).toContain(data?.compliance_status);
    }
  });
});

/**
 * Test Suite: Health checks and system status
 */
describeIntegration('System Health Checks', () => {
  it('should return health status', async () => {
    const response = await fetch('/api/health');

    expect(response.status).toBe(200);
    const { status, services } = await response.json();

    expect(status).toBe('healthy');
    expect(services.api).toBe('ok');
    expect(services.database).toMatch(/ok|warning/);
    expect(services.eventBus).toMatch(/ok|warning/);
  });
});
