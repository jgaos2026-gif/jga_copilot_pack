# BRICS Architecture — System Laws & Invariants

**Version:** 1.0  
**Last Updated:** 2026-03-20  
**Status:** Launch-ready (targeting April 27, 2026)

---

## Core System Laws (Enforceable Invariants)

These are non-negotiable architectural constraints, enforced at compile time, deployment time, and runtime.

### Law 1: Unidirectional Public Boundary
- **Public layer** (marketing website) is **read-only output** from approved sources.
- **Inbound sensitive data flows are blocked** at network and service layer.
- No authenticated administrative endpoints are reachable from the public internet.
- Enforcement: network ACLs, service-mesh policies, output validation firewall.

### Law 2: Spine (Strategy) Does Not Store Customer Data
- **Spine** contains AI logic, policy, agent constraints, and governance rules.
- Spine may **read** minimal customer context needed for decision-making, but only as sanitized summaries.
- Spine must **never** store or persist PII, financial records, NDAs, or project files.
- Spine data is **non-sensitive** and can be replicated to Owners Room for auditing.
- Enforcement: schema validation, data classification tags, DLP scanning, audit logging.

### Law 3: System B Does Not Store Bulk Sensitive Records Beyond Routing
- **System B** is the operational engine: onboarding, project flow, pricing, confirmations.
- System B may store a minimal " **assignment record**" (contractor ID → state BRIC, project metadata).
- System B must **never** ingest state-level sensitive data (customer NDAs, payment logs, project files).
- System B routes work to correct State BRIC, which owns and stores sensitive data.
- Enforcement: role-based databasepermissions, schema constraints, inter-service call validation.

### Law 4: State BRICs Are Fully Isolated and Key-Compartmented
- Each state BRIC operates independently within its boundary.
- State BRIC may serve multiple contractors assigned to that state, but data does not leave the state.
- Each state BRIC has **separate encryption keys** and **separate IAM principals**.
- Cross-state data flow is forbidden (architectural invariant).
- Enforcement: separate databases/KMS vaults per state, network routes, access control policies, automated scanning.

### Law 5: Owners Room Is Restricted, MFA-Protected, and Non-Bulk-Export
- **Owners Room** is a low-traffic control plane for lifecycle management and strategic oversight.
- Owners Room can **view read-only summaries** (health, audit logs, compliance status) but cannot bulk-export raw sensitive data.
- Activation of new state BRICs requires **dual-auth** (owner + compliance agent signature).
- Owners Room endpoints are **not indexed** and require **MFA** (hardware token or strong authenticator).
- Enforcement: VPN-gating, IP allowlist, MFA enforcement, credential management vault, session timeouts.

### Law 6: Compliance Gate Precedes Business-Calling Workflows
- Outbound sales calls, notifications, and contractual outreach are **disabled by default**.
- Business-calling workflows become active **only after** a signed Compliance OK artifact is present.
- Compliance Agent is the **first automation** to come online; all others wait.
- Enforcement: boolean flag gating, artifact signature verification, test suite validation.

### Law 7: Stitch Brick Integrity Is Mandatory on All State-Level Micro-Bricks
- Every micro-brick (customer record, project file, payment log, NDA) is:
  - **SHA-256 hashed** (content integrity),
  - **Append-only logged** (Merkle tree, tamper-evident),
  - **Replicated via consensus** (majority quorum, Raft/Paxos class),
  - **Periodically verified** (recompute hash, compare), and
  - **Auto-healed on mismatch** (checkpoint restore + log replay).
- Enforcement: immutable schema, Merkle commitment on every write, periodic verification jobs, quarantine+replace on persistent mismatch.

### Law 8: No Implicit Network Trust Between BRICs
- Every BRIC-to-BRIC call is **authenticated** (service identity) and **authorized** (explicit policy).
- Deny-by-default; allow-list only approved calls.
- Internal communication uses mTLS where possible; service mesh can enforce policies.
- Enforcement: mTLS sidecar proxies, IAM policy, call-site validation, audit logging.

---

## BRIC Boundary Contracts

 Each BRIC exposes a strict interface: allowed inputs, outputs, and side effects.

### Public Layer
**Input:** none (one-way publication only)  
**Output:** sanitized marketing content, public pricing, onboarding entrypoint  
**Side-effects:** none (read-only to published assets)  
**Dependencies:** none on other BRICs; may read published assets from content store

### Spine
**Input:** regulatory updates (official sources), AI risk telemetry (from Overseer)  
**Output:** policy artifacts, system laws, agent constraints  
**Side-effects:** none on customer data  
**Dependencies:** none on System B or State BRICs; may publish to Owners Room audit log

### System B
**Input:** lead contact info (from Public), contractor credentials (from onboarding)  
**Output:** assignment record (contractor → state), confirmation status, pricing summary  
**Side-effects:** routes work to State BRIC, logs assignment  
**Dependencies:** reads from Public (state list), reads from own schema, writes to State BRIC (RPC call)

### State BRIC (per-state)
**Input:** assignment (from System B), contractor calls  
**Output:** project deliverables, payment/escrow confirmation  
**Side-effects:** stores sensitive data (state-owned), replicates via Raft/consensus  
**Dependencies:** trusts Spine for policy artifact verification, depends on System B for work routing

### Owners Room
**Input:** admin actions (activate state, view logs)  
**Output:** read-only summaries (health, audit, compliance status)  
**Side-effects:** can trigger state activation (approval gate)  
**Dependencies:** reads Spine (policy), reads State BRICs (audit logs), reads Overseer (risk telemetry)

---

## Permission Matrix

| Role | Allowed Actions | Scope | BRIC Access | Network |
|---|---|---|---|---|
| Public (marketing) | Read published assets | Public layer only | Public | Internet-facing, CDN |
| Contractor | Create project, submit work | Assigned state scope | System B → State BRIC (assigned) | VPN-required, state-scoped |
| System B | Route work, log assignments | Cross-state coordination | System B, Spine (read), State BRIC (write via RPC) | Private network |
| State BRIC | Store/manage state data | Single state | State BRIC (own state) | Private network |
| Spine | Enforce policy, govern AI | System-wide | Spine, Overseer (write telemetry) | Private network |
| Owners Room | Lifecycle mgmt, emergency controls | System-wide | All BRICs (read), Spine (read), State BRIC (read/approve) | VPN + MFA |
| Overseer (governance) | Monitor, gate, escalate | System-wide | All BRICs (observe), Compliance Agent (notify) | Private network |
| Compliance Agent | Ingest regs, approve workflows | System-wide | Spine (read/write), business-call gate (write) | Offline initially, internet for reg sources only |

---

## Deployment Model: Cloud + On-Prem Hybrid

**Assumed topology** (verification required with infrastructure team):
- **Public layer:** CDN + managed edge (AWS CloudFront, Fastly, or similar).
- **Spine, System B, Owners Room:** private cloud / managed Kubernetes cluster (isolated network).
- **State BRICs:** dedicated database + replication cluster per state (StatefulSet on k8s or managed DBaaS with state-scoped accounts).
- **Compliance Agent:** initially offline; ingests regs via manual upload or secure batch API; output is signed artifact.
- **Overseer:** sidecar on all BRICs; observes logs and metrics; coordinates governance responses.

---

## Incident Response & Escalation

### Prompt Injection Detected
1. Overseer detects prompt in system logs (e.g., agent receives unexpected control sequences).
2. Escalates to Spine; Spine logs as "AI risk incident."
3. Compliance Agent is notified; business-call gate remains closed until reviewed.
4. Incident record is created (immutable audit log).

### Data Corruption Detected (Stitch Brick Mismatch)
1. State BRIC recomputes SHA-256; detects mismatch.
2. Logs as "integrity incident"; quarantines node.
3. Restores from last good checkpoint; replays log.
4. If restoration fails, node is marked for replacement (provision fresh image from secure supply chain).
5. Forensic image captured for post-mortem.
6. Owners Room is alerted; escalates if necessary.

### Credential Leak Detected
1. Secret scanner (e.g., TruffleHog) detects key in repository or logs.
2. Overseer creates incident ticket.
3. Affected credential is rotated immediately (via key vault).
4. Audit log shows timestamp and scope of exposure.
5. Owners Room triggers compliance review.

### Suspected AI Drift (Model Output Diverges from Policy)
1. Overseer compares agent actions to declared policy constraints.
2. If divergence exceeds threshold, escalates to Compliance Agent.
3. Compliance Agent runs impact assessment (required tests, legal review).
4. If risk is high, business-call gate is closed until remediated.
5. Incident record is frozen until resolution.

---

## Launch Readiness Checklist (Build to April 27, 2026)

- [ ] Public layer deployed; marketing-only content live.
- [ ] System B can ingest leads and route to state BRICs.
- [ ] At least one state BRIC fully operational (CA or TX recommended for scale).
- [ ] Owners Room accessible (VPN + MFA); activation gate functional.
- [ ] Compliance Agent online; signed "Compliance OK" artifact produces; business-call gate closed by default.
- [ ] Stitch brick integrity (SHA-256, Merkle log, consensus) passes load test (10k micro-bricks, 3-node cluster, 99.9% hash match rate).
- [ ] Corruption detection + auto-heal demo runs cleanly (corrupt 1 node → detect → restore → rejoin).
- [ ] Secret scanning automation active (pre-commit + CI/CD).
- [ ] Incident drills completed (prompt injection, data corruption, credential leak, drift).
- [ ] Rollback plan documented and tested.
- [ ] Launch runbook signed off by owner and legal counsel.

---

## References & Standards

- **NIST Digital Identity Framework** (for Owners Room MFA & authentication)
- **NIST AI RMF & Generative AI Profile** (for governance, monitoring, reliability)
- **NIST Key Management Guidance** (for per-state key compartmentalization)
- **OWASP Top 10 for LLM** (for prompt injection, insecure output, data poisoning prevention)
- **RFC 6962 - Certificate Transparency** (Merkle log design inspiration)
- **Raft Consensus Algorithm** (replicated state machine, leader election)
- **SSDF & Secure Supply Chain** (for secure build pipelines, trusted images)
- **ATLAS (Adversarial ML)** (for threat modeling)
