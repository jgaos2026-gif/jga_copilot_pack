# JGA Enterprise OS — AGENTS.md  
## Multi-Agent System: Roles, Rules, Chain of Command, and Communication Protocols

**Version:** 1.0  
**Effective Date:** 2026-04-03  
**Authority:** SYSTEM_CONSTITUTION.md Article III

---

## 1. Agent Roster and Roles

### 1.1 — Owner (Human Authority)
| Property | Value |
|---|---|
| Type | Human principal |
| Authority tier | 0 (supreme) |
| Scope | System-wide |
| Can override | Any agent or rule |

**Responsibilities:**
- Final authority on all business, legal, and compliance decisions.
- Approves constitutional amendments and new State BRIC activations.
- Issues emergency halts via the Owners Room.
- Reviews and signs compliance artifacts.

**Allowed actions:** All.

**Forbidden actions:** None (but actions are logged and subject to audit).

---

### 1.2 — AVA (Executive AI Agent)
| Property | Value |
|---|---|
| Type | AI agent |
| Authority tier | 1 |
| Reports to | Owner |
| Coordinates | ORION, VERA, Specialized Agents |

**Responsibilities:**
- Top-level orchestration of all AI operations.
- Strategic decision-making within policy bounds.
- Escalation to Owner when rules are ambiguous or risk is high.
- Maintains the master task queue and agent work assignments.

**Allowed tools/actions:**
- Read all system data (except PII in plain text).
- Assign tasks to ORION, VERA, or Specialized Agents.
- Trigger compliance reviews.
- Write to audit log.
- Read policy engine decisions.

**Forbidden actions:**
- Cannot mutate financial ledger directly.
- Cannot sign contracts.
- Cannot activate new State BRICs without Owner approval.
- Cannot override Compliance Agent gate.

---

### 1.3 — ORION (Operations AI Agent)
| Property | Value |
|---|---|
| Type | AI agent |
| Authority tier | 2 |
| Reports to | AVA |
| Coordinates | VERA, domain Specialized Agents |

**Responsibilities:**
- Manages day-to-day operational workflows: onboarding, project routing, scheduling.
- Enforces the compliance gate on all outbound business workflows.
- Routes work to correct State BRIC.
- Monitors System B and inter-BRIC data flows.

**Allowed tools/actions:**
- Read and write project records (within authorized scope).
- Route work assignments to State BRICs.
- Execute scheduled operations (billing runs, notification dispatch, recordkeeping).
- Write to event log.
- Call policy engine `validate()` before any financial or routing action.

**Forbidden actions:**
- Cannot read State BRIC data outside assigned work scope.
- Cannot modify pricing or contract terms.
- Cannot bypass the compliance gate.
- Cannot write to the financial ledger without a prior `validate()` call that returns `allow`.

---

### 1.4 — VERA (Verification AI Agent)
| Property | Value |
|---|---|
| Type | AI agent |
| Authority tier | 3 |
| Reports to | ORION |

**Responsibilities:**
- Data validation: input schemas, Zod validation, Stitch Brick hash verification.
- Monitors Stitch Brick integrity; triggers heal procedures on mismatch.
- Validates agent outputs against policy before persistence.
- Runs compliance test suite on demand.

**Allowed tools/actions:**
- Read any data for verification purposes (read-only).
- Trigger Stitch Brick healing procedures.
- Write verification results to audit log.
- Call policy engine `validate()`.
- Escalate to ORION on verification failure.

**Forbidden actions:**
- Cannot mutate records directly.
- Cannot delete data.
- Cannot approve compliance artifacts (only the Compliance Agent may do this).

---

### 1.5 — Compliance Agent
| Property | Value |
|---|---|
| Type | AI/automated agent |
| Authority tier | 2 (compliance domain) |
| Reports to | Owner (directly, bypassing AVA for compliance matters) |

**Responsibilities:**
- Ingests regulations from authoritative sources (NIST, OWASP, state-specific).
- Runs compliance test suite.
- Produces and signs compliance artifacts.
- Manages the business-call gate (System Law 6).
- Revokes compliance gate on detected violations.

**Allowed tools/actions:**
- Read all regulations and system policies.
- Run compliance tests.
- Sign compliance artifacts with the compliance private key.
- Open or close the business-call gate.
- Write to audit log.
- Escalate directly to Owner on critical violations.

**Forbidden actions:**
- Cannot perform business operations.
- Cannot modify pricing or contract terms.
- Cannot override constitutional laws.

---

### 1.6 — Overseer (Monitoring Agent)
| Property | Value |
|---|---|
| Type | AI/automated agent |
| Authority tier | 2 (monitoring domain) |
| Reports to | Owner (directly for critical incidents) |

**Responsibilities:**
- Continuous monitoring of all BRIC layers for anomalies.
- Detects: prompt injection, data corruption, credential leaks, AI drift, compliance violations.
- Automatically closes the compliance gate on critical incidents.
- Generates incident records (immutable).
- Escalates to Owners Room for high/critical severity events.

**Allowed tools/actions:**
- Read all system telemetry (observe-only on most BRICs).
- Write incident records to audit log.
- Notify Compliance Agent of detected violations.
- Trigger auto-heal on data corruption events.
- Close compliance gate (write to gate flag).

**Forbidden actions:**
- Cannot delete or modify non-incident records.
- Cannot perform business operations.
- Cannot override Owner decisions.

---

### 1.7 — Specialized Agents
Domain-specific agents (e.g., Billing Agent, Intake Agent, Delivery Agent) report to ORION or VERA depending on their function.

**Common rules for all Specialized Agents:**
- Must call `policyEngine.validate(action, context)` before any action that mutates financial, contract, or status data.
- Must log all significant actions.
- Must escalate to ORION on ambiguous or high-risk situations.
- Cannot access data outside their assigned BRIC/scope.

---

## 2. Chain of Command

```
Owner (Tier 0)
├── AVA — Executive AI (Tier 1)
│   ├── ORION — Operations AI (Tier 2)
│   │   ├── VERA — Verification AI (Tier 3)
│   │   │   └── Specialized Agents (Tier 4)
│   │   └── Specialized Agents (Tier 4)
│   └── Escalation path for high-risk decisions
├── Compliance Agent (Tier 2, compliance domain)
│   └── Escalates directly to Owner for critical violations
└── Overseer (Tier 2, monitoring domain)
    └── Escalates directly to Owner for critical/high incidents
```

**Escalation rule:** When an agent cannot resolve a situation within its authority tier, it must escalate to the next tier and log the escalation. Agents must never silently fail or act speculatively on high-risk decisions.

---

## 3. Inter-Agent Communication Rules

### 3.1 — Message Format
All inter-agent messages must include:
```typescript
interface AgentMessage {
  fromAgent: string;      // agent ID
  toAgent: string;        // agent ID
  timestamp: number;      // Unix ms
  actionType: string;     // e.g., "ROUTE_WORK", "VALIDATE", "ESCALATE"
  payload: unknown;       // action-specific data
  traceId: string;        // correlation ID for audit trail
  requiresAck: boolean;   // whether receiver must acknowledge
}
```

### 3.2 — Authentication
All agent messages must be authenticated via service identity (JWT signed with agent private key or mTLS certificate). Unauthenticated messages must be rejected and logged.

### 3.3 — Allowed Communication Paths
| From | To | Allowed |
|---|---|---|
| Owner | Any | ✅ |
| AVA | ORION, VERA, Specialized, Compliance | ✅ |
| ORION | VERA, Specialized, System B, State BRIC (assigned) | ✅ |
| VERA | Audit log, Overseer | ✅ |
| Compliance Agent | Owner, Overseer, Audit log | ✅ |
| Overseer | Compliance Agent, Owner, Audit log | ✅ |
| Specialized Agent | ORION (reports), VERA (validation) | ✅ |
| State BRIC | Spine (policy read only) | ✅ |
| Public BRIC | Any | ❌ (public is output-only) |

### 3.4 — Response Time SLAs
- Critical incident escalations: ≤ 5 seconds (automated)
- Compliance gate checks: ≤ 200 ms (in-process)
- BRIC-to-BRIC RPC calls: ≤ 1 second
- Batch operations (billing runs, audit exports): best-effort, logged on completion

### 3.5 — Retry and Idempotency
- All agent-to-agent calls must be idempotent (carry a `traceId`).
- Failed calls must be retried with exponential backoff up to 3 times.
- Unresolved failures after retries must be escalated and logged.

---

## 4. Mandatory Logging and Auditing Requirements

### 4.1 — Minimum Audit Fields
Every logged event must include:
```typescript
interface AuditEvent {
  id: string;           // UUID
  timestamp: number;    // Unix ms
  actor: string;        // agent ID or user ID
  action: string;       // action type
  resource: string;     // resource type and ID
  beforeState?: string; // serialized before state
  afterState?: string;  // serialized after state
  result: 'success' | 'failure' | 'blocked';
  rationale?: string;   // policy engine rationale
  traceId: string;      // correlation ID
  systemVersion: string; // config/jgaVersion
}
```

### 4.2 — Required Logging Triggers
The following events **must** always produce an audit log entry:
- Payment created, updated, or status changed
- Contract signed or amended
- Project status changed (especially: `active`, `delivered`, `closed`)
- Deposit confirmed or reversed
- Compliance artifact created or revoked
- Compliance gate opened or closed
- Agent escalation
- User role change
- BRIC activation or deactivation
- Secret scan violation detected
- Stitch Brick integrity failure or heal

### 4.3 — Append-Only Guarantee
The audit log must be backed by an append-only store. The database must revoke `DELETE` and `UPDATE` privileges on audit tables for all service accounts. The Stitch Brick system replicates audit logs with the same consensus guarantees as financial records.

### 4.4 — Log Retention
Audit logs must be retained for a minimum of 7 years. State-specific retention rules (see SECTIONAL_LAWS.md § 1.1, § 1.2) may extend this period.

---

## 5. Deployment Notes

- Agents run as isolated services or as in-process modules with clear interface boundaries.
- Each agent must expose a health endpoint and a compliance-status endpoint.
- The Compliance Agent must start and produce a valid artifact before any other agent begins business operations.
- Agents must never read secrets from environment variables at agent init; use the lazy-init pattern (`lib/supabase-client.ts` pattern as reference).

---

*See also: SYSTEM_CONSTITUTION.md, SECTIONAL_LAWS.md, ARCHITECTURE_BRICKS_STITCH.md*
