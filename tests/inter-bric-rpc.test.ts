import { EventEmitter } from 'events';
import fs from 'fs';
import https from 'https';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RpcClient, RpcServer } from '@/lib/inter-bric-rpc';

const mtlsConfig = { serviceName: 'state-bric', certPath: 'cert', keyPath: 'key', caPath: 'ca' };

function mockHttpsRequest(responseBody: string) {
  const requestSpy = vi.spyOn(https, 'request').mockImplementation((_, __, callback) => {
    const response = new EventEmitter() as any;
    callback(response);

    process.nextTick(() => {
      response.emit('data', responseBody);
      response.emit('end');
    });

    return {
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    } as any;
  });

  vi.spyOn(https, 'Agent').mockImplementation(() => ({}) as any);
  vi.spyOn(fs, 'readFileSync').mockReturnValue('stub-cert');

  return requestSpy;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('RpcClient', () => {
  it('denies calls that violate default-deny policy', async () => {
    const client = new RpcClient({ ...mtlsConfig, serviceName: 'public-bric' });
    const response = await client.call('state-bric', 'provision', {});

    expect(response.success).toBe(false);
    expect(response.error).toContain('Call denied');
    expect(client.getCallLog()).toHaveLength(0);
  });

  it('performs allowed calls with mTLS setup and logs request', async () => {
    const requestSpy = mockHttpsRequest(
      JSON.stringify({
        success: true,
        result: { ok: true },
        requestId: 'res-1',
        timestamp: new Date().toISOString(),
      })
    );

    const client = new RpcClient({ ...mtlsConfig, serviceName: 'state-bric' });
    const response = await client.call('stitch', 'verify', { payload: 'data' }, 'trace-123');

    expect(response.success).toBe(true);
    expect(requestSpy).toHaveBeenCalled();

    const [loggedRequest] = client.getCallLog();
    expect(loggedRequest.service).toBe('stitch');
    expect(loggedRequest.method).toBe('verify');
    expect(loggedRequest.correlationId).toBe('trace-123');
    expect(loggedRequest.requestId).toBeTruthy();
  });

  it('rejects when RPC response is invalid JSON', async () => {
    mockHttpsRequest('not-json');
    const client = new RpcClient({ ...mtlsConfig, serviceName: 'state-bric' });

    await expect(client.call('stitch', 'verify', { payload: 'data' })).rejects.toThrow('Invalid RPC response');
  });

  it('returns failure when mTLS setup throws', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('missing certificate');
    });

    const client = new RpcClient({ ...mtlsConfig, serviceName: 'state-bric' });
    const response = await client.call('stitch', 'verify', { payload: 'data' });

    expect(response.success).toBe(false);
    expect(response.error).toContain('missing certificate');
  });
});

describe('RpcServer', () => {
  it('returns error for unknown methods', async () => {
    const server = new RpcServer(mtlsConfig);
    const response = await server.handleRequest({
      method: 'missing',
      service: 'state-bric',
      params: {},
      requestId: 'req-1',
      timestamp: new Date().toISOString(),
    });

    expect(response.success).toBe(false);
    expect(response.error).toContain('Unknown method');
  });

  it('executes registered handlers and returns result', async () => {
    const server = new RpcServer(mtlsConfig);
    server.registerHandler('echo', async (params) => ({ echoed: params.value }));

    const response = await server.handleRequest({
      method: 'echo',
      service: 'state-bric',
      params: { value: 42 },
      requestId: 'req-2',
      timestamp: new Date().toISOString(),
    });

    expect(response.success).toBe(true);
    expect(response.result).toEqual({ echoed: 42 });
  });

  it('returns failure when handler throws', async () => {
    const server = new RpcServer(mtlsConfig);
    server.registerHandler('explode', async () => {
      throw new Error('boom');
    });

    const response = await server.handleRequest({
      method: 'explode',
      service: 'state-bric',
      params: {},
      requestId: 'req-3',
      timestamp: new Date().toISOString(),
    });

    expect(response.success).toBe(false);
    expect(response.error).toContain('boom');
  });
});
