/**
 * Inter-BRIC RPC Tests
 * Tests for RpcClient policy enforcement (Law #8 – Zero-Trust, default-deny)
 * and RpcServer method dispatch.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RpcClient, RpcServer } from '../lib/inter-bric-rpc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, params: Record<string, unknown> = {}) {
  return {
    method,
    service: 'test-service',
    params,
    requestId: `req_${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// RpcClient – policy enforcement (Law #8)
// ---------------------------------------------------------------------------

describe('RpcClient – policy enforcement (Law #8 Zero-Trust)', () => {
  it('denies a call not permitted by the policy matrix', async () => {
    // public-bric is only allowed to call system-b, not stitch
    const client = new RpcClient({
      serviceName: 'public-bric',
      certPath: '',
      keyPath: '',
      caPath: '',
    });

    const response = await client.call('stitch', 'someMethod', {});

    expect(response.success).toBe(false);
    expect(response.error).toContain('Zero-Trust');
    expect(response.requestId).toBeDefined();
    expect(response.timestamp).toBeDefined();
  });

  it('denies a call from an unknown source service', async () => {
    const client = new RpcClient({
      serviceName: 'unknown-service',
      certPath: '',
      keyPath: '',
      caPath: '',
    });

    const response = await client.call('state-bric', 'getCustomer', {});

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });

  it('allows calls that are explicitly in the policy matrix (and fails on cert, not policy)', async () => {
    // public-bric → system-b is allowed; it should fail on missing cert, NOT on policy
    const client = new RpcClient({
      serviceName: 'public-bric',
      certPath: '/nonexistent/cert.pem',
      keyPath: '/nonexistent/key.pem',
      caPath: '/nonexistent/ca.pem',
    });

    const response = await client.call('system-b', 'someMethod', {});

    // The call passed the policy check; failure is from missing cert files
    expect(response.success).toBe(false);
    // Error must NOT contain Zero-Trust (that would indicate a policy block)
    expect(response.error).not.toContain('Zero-Trust');
  });

  it('spine can call compliance – allowed by policy', async () => {
    const client = new RpcClient({
      serviceName: 'spine',
      certPath: '/nonexistent/cert.pem',
      keyPath: '/nonexistent/key.pem',
      caPath: '/nonexistent/ca.pem',
    });

    const response = await client.call('compliance', 'checkPolicy', {});

    expect(response.success).toBe(false);
    expect(response.error).not.toContain('Zero-Trust');
  });

  it('spine cannot call owners-room – denied by policy', async () => {
    const client = new RpcClient({
      serviceName: 'spine',
      certPath: '',
      keyPath: '',
      caPath: '',
    });

    const response = await client.call('owners-room', 'adminAction', {});

    expect(response.success).toBe(false);
    expect(response.error).toContain('Zero-Trust');
  });

  it('owners-room can call state-bric – allowed by policy', async () => {
    const client = new RpcClient({
      serviceName: 'owners-room',
      certPath: '/nonexistent/cert.pem',
      keyPath: '/nonexistent/key.pem',
      caPath: '/nonexistent/ca.pem',
    });

    const response = await client.call('state-bric', 'getCustomer', {});

    expect(response.success).toBe(false);
    expect(response.error).not.toContain('Zero-Trust');
  });

  it('records all outbound calls in the call log', async () => {
    const client = new RpcClient({
      serviceName: 'public-bric',
      certPath: '/nonexistent/cert.pem',
      keyPath: '/nonexistent/key.pem',
      caPath: '/nonexistent/ca.pem',
    });

    // Allowed call (cert error expected)
    await client.call('system-b', 'methodA', { key: 'val' });
    // Denied call (policy error expected)
    await client.call('stitch', 'methodB', {});

    const log = client.getCallLog();
    // Only the allowed call that reached the RPC stage is logged
    expect(log.length).toBeGreaterThanOrEqual(1);
    const logged = log[0];
    expect(logged.method).toBe('methodA');
    expect(logged.service).toBe('system-b');
    expect(logged.params).toEqual({ key: 'val' });
    expect(logged.requestId).toMatch(/^req_/);
    expect(logged.timestamp).toBeDefined();
  });

  it('response always includes requestId and timestamp', async () => {
    const client = new RpcClient({
      serviceName: 'unknown-svc',
      certPath: '',
      keyPath: '',
      caPath: '',
    });

    const response = await client.call('state-bric', 'anything', {});

    expect(response.requestId).toBeDefined();
    expect(typeof response.requestId).toBe('string');
    expect(response.timestamp).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// RpcServer – method dispatch
// ---------------------------------------------------------------------------

describe('RpcServer – method registration and dispatch', () => {
  let server: RpcServer;

  beforeEach(() => {
    server = new RpcServer({
      serviceName: 'test-service',
      certPath: '',
      keyPath: '',
      caPath: '',
    });
  });

  it('dispatches a registered method and returns its result', async () => {
    server.registerHandler('getCustomer', async (params) => ({
      id: params.customer_id,
      name: 'ACME Corp',
    }));

    const response = await server.handleRequest(
      makeRequest('getCustomer', { customer_id: 'cust-42' }),
    );

    expect(response.success).toBe(true);
    expect(response.result.id).toBe('cust-42');
    expect(response.result.name).toBe('ACME Corp');
    expect(response.requestId).toBeDefined();
    expect(response.timestamp).toBeDefined();
  });

  it('returns an error for an unknown method', async () => {
    const response = await server.handleRequest(makeRequest('unknownMethod'));

    expect(response.success).toBe(false);
    expect(response.error).toContain('unknownMethod');
    expect(response.requestId).toBeDefined();
  });

  it('returns an error when a handler throws', async () => {
    server.registerHandler('failingMethod', async () => {
      throw new Error('handler exploded');
    });

    const response = await server.handleRequest(makeRequest('failingMethod'));

    expect(response.success).toBe(false);
    expect(response.error).toContain('handler exploded');
  });

  it('passes params through to the handler unchanged', async () => {
    let receivedParams: unknown;
    server.registerHandler('echoParams', async (params) => {
      receivedParams = params;
      return params;
    });

    const params = { a: 1, b: 'two', c: true };
    await server.handleRequest(makeRequest('echoParams', params));

    expect(receivedParams).toEqual(params);
  });

  it('preserves requestId from the incoming request in the response', async () => {
    server.registerHandler('ping', async () => 'pong');

    const req = makeRequest('ping');
    const response = await server.handleRequest(req);

    expect(response.requestId).toBe(req.requestId);
  });

  it('can register and dispatch multiple handlers independently', async () => {
    server.registerHandler('methodA', async () => 'result-A');
    server.registerHandler('methodB', async () => 'result-B');

    const resA = await server.handleRequest(makeRequest('methodA'));
    const resB = await server.handleRequest(makeRequest('methodB'));

    expect(resA.result).toBe('result-A');
    expect(resB.result).toBe('result-B');
  });
});
