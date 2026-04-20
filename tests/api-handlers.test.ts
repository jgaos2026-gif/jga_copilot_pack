import { beforeEach, describe, expect, it, vi } from 'vitest';

type DbResult = { data: any; error: any };
type QueryCall = {
  table: string;
  insertPayload?: Record<string, unknown>;
  updatePayload?: Record<string, unknown>;
  eqFilters: Array<[string, unknown]>;
};

const mocks = vi.hoisted(() => {
  let singleQueue: DbResult[] = [];
  let queryQueue: DbResult[] = [];
  const queryCalls: QueryCall[] = [];

  const from = vi.fn((table: string) => {
    const call: QueryCall = { table, eqFilters: [] };
    queryCalls.push(call);

    const builder: any = {
      select: vi.fn(() => builder),
      insert: vi.fn((payload: Record<string, unknown>) => {
        call.insertPayload = payload;
        return builder;
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        call.updatePayload = payload;
        return builder;
      }),
      delete: vi.fn(() => builder),
      eq: vi.fn((key: string, value: unknown) => {
        call.eqFilters.push([key, value]);
        return builder;
      }),
      single: vi.fn(async () => singleQueue.shift() ?? { data: null, error: null }),
      then: (resolve: (value: DbResult) => unknown, reject: (reason?: unknown) => unknown) =>
        Promise.resolve(queryQueue.shift() ?? { data: null, error: null }).then(resolve, reject),
    };

    return builder;
  });

  return {
    from,
    queryCalls,
    setSingleQueue: (results: DbResult[]) => {
      singleQueue = [...results];
    },
    setQueryQueue: (results: DbResult[]) => {
      queryQueue = [...results];
    },
    reset: () => {
      singleQueue = [];
      queryQueue = [];
      queryCalls.length = 0;
      from.mockClear();
    },
    auth: {
      signInWithPassword: vi.fn(),
    },
    publish: vi.fn(async () => undefined),
    createEvent: vi.fn(() => ({
      id: 'evt-1',
      topic: 'project-events',
      timestamp: new Date().toISOString(),
    })),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mocks.from,
    auth: mocks.auth,
  })),
}));

vi.mock('@/lib/event-system', () => ({
  eventBus: {
    publish: mocks.publish,
  },
  createEvent: mocks.createEvent,
  EventTopics: {
    INTAKE_CREATED: 'intakes',
    CUSTOMER_CREATED: 'customer-events',
    PROJECT_CREATED: 'project-events',
    DEPOSIT_CONFIRMED: 'project-events',
  },
}));

import {
  handleCreateCustomer,
  handleCreateProject,
  handleGetProject,
  handleHealth,
  handleIntake,
  handleLogin,
  handleMfaVerify,
  handlePaymentWebhook,
  handleRecordTransaction,
} from '@/app/api/handlers';

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return {
    json: vi.fn(async () => body),
    headers: new Headers(headers),
  } as any;
}

describe('app/api/handlers', () => {
  beforeEach(() => {
    mocks.reset();
    mocks.auth.signInWithPassword.mockReset();
    mocks.publish.mockClear();
    mocks.createEvent.mockClear();
  });

  it('handleIntake returns 201 and publishes intake event for valid payload', async () => {
    const req = makeRequest({
      company: 'Acme',
      contact: 'ops@acme.com',
      phone: '555-0101',
      service_type: 'design',
      scope: 'brochure',
      state: 'IL',
    }, { 'x-forwarded-for': '10.0.0.1' });

    const res = await handleIntake(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.status).toBe('received');
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it('handleIntake returns 400 for invalid intake payload', async () => {
    const req = makeRequest({ company: '', contact: 'not-an-email', state: 'ILL' });

    const res = await handleIntake(req);

    expect(res.status).toBe(400);
  });

  it('handleCreateCustomer returns 401 when authorization header is missing', async () => {
    const req = makeRequest({});

    const res = await handleCreateCustomer(req, 'TX');

    expect(res.status).toBe(401);
  });

  it('handleCreateCustomer returns 201 and emits event when insert succeeds', async () => {
    mocks.setSingleQueue([{ data: { id: 'cust-1' }, error: null }]);
    const req = makeRequest(
      {
        company_name: 'Acme',
        contact_name: 'Jane',
        email: 'jane@acme.com',
        phone: '555-2222',
      },
      { authorization: 'Bearer token' }
    );

    const res = await handleCreateCustomer(req, 'TX');
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe('cust-1');
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it('handleCreateProject sets pending statuses and returns created project id', async () => {
    mocks.setSingleQueue([{ data: { id: 'proj-1' }, error: null }]);
    const req = makeRequest(
      {
        customer_id: '00000000-0000-0000-0000-000000000001',
        name: 'New project',
        description: 'desc',
        service_type: 'print',
        estimated_value: 1000,
      },
      { authorization: 'Bearer token' }
    );

    const res = await handleCreateProject(req, 'IL');
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe('proj-1');
    expect(mocks.queryCalls[0].insertPayload).toMatchObject({
      status: 'intake',
      deposit_status: 'pending',
      contract_status: 'pending',
    });
  });

  it('handleGetProject returns 404 when project lookup fails', async () => {
    mocks.setSingleQueue([{ data: null, error: { message: 'missing' } }]);

    const res = await handleGetProject(makeRequest({}), 'IL', 'proj-404');

    expect(res.status).toBe(404);
  });

  it('handleRecordTransaction confirms deposit and updates project status for deposit type', async () => {
    mocks.setSingleQueue([{ data: { id: 'tx-1' }, error: null }]);
    mocks.setQueryQueue([{ data: null, error: null }]);
    const req = makeRequest(
      {
        project_id: '00000000-0000-0000-0000-000000000010',
        customer_id: '00000000-0000-0000-0000-000000000011',
        type: 'deposit',
        amount: 250,
        reference_id: 'ref-1',
      },
      { authorization: 'Bearer token' }
    );

    const res = await handleRecordTransaction(req, 'CA');

    expect(res.status).toBe(201);
    expect(mocks.queryCalls.some((c) => c.table === 'projects' && c.updatePayload?.deposit_status === 'confirmed')).toBe(true);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it('handlePaymentWebhook rejects missing payment signature', async () => {
    const req = makeRequest({ transaction_id: 't1' });

    const res = await handlePaymentWebhook(req);

    expect(res.status).toBe(401);
  });

  it('handlePaymentWebhook records transaction and returns 200 when signature exists', async () => {
    mocks.setQueryQueue([{ data: null, error: null }]);
    const req = makeRequest(
      {
        transaction_id: 'txn-1',
        amount: 500,
        project_id: 'proj-1',
        state_code: 'TX',
      },
      { 'x-stripe-signature': 'sig' }
    );

    const res = await handlePaymentWebhook(req);

    expect(res.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it('handleLogin returns 401 for invalid credentials', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'invalid' },
    });

    const res = await handleLogin(makeRequest({ email: 'x@y.com', password: 'bad' }));

    expect(res.status).toBe(401);
  });

  it('handleMfaVerify validates token format and persists mfa timestamp', async () => {
    mocks.setQueryQueue([{ data: null, error: null }]);

    const invalid = await handleMfaVerify(makeRequest({ userId: 'u1', totpToken: 'abc' }));
    const valid = await handleMfaVerify(makeRequest({ userId: 'u1', totpToken: '123456' }));

    expect(invalid.status).toBe(401);
    expect(valid.status).toBe(200);
    expect(mocks.queryCalls.some((c) => c.table === 'user_roles' && c.updatePayload?.mfa_verified_at)).toBe(true);
  });

  it('handleHealth always returns healthy response payload', async () => {
    const res = await handleHealth(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.services).toMatchObject({ api: 'ok', database: 'ok', eventBus: 'ok' });
  });
});
