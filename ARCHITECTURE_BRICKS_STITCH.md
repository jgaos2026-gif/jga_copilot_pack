# JGA Enterprise OS — Brick/Stitch Architecture Specification

**Version:** 1.0  
**Effective Date:** 2026-04-03  
**Authority:** SYSTEM_CONSTITUTION.md Article II; SECTIONAL_LAWS.md Section 4

---

## 1. Brick System Overview

The Brick System partitions the platform into isolated, independently deployable units called **BRICs** (Boundary-Restricted Isolated Components). Each BRIC owns its data, enforces its own access rules, and communicates with other BRICs only via declared, authenticated contracts.

### 1.1 — BRIC Catalog

| BRIC ID | Name | Purpose | Data Sensitivity |
|---|---|---|---|
| `public` | Public BRIC | Marketing site, intake entrypoint | Low (public only) |
| `spine` | Spine BRIC | AI policy, agent governance, compliance logic | Low (no PII) |
| `system-b` | System B BRIC | Operations: onboarding, routing, scheduling | Medium (assignment records only) |
| `state-{tag}` | State BRICs | Per-state customer data, projects, payments | High (PII, financials) |
| `owners-room` | Owners Room BRIC | Lifecycle management, audit visibility | High (admin control plane) |

### 1.2 — State BRIC Tags

| State | Tag | Status |
|---|---|---|
| Illinois | IL-01 | Seeded (demo) |
| Texas | TX-44 | Seeded (demo) |
| California | CA-* | Template ready |

---

## 2. Brick Boundaries and State-to-State Partitioning

### 2.1 — Partitioning Rules

Each State BRIC is a hard partition boundary:
- **Separate database schema** per state (e.g., `state_il`, `state_tx`)
- **Separate encryption keys** per state (KMS vault per state BRIC)
- **Separate IAM principals** per state (database users, service accounts)
- **No cross-state data queries** are permitted at the application or database layer

### 2.2 — Data Ownership

| Data Type | Owner BRIC |
|---|---|
| Marketing content | Public |
| Pricing schedules | Spine (authoritative) → read by System B |
| Lead contact info | System B (until assigned) → transferred to State BRIC |
| Client PII | State BRIC (state-specific) |
| Project files | State BRIC |
| Payment records | State BRIC |
| NDAs and contracts | State BRIC |
| Audit logs | Replicated across all BRICs; aggregated by Owners Room |
| Compliance artifacts | Spine (generated) → signed copy in Owners Room |
| Agent assignments | System B |

### 2.3 — State Selection Logic

```typescript
// config layer: state-to-rule selection
interface StateBricConfig {
  tag: string;          // e.g., "IL-01"
  dbSchema: string;     // e.g., "state_il"
  kmsKeyId: string;     // KMS key ARN or ID
  iamPrincipal: string; // service account identifier
  retentionYears: number;
  sectionalLawRef: string; // e.g., "SECTIONAL_LAWS.md § 1.1"
  active: boolean;
}
```

State selection is driven by a config file (`config/state-brics.json`) loaded at startup. The Compliance Agent must validate a state-specific compliance artifact exists before the state BRIC can receive work.

---

## 3. Stitch Brick Tech Data System

### 3.1 — Overview

The Stitch Brick system provides cryptographic integrity, tamper-evident logging, consensus replication, and automatic healing for all sensitive micro-bricks (records). It is the implementation of System Law 7.

### 3.2 — Micro-Brick Schema

Every micro-brick record must conform to:

```typescript
interface MicroBrick {
  id: string;               // UUID
  bricId: string;           // owning BRIC ID
  dataType: string;         // e.g., "customer", "project", "payment", "contract"
  payload: string;          // JSON-serialized, encrypted payload
  hash: string;             // SHA-256 of (id + bricId + dataType + payload + prevHash)
  prevHash: string;         // hash of the previous brick in the chain (Merkle link)
  merkleRoot?: string;      // Merkle tree root at this checkpoint
  timestamp: number;        // Unix ms
  version: number;          // monotonically increasing
  replicaSet: string[];     // replica node IDs that have confirmed this brick
  integrityStatus: 'clean' | 'suspect' | 'corrupt' | 'healing' | 'healed';
  signature?: string;       // Ed25519 signature over hash
}
```

### 3.3 — Metadata-Only Rules

The Stitch Brick layer operates on metadata exclusively:
- The `payload` field is always **encrypted** before being stored in `MicroBrick`.
- The Stitch Brick layer sees only: `id`, `hash`, `prevHash`, `timestamp`, `version`, `replicaSet`, `integrityStatus`.
- Decryption of `payload` is the responsibility of the owning State BRIC, using its KMS key.
- The Stitch Brick consensus layer never sees plaintext PII or financial data.

### 3.4 — Hash Chain Construction

```
hash(n) = SHA-256(id_n + bricId + dataType + encryptedPayload_n + hash(n-1))
```

The genesis brick uses `prevHash = "0000...0000"` (64 zeroes).

Every new write must:
1. Fetch the current chain tip's hash.
2. Compute the new hash.
3. Write the micro-brick atomically (hash + record).
4. Broadcast to replica nodes.
5. Await majority quorum acknowledgment before returning success.

### 3.5 — Corruption Detection

Corruption is detected by:
1. **Periodic verification:** A scheduled job (default: every 15 minutes) recomputes the SHA-256 hash of each micro-brick and compares it to the stored hash.
2. **On-read verification:** The `store.get()` method optionally recomputes and verifies hashes before returning data.
3. **Replica divergence detection:** Consensus nodes compare chain tips; divergence flags a suspect node.

When a mismatch is detected:
- The brick's `integrityStatus` is updated to `corrupt`.
- An incident is logged to the audit trail (Overseer notified).
- Healing procedure initiates automatically.

### 3.6 — Auto-Heal Procedure

```
1. Quarantine corrupted node (mark as unavailable).
2. Fetch last known-good checkpoint from a healthy replica.
3. Replay append-only event log from checkpoint to current tip.
4. Recompute all hashes; verify against majority quorum.
5. If hashes match majority: mark node as `healed`, rejoin replica set.
6. If hashes do not match after replay: mark node for replacement.
7. Log all steps to immutable audit trail.
8. Alert Owners Room if healing fails.
```

Implementation: `lib/sovereignStitch/store.ts`, `lib/sovereignStitch/replica.ts`, `lib/sovereignStitch/merkle.ts`

### 3.7 — Consensus Protocol

The Stitch Brick system uses a Raft-class majority quorum:
- Minimum 3 replica nodes per State BRIC in production.
- A write is confirmed only when a majority (⌊n/2⌋ + 1) acknowledge.
- Leader election follows Raft protocol (see `lib/sovereignStitch/raft/`).
- Split-brain protection: minority partition goes read-only.

---

## 4. Compliance Gates at BRIC Boundaries

### 4.1 — Gate Definition

A **compliance gate** is a programmatic check that must pass before a cross-BRIC call, business workflow, or status transition is allowed to proceed. Gates are enforced by the policy engine (`lib/policy-engine/`).

### 4.2 — Gate Catalog

| Gate ID | Trigger | Check | Block Condition |
|---|---|---|---|
| `GATE-01` | Project → `active` status | Contract signed? | `contract_signed != true` |
| `GATE-02` | Production work starts | Deposit confirmed? | `deposit_confirmed != true` |
| `GATE-03` | Final delivery | Final payment cleared? | `final_payment_cleared != true` |
| `GATE-04` | Outbound business call | Compliance artifact valid? | No valid artifact |
| `GATE-05` | New State BRIC activation | Owner + Compliance Agent dual-auth? | Missing either auth |
| `GATE-06` | Contractor data access | Within assigned scope? | Out-of-scope request |
| `GATE-07` | Pricing quote served | Originates from pricing engine? | Hardcoded price detected |
| `GATE-08` | Audit log write | Append-only? | UPDATE or DELETE attempted |

### 4.3 — Policy Engine Interface

```typescript
// lib/policy-engine/index.ts
interface PolicyContext {
  actorId: string;
  actorRole: 'owner' | 'admin' | 'staff' | 'contractor' | 'client' | 'agent';
  bricId: string;
  resourceId?: string;
  resourceType?: string;
  stateTag?: string;
  extras?: Record<string, unknown>;
}

interface PolicyResult {
  allow: boolean;
  rationale: string;
  gateId?: string;
  requiresEscalation?: boolean;
}

interface PolicyEngine {
  validate(action: string, context: PolicyContext): PolicyResult;
  loadPolicies(path: string): void;
}
```

### 4.4 — Gate Enforcement in CI

The CI compliance check (`npm run compliance:check`) validates:
1. All required governance documents exist with required sections.
2. All compliance gates (GATE-01 through GATE-08) have corresponding policy rules in `lib/policy-engine/policies/`.
3. No code bypasses the `policyEngine.validate()` call on guarded paths.
4. No secrets appear in committed code.

---

## 5. Inter-BRIC Communication Contracts

### 5.1 — RPC Contract Format

```typescript
// lib/inter-bric-rpc/index.ts
interface BricRpcRequest {
  fromBric: string;
  toBric: string;
  method: string;
  params: Record<string, unknown>;
  traceId: string;
  timestamp: number;
  auth: string; // service identity JWT or mTLS identity
}

interface BricRpcResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  traceId: string;
  timestamp: number;
}
```

### 5.2 — Allowed RPC Calls

| Caller | Target | Method | Gate |
|---|---|---|---|
| System B | State BRIC | `routeWork` | GATE-06 |
| System B | State BRIC | `getAssignment` | GATE-06 |
| ORION Agent | System B | `scheduleOp` | GATE-04 |
| VERA Agent | State BRIC | `verifyIntegrity` | None (read) |
| Overseer | Any | `getAuditLog` | None (read) |
| Owners Room | Any | `getHealthStatus` | MFA required |
| Owners Room | Spine | `activateBric` | GATE-05 |

---

## 6. Deployment Topology

```
Internet
   │
[CDN / Edge]
   │
[Public BRIC] ──────────────────────────> (read-only, marketing)
   │ (intake form only)
[System B BRIC]
   ├── routes → [State BRIC: IL-01]  (isolated DB + KMS)
   ├── routes → [State BRIC: TX-44]  (isolated DB + KMS)
   └── routes → [State BRIC: ...]
   
[Spine BRIC] ──────────────────────────> (policy artifacts, AI governance)
[Owners Room] ─────────────────────────> (VPN + MFA, read-only aggregates)
[Overseer] ────────────────────────────> (sidecar on all BRICs)
[Compliance Agent] ─────────────────────> (offline initially; produces signed artifact)
```

---

*See also: AGENTS.md, SYSTEM_CONSTITUTION.md, SECTIONAL_LAWS.md, lib/sovereignStitch/, lib/policy-engine/, lib/inter-bric-rpc/*
