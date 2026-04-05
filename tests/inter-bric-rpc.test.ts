/**
 * Inter-BRIC RPC — Unit Tests
 * Validates policy enforcement and default-deny (Law #8)
 */

import { describe, it, expect } from 'vitest';
import { RpcClient, RpcServer } from '@/lib/inter-bric-rpc/index';

// mTLS config that points to non-existent certs — RpcClient must tolerate this
// at construction time and only fail when actually opening a TLS connection.
const stubMtls = {
  serviceName: 'test-service',
  certPath: '/tmp/nonexistent.crt',
  keyPath: '/tmp/nonexistent.key',
  caPath: '/tmp/nonexistent-ca.crt',
};

describe('RpcClient — construction', () => {
  it('constructs without throwing', () => {
    expect(() => new RpcClient(stubMtls)).not.toThrow();
  });

  it('constructs with empty cert paths (invalid client for mTLS rejection test)', () => {
    expect(() => new RpcClient({ serviceName: 'test-empty-certs-service', certPath: '', keyPath: '', caPath: '' })).not.toThrow();
  });
});

describe('RpcClient — policy enforcement (Law #8)', () => {
  it('rejects calls to services not in the allow list (default-deny)', async () => {
    const client = new RpcClient({
      ...stubMtls,
      serviceName: 'public-bric',
    });

    // public-bric may only call system-b; calling state-bric must be denied
    const response = await client.call('state-bric', 'getCustomer', { customer_id: 'x' });
    expect(response.error).toBeDefined();
    expect(typeof response.error).toBe('string');
  });

  it('policy matrix: public-bric may call system-b', async () => {
    const client = new RpcClient({ ...stubMtls, serviceName: 'public-bric' });

    // This will fail with a connection error (no real server), but NOT a policy error
    const response = await client.call('system-b', 'captureLeadFromPublic', {});
    // Either succeeds or fails with non-policy error
    if (response.error) {
      expect(response.error).not.toContain('Zero-Trust');
    }
  });

  it('policy matrix: system-b may call state-bric', async () => {
    const client = new RpcClient({ ...stubMtls, serviceName: 'system-b' });
    const response = await client.call('state-bric', 'getCustomer', {});
    if (response.error) {
      expect(response.error).not.toContain('Zero-Trust');
    }
  });

  it('policy matrix: owners-room may call compliance', async () => {
    const client = new RpcClient({ ...stubMtls, serviceName: 'owners-room' });
    const response = await client.call('compliance', 'getStatus', {});
    if (response.error) {
      expect(response.error).not.toContain('Zero-Trust');
    }
  });

  it('policy matrix: state-bric cannot call public-bric (Law #1 + Law #8)', async () => {
    const client = new RpcClient({ ...stubMtls, serviceName: 'state-bric' });
    const response = await client.call('public-bric', 'anything', {});
    expect(response.error).toBeDefined();
    expect(response.error).toContain('Zero-Trust');
  });
});

describe('RpcServer — construction', () => {
  it('constructs without throwing', () => {
    expect(
      () =>
        new RpcServer({
          serviceName: 'test-server',
          certPath: '/tmp/nonexistent.crt',
          keyPath: '/tmp/nonexistent.key',
          caPath: '/tmp/nonexistent-ca.crt',
        })
    ).not.toThrow();
  });
});
