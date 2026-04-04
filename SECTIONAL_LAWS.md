# JGA Enterprise OS — Sectional Laws

**Version:** 1.0  
**Effective Date:** 2026-04-03  
**Authority:** Derives from SYSTEM_CONSTITUTION.md Articles II–VI  
**Status:** Active

---

## Preamble

Sectional Laws provide state-specific and functional-domain-specific rules that extend and specialize the System Constitution for particular jurisdictions, modules, or operational contexts. Sectional Laws must never contradict the Constitution; where conflict exists, the Constitution prevails.

---

## Section 1 — State-Specific Compliance Rules

### § 1.1 — Illinois (State Tag: IL-01)
- Projects in Illinois must comply with IL BIPA (Biometric Information Privacy Act) for any biometric data collection.
- Payment processing in Illinois must retain records for 5 years minimum.
- Any contractor operating in the IL-01 brick must acknowledge BIPA requirements at onboarding.
- TODO: CPA/attorney review required before live IL-01 operations.

### § 1.2 — Texas (State Tag: TX-44)
- Texas projects must display Spanish-language service availability notices where required by local law.
- Contractor agreements in Texas must include state-specific non-compete limitations per TX law.
- Payment records in TX-44 must be retained for 4 years minimum.
- TODO: CPA/attorney review required before live TX-44 operations.

### § 1.3 — Default Rule (All States)
- Where a state-specific law is not listed, the most conservative national standard applies.
- Any new state BRIC activation requires the Compliance Agent to produce a state-specific compliance artifact before operations begin.

---

## Section 2 — Financial Law

### § 2.1 — Deposit Before Work
No production work may begin on any project until a deposit has been confirmed in the payment ledger (`deposit_confirmed = true`). Violation of this rule is a compliance incident.

### § 2.2 — Contract Before Active Status
A project may not transition to `active` status until a signed contract is recorded (`contract_signed = true`). The system must enforce this as a hard gate, not a warning.

### § 2.3 — Final Payment Before Delivery
Final deliverables may not be released until the remaining balance is marked paid (`final_payment_cleared = true`). This is enforced at the delivery API gate.

### § 2.4 — Pricing Authority
All prices displayed or quoted in the system must originate from the server-side pricing engine. Frontend clients must call the pricing API; hardcoded prices are a compliance violation.

### § 2.5 — Ledger Immutability
Financial ledger entries are permanent. No `DELETE` or `UPDATE` is permitted on `event_ledger` or `transactions` tables. Corrections are made by appending a compensating entry with a `corrects_id` reference.

### § 2.6 — Audit Log on Every Financial Event
Every payment, refund, discount, chargeback, or ledger adjustment must generate an immutable audit log entry containing: timestamp, actor, action, amount, currency, resource ID, before-state, after-state.

---

## Section 3 — Contract Law

### § 3.1 — Contract Integrity
Signed contracts are stored as immutable records. Any amendment requires a new version with an appended change log; the original version is never overwritten.

### § 3.2 — Contractor Authority Limits
Contractor users may not modify contract terms, pricing schedules, payout rules, or any owner/admin-level settings. Attempts to do so are logged and escalated.

### § 3.3 — Client Consent
Client consent to terms of service and project terms must be captured as a signed event before any billing occurs.

---

## Section 4 — Data Governance Law

### § 4.1 — PII Handling
All PII (names, email addresses, phone numbers, payment information) must be encrypted at rest using state-BRIC-specific encryption keys. PII must never appear in plain text in log files, system output, or agent messages.

### § 4.2 — Data Residency
Customer data must reside in its assigned State BRIC. Cross-state data transfer is prohibited except for anonymized/aggregated reports requested by the Owner through the Owners Room.

### § 4.3 — Right to Deletion (Request Handling)
Customer deletion requests must be routed to the Owner for review. Deletion of financial records is subject to legal retention requirements; a TODO flag must be raised for attorney review. PII in non-legally-required records may be pseudonymized upon owner approval.

### § 4.4 — Stitch Brick Requirements
Every sensitive record (customer, project, payment, NDA) must implement Stitch Brick integrity: SHA-256 hash, Merkle log, consensus replication, periodic verification, and auto-heal on mismatch.

---

## Section 5 — Agent and Automation Law

### § 5.1 — Agent Authority Tiers
- **Owner:** Supreme authority. May override any agent.
- **AVA (Executive AI):** Coordinates all top-level AI operations. Reports to Owner.
- **ORION (Operations AI):** Manages operational workflows. Reports to AVA.
- **VERA (Verification AI):** Validates data and compliance. Reports to ORION.
- **Specialized Agents:** Domain-specific; report to the agent directly above them in the chain.

### § 5.2 — Agent Action Logging
Every agent action that mutates data, triggers a workflow, or makes a financial or compliance decision must be logged with: agent ID, action type, timestamp, resource affected, rationale.

### § 5.3 — No Silent Failures
Agents must not silently swallow errors on high-risk operations. All failures on payment, contract, compliance, or delivery flows must be logged and escalated.

### § 5.4 — Pause Before Risk
When an agent encounters ambiguity on a high-risk action (involving money, legal standing, or data deletion), it must pause and surface the decision to the next authority in the chain rather than proceeding autonomously.

---

## Section 6 — Security Law

### § 6.1 — Zero Secrets in Source Code
No secret, credential, API key, password, or private key may be committed to source control. All secrets must be provided via environment variables sourced from `.env` (never committed) or a secrets manager.

### § 6.2 — Secret Scanning
The CI pipeline must run a secret scanner on every push. Any detected secret causes an immediate build failure and incident escalation.

### § 6.3 — mTLS for Inter-BRIC Communication
All service-to-service calls between BRICs must use mutual TLS (mTLS) in production environments. Development may use signed JWTs as an approved alternative with documented deviation.

### § 6.4 — Dependency Vulnerability Scanning
A dependency vulnerability scan (e.g., `npm audit`) must pass before any deployment. Critical and high-severity findings block the build.

---

## Section 7 — Governance and Amendment

### § 7.1 — Sectional Law Amendment
Amendments to Sectional Laws require:
1. A written proposal citing the section and rationale.
2. Owner approval.
3. An immutable audit log entry.
4. A 24-hour review period.

### § 7.2 — Attorney/CPA Review Markers
Any section or rule that touches tax treatment, legal liability, jurisdiction-specific regulations, or client rights must carry a `TODO: attorney/CPA review required` marker. The system must surface these notices in the Owners Room.

### § 7.3 — Conflict Resolution
Where a Sectional Law conflicts with the System Constitution, the Constitution prevails. Where two Sectional Laws conflict, the stricter rule applies until Owner arbitration produces an amendment.

---

*End of Sectional Laws v1.0*
