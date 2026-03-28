# Inter-BRIC RPC Communication Layer

**Law #8: Zero-Trust Architecture for Inter-BRIC Communication**

All communication between BRICs must use certificate-based authentication and encryption with mutual TLS (mTLS).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        BRIC Network                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      HTTPS+mTLS      ┌──────────────┐    │
│  │   Spine      │◄────────────────────► │  System B    │    │
│  │ (Port 4001)  │                       │ (Port 4002)  │    │
│  └──────────────┘                       └──────────────┘    │
│        ▲                                                      │
│        │ Signed Requests (Law #7)                            │
│        │ + Request Signature Hash                            │
│        │ + Merkle Root                                       │
│        │                                                      │
│  ┌──────────────┐      HTTPS+mTLS      ┌──────────────┐    │
│  │  State CA    │◄────────────────────► │  State IL    │    │
│  │ (Port 4003)  │                       │ (Port 4004)  │    │
│  └──────────────┘                       └──────────────┘    │
│        ▲                                         ▲            │
│        │                                         │            │
│        └─────────────┬───────────────────────────┘            │
│                      │                                        │
│              All requests verified by                        │
│              Stitch BRIC consensus                           │
│                                                               │
│  ┌──────────────┐      HTTPS+mTLS      ┌──────────────┐    │
│  │   Stitch     │◄────────────────────► │  Overseer    │    │
│  │ (Port 4008)  │  Signature Verif.     │ (Port 4007)  │    │
│  └──────────────┘  + Consensus          └──────────────┘    │
│                                                               │
│  ┌──────────────┐      HTTPS+mTLS      ┌──────────────┐    │
│  │ Owners Room  │◄────────────────────► │  State TX    │    │
│  │ (Port 4006)  │                       │ (Port 4005)  │    │
│  └──────────────┘                       └──────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘

All communication encrypted with TLS 1.3+
All requests signed with HMAC-SHA256
All responses include signature verification
Certificate rotation every 90 days
```

---

## Security Implementation (Law #8)

### 1. Mutual TLS (mTLS)

Every BRIC runs an HTTPS server that requires valid client certificates.

```typescript
// Server setup (lib/inter-bric-rpc/server.ts)
const options = {
  cert: serverCertificate,
  key: serverPrivateKey,
  ca: rootCACertificate,
  requestCert: true,           // Require client cert
  rejectUnauthorized: true,    // Validate it
};

const server = https.createServer(options, requestHandler);
server.listen(4001); // Spine BRIC
```

**Certificate Validation (Law #8)**:
- Server certificate must be signed by JGA Root CA
- Client certificate must be signed by JGA Root CA
- Certificate must not be expired
- Certificate subject must match expected BRIC name
- Certificate must have extended key usage for authentication

### 2. Request Signing (Law #7)

All requests are signed with HMAC-SHA256 to prevent tampering.

```typescript
// Client side: Sign request before sending
const signature = createHmac("sha256", INTER_BRIC_SECRET)
  .update(JSON.stringify({
    method: "POST",
    path: "/api/policy-check",
    body: policyPayload,
    timestamp: Date.now()
  }))
  .digest("hex");

// Send request with signature
await client.request({
  method: "POST",
  path: "/api/policy-check",
  body: policyPayload,
  headers: {
    "X-RPC-Signature": signature,
    "X-RPC-Timestamp": timestamp,
    "X-RPC-Source": "system-b"
  }
});

// Server side: Verify signature before processing
if (!verifySignature(method, path, body, signature)) {
  res.status(400).json({ error: "Signature verification failed" });
  return;
}
```

### 3. Request Sequencing & Merkle Roots

Requests include Merkle roots for verification by Stitch consensus.

```typescript
// Event ledger integration
interface RpcRequest {
  event_id: string;           // UUID
  timestamp: number;          // Unix timestamp
  source_bric: string;        // "system-b", "spine", etc.
  payload: any;
  merkle_root: string;        // Latest state hash from Stitch
  request_signature: string;  // HMAC signature
  stitch_signature: string;   // Stitch consensus signature
}
```

---

## Service Discovery

### Service Registry

Automatically discovers all BRICs from environment variables:

```typescript
// Register all BRICs
const registry = ServiceRegistry.fromEnvironment();

// Services registered:
// - spine         (port 4001)
// - system-b      (port 4002)
// - state-ca      (port 4003)
// - state-il      (port 4004)
// - state-tx      (port 4005)
// - owners-room   (port 4006)
// - overseer      (port 4007)
// - stitch        (port 4008)
```

### Client Pool

Clients are created on-demand and cached:

```typescript
const factory = new RpcClientFactory(registry);

// Get client for specific BRIC
const spineClient = factory.getClient("spine");

// Get all clients
const allClients = factory.getAllClients();
```

---

## Reliability Patterns

### Circuit Breaker

Prevents cascading failures by temporarily stopping requests to failing services.

```typescript
const circuitBreaker = new CircuitBreaker(
  threshold = 5,      // Open after 5 failures
  resetTimeout = 60s  // Try again after 1 minute
);

try {
  await circuitBreaker.execute(() => client.request(rpcRequest));
} catch (error) {
  if (error.message.includes("Circuit breaker is open")) {
    // Service is unavailable, use fallback
    return fallbackResponse;
  }
}
```

### Exponential Backoff Retry

Automatic retry with increasing delays:

```typescript
// Retry configuration (via p-retry)
{
  retries: 3,
  minTimeout: 100,    // Start at 100ms
  maxTimeout: 3000    // Cap at 3000ms
  // 1st retry: 100ms
  // 2nd retry: ~500ms
  // 3rd retry: ~2000ms
  // Then finally fail
}
```

---

## Request/Response Flow

### Request Flow

```
1. Client BRIC (System B) wants to call Policy Check on Spine
   
   ┌─────────────────────────────┐
   │ Create RPC Request          │
   │ - method: "POST"            │
   │ - path: "/api/policies/check" │
   │ - body: { customer_id, ... }  │
   └──────────────┬──────────────┘
                   │
   ┌──────────────▼──────────────┐
   │ Sign Request (Law #7)       │
   │ - HMAC-SHA256(payload)      │
   │ - Add timestamp             │
   │ - Generate request_id       │
   └──────────────┬──────────────┘
                   │
   ┌──────────────▼──────────────┐
   │ Check Circuit Breaker       │
   │ - Is Spine healthy?         │
   │ - If open: return fallback  │
   └──────────────┬──────────────┘
                   │
   ┌──────────────▼──────────────┐
   │ Load Client Certificates    │
   │ - Client cert               │
   │ - Client key                │
   │ - Root CA cert              │
   └──────────────┬──────────────┘
                   │
   ┌──────────────▼──────────────┐
   │ Make HTTPS Request          │
   │ - Establish mTLS connection │
   │ - Validate server cert      │
   │ - Send signed request       │
   └──────────────┬──────────────┘
                   │
   ┌──────────────▼──────────────┐
   │ Retry on Failure            │
   │ - Up to 3 attempts          │
   │ - Exponential backoff       │
   │ - Circuit breaker tracking  │
   └──────────────┬──────────────┘
                   │
   ┌──────────────▼──────────────┐
   │ Record in Event Ledger      │
   │ - RPC request event         │
   │ - Include signatures        │
   │ - Store merkle root         │
   └─────────────────────────────┘
```

### Response Flow (Server Side)

```
1. Spine RPC Server receives request from System B

   ┌───────────────────────────┐
   │ Accept HTTPS Connection   │
   │ - Validate client cert    │
   │ - Verify not expired      │
   │ - Check certificate chain │
   └──────────┬────────────────┘
              │
   ┌──────────▼────────────────┐
   │ Verify Request            │
   │ - Check timestamp (< 5min) │
   │ - Verify signature (Law #7) │
   │ - Validate source BRIC    │
   └──────────┬────────────────┘
              │
   ┌──────────▼────────────────┐
   │ Log Request (Audit Trail) │
   │ - Client certificate info │
   │ - Request timestamp       │
   │ - Signature verification  │
   └──────────┬────────────────┘
              │
   ┌──────────▼────────────────┐
   │ Route to Handler          │
   │ - Match method + path     │
   │ - Call handler function   │
   └──────────┬────────────────┘
              │
   ┌──────────▼────────────────┐
   │ Sign Response (Law #7)    │
   │ - HMAC-SHA256(response)   │
   │ - Add timestamp           │
   └──────────┬────────────────┘
              │
   ┌──────────▼────────────────┐
   │ Send HTTPS Response       │
   │ - Include signature       │
   │ - Status 200 if success   │
   │ - Status 4xx/5xx if error │
   └──────────┬────────────────┘
              │
   ┌──────────▼────────────────┐
   │ Record in Event Ledger    │
   │ - RPC response event      │
   │ - Include signatures      │
   │ - Store merkle root       │
   └───────────────────────────┘
```

---

## Certificate Management

### Certificate Files Structure

```
/etc/jga/
├── ca-cert.pem              # Root CA certificate
├── ca-key.pem               # Root CA private key (secure)
│
├── brics/
│   ├── spine/
│   │   ├── cert.pem         # Spine certificate
│   │   ├── key.pem          # Spine private key
│   │   └── csr.pem          # Certificate signing request
│   │
│   ├── system-b/
│   │   ├── cert.pem
│   │   ├── key.pem
│   │   └── csr.pem
│   │
│   ├── state-ca/
│   │   ├── cert.pem
│   │   ├── key.pem
│   │   └── csr.pem
│   │
│   ├── state-il/
│   │   ├── cert.pem
│   │   ├── key.pem
│   │   └── csr.pem
│   │
│   ├── state-tx/
│   │   ├── cert.pem
│   │   ├── key.pem
│   │   └── csr.pem
│   │
│   ├── owners-room/
│   │   ├── cert.pem
│   │   ├── key.pem
│   │   └── csr.pem
│   │
│   ├── overseer/
│   │   ├── cert.pem
│   │   ├── key.pem
│   │   └── csr.pem
│   │
│   └── stitch/
│       ├── cert.pem
│       ├── key.pem
│       └── csr.pem
│
└── rotation/
    ├── spine-cert.new.pem
    └── [staged new certs before rollover]
```

### Certificate Rotation

Certificates are rotated every 90 days:

```bash
# 1. Generate new certificate signing request
openssl req -new \
  -key /etc/jga/brics/spine/key.pem \
  -out /etc/jga/brics/spine/csr.pem

# 2. Sign with Root CA
openssl x509 -req \
  -in /etc/jga/brics/spine/csr.pem \
  -CA /etc/jga/ca-cert.pem \
  -CAkey /etc/jga/ca-key.pem \
  -CAcreateserial \
  -out /etc/jga/rotation/spine-cert.new.pem \
  -days 365 \
  -sha256

# 3. Stage new certificate
mv /etc/jga/rotation/spine-cert.new.pem \
   /etc/jga/brics/spine/cert.pem.new

# 4. Trigger graceful rotation in running service
curl -X POST https://spine:4001/admin/rotate-cert

# 5. Service loads new cert, continues serving existing connections
# 6. After 24 hours, old cert is archived
```

---

## Monitoring & Observability

### Circuit Breaker Metrics

```typescript
const spineClient = factory.getClient("spine");
const state = spineClient.circuitBreaker.getState();

// States:
// - "closed"     (healthy, accepting requests)
// - "half-open"  (recovering, testing single request)
// - "open"       (failing, rejecting requests)

console.log(`Spine circuit breaker: ${state}`);
```

### Request Audit Log

```typescript
// Server maintains audit log of all RPC requests
const server = new RpcServer("spine", 4001, ...);
const auditLog = server.getAuditLog();

// Sample entry:
{
  timestamp: "2026-03-28T14:30:45.123Z",
  method: "POST",
  path: "/api/policies/check",
  clientCertificate: "CN=system-b, O=JGA, C=US",
  status: 200,
  error: null,
  bricName: "spine"
}
```

### Event Ledger Integration

All RPC requests and responses are recorded in the event ledger:

```sql
-- RPC request event
INSERT INTO public.event_ledger (
  event_id, event_type, source_bric, payload, hash, 
  merkle_root, digital_signature
) VALUES (
  uuid_v4(),
  'rpc-request',
  'system-b',
  jsonb_build_object(
    'target_bric', 'spine',
    'path', '/api/policies/check',
    'method', 'POST',
    'timestamp', NOW()
  ),
  'sha256_hash_of_payload',
  'current_merkle_root',
  'stitch_bric_signature'
);
```

---

## Configuration Environment Variables

```bash
# BRIC Service Endpoints
BRIC_SPINE_HOST=localhost
BRIC_SPINE_PORT=4001
BRIC_SPINE_CERT=/etc/jga/brics/spine/cert.pem
BRIC_SPINE_KEY=/etc/jga/brics/spine/key.pem

BRIC_SYSTEM_B_HOST=localhost
BRIC_SYSTEM_B_PORT=4002
BRIC_SYSTEM_B_CERT=/etc/jga/brics/system-b/cert.pem
BRIC_SYSTEM_B_KEY=/etc/jga/brics/system-b/key.pem

# Current BRIC Identity
BRIC_NAME=system-b

# Shared Secret for HMAC Signing (Law #7)
INTER_BRIC_SECRET=<64-char-random-hex>

# Root CA for Certificate Validation (Law #8)
JGA_BRIC_CA_PATH=/etc/jga/ca-cert.pem

# TLS Configuration
TLS_MIN_VERSION=1.3
TLS_CIPHER_SUITES=TLS_AES_256_GCM_SHA384,TLS_CHACHA20_POLY1305_SHA256
```

---

## Error Handling

### Common RPC Errors

| Error | Status | Meaning | Action |
|-------|--------|---------|--------|
| Certificate validation failed | 401 | Client cert invalid or expired | Rotate certificate |
| Signature verification failed | 400 | Request or response tampered | Log incident, investigate |
| Handler not found | 404 | BRIC doesn't support this RPC | Check BRIC version/config |
| Timeout | 504 | Service not responding | Check circuit breaker state |
| Circuit breaker open | 503 | Service is failing | Wait for recovery, use fallback |

---

## Testing Inter-BRIC Communication

### Unit Test Example

```typescript
import { InterBricRpcClient, RpcServer } from "@/lib/inter-bric-rpc";

describe("Inter-BRIC RPC Communication", () => {
  let server: RpcServer;
  let client: InterBricRpcClient;

  beforeEach(async () => {
    // Start test server with test certificates
    server = new RpcServer(
      "test-bric",
      5000,
      "./test/certs/server.pem",
      "./test/certs/server-key.pem",
      "./test/certs/ca.pem"
    );

    server.register("POST", "/api/test", async (req) => ({
      status: 200,
      body: { success: true, received: req.body },
    }));

    await server.start();

    // Create client
    client = new InterBricRpcClient({
      name: "test-client",
      host: "localhost",
      port: 5000,
      certPath: "./test/certs/client.pem",
      keyPath: "./test/certs/client-key.pem",
      caPath: "./test/certs/ca.pem",
      timeout: 5000,
    });
  });

  test("should send signed request and verify signed response", async () => {
    const response = await client.request({
      method: "POST",
      path: "/api/test",
      body: { data: "test" },
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.signature).toBeDefined();
  });

  test("should verify request signatures", async () => {
    // Invalid signature should be rejected
    const response = await client.request({
      method: "POST",
      path: "/api/test",
      body: { data: "test" },
      headers: { "X-RPC-Signature": "invalid" },
    });

    expect(response.status).toBe(400);
  });

  afterEach(async () => {
    await server.stop();
  });
});
```

---

## Performance Considerations

### Latency Budget

- **Certificate validation**: ~2ms
- **HMAC signing**: ~0.1ms
- **Network round-trip**: 10-50ms (local)
- **Request processing**: 50-500ms (depends on operation)
- **Total**: ~60-550ms per RPC call

### Throughput Targets

- **Requests per second per client**: 100+ (with 10 concurrent connections)
- **Max concurrent connections per server**: 1000
- **Request timeout**: 5 seconds default

### Optimization Strategies

1. **Connection pooling**: Reuse HTTPS connections
2. **Request batching**: Group multiple operations into single RPC
3. **Caching**: Cache policy checks, compliance decisions
4. **Async operations**: Use event ledger for fire-and-forget updates

---

## Troubleshooting

### Certificate Errors

```
Error: UNABLE_TO_VERIFY_LEAF_SIGNATURE
→ Root CA certificate not in trust store
→ Check JGA_BRIC_CA_PATH environment variable

Error: CERTIFICATE_VERIFY_FAILED
→ Client certificate was revoked or expired
→ Run certificate rotation procedure

Error: SELF_SIGNED_CERT_IN_CHAIN
→ Intermediate certificate missing from chain
→ Ensure full certificate chain in cert.pem
```

### Signature Verification Failures

```
Error: Signature verification failed. Possible tampering detected.
→ INTER_BRIC_SECRET mismatch between BRICs
→ Verify all BRICs have same secret
→ Check for network proxies modifying traffic

Error: Request expired (> 5 minutes old)
→ Server clock skew
→ Sync server clocks with NTP: ntpd
```

### Circuit Breaker Issues

```
Circuit breaker is open. Service unavailable.
→ Target BRIC is failing
→ Check BRIC health: curl https://bric:port/health
→ Review logs for errors
→ Circuit will reset after 60 seconds
```

---

## Related Documentation

- [DATA_FLOW.md](./DATA_FLOW.md) - How RPC calls fit in data flow
- [EVENT_SYSTEM.md](./EVENT_SYSTEM.md) - Event ledger integration
- [ARCHITECTURE.md](./ARCHITECTURE.md) - BRIC architecture overview
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Audit log schema

---

**Law #8 Status**: ✅ Zero-Trust Architecture Implemented
- All inter-BRIC communication requires mTLS
- All requests are signed and verified
- Audit trail of all RPC communication
- Automated certificate rotation
- Circuit breaker protection against cascading failures

**Last Updated**: March 28, 2026
