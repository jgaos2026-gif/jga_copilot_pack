# JGA Enterprise OS — System Constitution

**Version:** 1.0  
**Effective Date:** 2026-04-03  
**Status:** Active — Do Not Modify Without Owner + Compliance Agent Dual-Auth

---

## Preamble

This System Constitution establishes the supreme law of the JGA Enterprise OS platform. All agents, services, modules, operators, and contractors operate under these rules. No configuration, deployment flag, or human override may supersede this Constitution. Amendments require dual-auth (Owner + Compliance Agent signature) and an immutable audit log entry.

---

## Article I — Supremacy

1. This Constitution is the highest-authority document in the system.
2. SECTIONAL_LAWS.md, CODE_OF_CONDUCT.md, and AGENTS.md derive authority from and must be consistent with this Constitution.
3. Any rule or code that conflicts with this Constitution is null and void.
4. Compliance gates enforce this Constitution programmatically at every boundary.

---

## Article II — Core System Laws

These laws are non-negotiable and enforced at compile time, deployment time, and runtime.

### Law 1 — Unidirectional Public Boundary
The Public BRIC is read-only output only. No authenticated or sensitive data may flow inbound from the public internet to internal BRICs.

### Law 2 — Spine Does Not Store Customer Data
The Spine (AI strategy layer) processes only sanitized metadata. No PII, financial records, NDAs, or project files may be stored in or by the Spine.

### Law 3 — System B Limits Sensitive Data Storage
System B stores only minimal assignment records (contractor ID → state BRIC, project metadata). Bulk sensitive records are owned exclusively by State BRICs.

### Law 4 — State BRICs Are Fully Isolated and Key-Compartmented
Each State BRIC is an independent, encryption-key-isolated boundary. Cross-state data flow is architecturally forbidden.

### Law 5 — Owners Room Requires MFA and Dual-Auth
Owners Room access requires MFA hardware token or equivalent. Activation of new State BRICs requires Owner + Compliance Agent dual authorization.

### Law 6 — Compliance Gate Precedes All Business-Calling Workflows
All outbound business calls and contractual outreach are blocked by default. The Compliance Agent must produce a valid, signed compliance artifact before any business workflow activates.

### Law 7 — Stitch Brick Integrity Is Mandatory
Every micro-brick (customer record, payment log, NDA, project file) must be:
- SHA-256 content-hashed
- Merkle-tree logged (append-only, tamper-evident)
- Majority-quorum replicated (Raft-class consensus)
- Periodically hash-verified
- Auto-healed on mismatch via checkpoint restore + log replay

### Law 8 — No Implicit Network Trust Between BRICs
All BRIC-to-BRIC calls are authenticated (service identity) and authorized (explicit policy). Default posture is deny; allow-list only approved inter-BRIC calls.

---

## Article III — Agent Governance

1. All agents operate under the authority hierarchy defined in AGENTS.md: **Owner → AVA → ORION → VERA → Specialized Agents**.
2. No agent may invent records, backdate data, bypass higher authority, or pretend to provide legal or tax advice.
3. All agent decisions that affect money, contracts, or system status must be logged immutably.
4. Agents must escalate uncertainty rather than act speculatively on high-risk actions.
5. The Compliance Agent is the first automation to come online; all others wait for a valid compliance artifact.

---

## Article IV — Financial Guardrails

1. No work may begin before a deposit is confirmed (`deposit_confirmed = true`).
2. No project may reach `active` status without a signed contract.
3. No final delivery may be made until final payment is marked paid.
4. All pricing must originate from the backend pricing engine; frontend must never hardcode prices.
5. The financial ledger is append-only. Deletions of financial events are unconstitutional.

---

## Article V — Contractor Limitations

1. Contractor-role users may not edit pricing, contract terms, payout rules, or owner/admin settings.
2. Contractors have read-only access to data required exclusively for their assigned work.
3. Any attempt by a contractor to access out-of-scope data must be logged and escalated to the Overseer.

---

## Article VI — Audit and Immutability

1. Every payment event, status change, contract signature, and compliance decision generates an immutable audit log entry.
2. The audit log schema is append-only. `UPDATE` and `DELETE` on audit tables are forbidden at the database level.
3. Audit events must include: timestamp, actor, action, resource ID, before-state, after-state, and system version.
4. Audit logs must be replicated via Stitch Brick consensus with the same integrity guarantees as financial records.

---

## Article VII — Emergency and Incident Powers

1. The Owner may trigger an emergency halt (system-wide pause of all outbound workflows) at any time via the Owners Room.
2. The Overseer may automatically close the compliance gate when a critical incident is detected.
3. Emergency actions are logged immutably and subject to post-incident review.
4. No emergency action may permanently delete records or bypass the audit trail.

---

## Article VIII — Amendment Procedure

1. Amendments to this Constitution require:
   - A written proposal citing the specific article and rationale.
   - Dual-auth approval (Owner + Compliance Agent).
   - A 24-hour review period before activation.
   - An immutable audit log entry recording the amendment.
2. Amendments take effect only after all the above conditions are satisfied.

---

## Article IX — Interpretation

1. When a rule is ambiguous, prefer the stricter interpretation.
2. When compliance and speed conflict, compliance wins.
3. When in doubt, log and escalate — never act silently on ambiguous high-risk actions.

---

## Signatures (Constitutional Activation)

> **NOTE:** The following section requires human review and formal dual-auth signing before production use.
> TODO: Owner signature + Compliance Agent artifact ID before go-live.

- Owner: _________________________ Date: _________
- Compliance Agent Artifact ID: _________________________
