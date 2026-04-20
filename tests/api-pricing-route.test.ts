import { beforeEach, describe, expect, it, vi } from 'vitest';

type DbResult = { data: any; error: any };

const mocks = vi.hoisted(() => {
  let singleQueue: DbResult[] = [];

  const from = vi.fn(() => {
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      single: vi.fn(async () => singleQueue.shift() ?? { data: null, error: null }),
    };
    return builder;
  });

  return {
    from,
    setSingleQueue: (results: DbResult[]) => {
      singleQueue = [...results];
    },
    reset: () => {
      singleQueue = [];
      from.mockClear();
    },
  };
});

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({
    from: mocks.from,
  })),
}));

import { GET } from '@/app/api/pricing/route';

function makeRequest(query: string) {
  return {
    nextUrl: new URL(`http://localhost/api/pricing?${query}`),
  } as any;
}

describe('app/api/pricing/route', () => {
  beforeEach(() => {
    mocks.reset();
  });

  it('returns 200 and quote payload for valid pricing request', async () => {
    mocks.setSingleQueue([
      {
        data: { base_price: 100, description: 'Basic', revision_limits: 2 },
        error: null,
      },
    ]);

    const res = await GET(makeRequest('tier=basic&urgency=rush&demandMultiplier=1.2&loadFactor=1.1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tier).toBe('basic');
    expect(body.urgency).toBe('rush');
    expect(body.adjustedPrice).toBeGreaterThan(100);
  });

  it('returns 404 when service tier does not exist', async () => {
    mocks.setSingleQueue([{ data: null, error: { message: 'not found' } }]);

    const res = await GET(makeRequest('tier=missing'));

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid pricing parameters', async () => {
    const res = await GET(makeRequest('tier=&demandMultiplier=0.1&urgency=fast'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected backend errors', async () => {
    mocks.from.mockImplementationOnce(() => {
      throw new Error('db unavailable');
    });

    const res = await GET(makeRequest('tier=basic'));

    expect(res.status).toBe(500);
  });
});
