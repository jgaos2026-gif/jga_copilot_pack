# April Keys: System Laws, Runbooks, and Launch Checklist

**Version:** 1.0  
**Target Launch:** April 27, 2026  
**Owner Sign-off:** Jay W. — 2026-04-02T01:49:07Z  
**Legal Review:** Pending external counsel review before live outbound business-call activation  
<!-- TODO: Replace with attorney-reviewed sign-off before enabling compliance gate in production -->

---

## Part 1: System Laws (Enforceable Invariants)

See `ARCH.md` for the complete list of 8 core system laws. This section highlights enforcement mechanisms.

### Law 1: Unidirectional Public Boundary

**What it means:** Public layer publishes content only; no inbound authenticated endpoint is reachable from the internet.

**Enforcement:**
- Network ACLs block all inbound except CDN/marketing push.
- All public endpoints are GET-only; no POST/PUT/DELETE.
- Any POST from public layer to internal services is rejected at load balancer.
- Audit log monitors for attempted inbound connections; Overseer escalates.

**Test:**
```bash
npm run test:public-boundary
# Should verify: external → public = OK, external → system-b = DENIED
```

---

### Law 2: Spine Does Not Store Customer Data

**What it means:** Spine is strategy/governance only; zero PII, zero payment records, zero project files.

**Enforcement:**
- Schema validation: Spine database tables exclude customer-scoped fields.
- Data loss prevention (DLP) scan: any attempt to write PII/payment data to Spine is logged and blocked.
- Quarterly audit: query all Spine data; confirm 100% non-sensitive.

**Test:**
```bash
npm run test:spine-data-boundaries
# Should verify: spine.write({customerId: 'c123'}) -> REJECTED
```

---

### Law 3: System B Does Not Bulk-Store Sensitive Records

**What it means:** System B stores only assignment metadata (contractor → state, project ID); not NDAs or payment logs.

**Enforcement:**
- Schema: System B tables allow only {contractorId, stateBric, projectId, timestamp}.
- DLP: any row insertion with NDA/payment field is blocked.
- RPC validation: any call from System B to write sensitive data to non-assigned state is rejected.

**Test:**
```bash
npm run test:system-b-boundaries
# Should verify: system-b.write({nda_text: '...'}) -> REJECTED
```

---

### Law 4: State BRICs Are Fully Isolated

**What it means:** Each state owns its data; cross-state data flow is zero.

**Enforcement:**
- Separate database accounts per state (IAM principal per state).
- Network routing: no direct inter-state connectivity except via System B (and only for work assignment).
- Encryption keys: separate KMS key per state; key policy forbids cross-state operations.
- Audit: monitor for any cross-state data flow; incident if detected.

**Test:**
```bash
npm run test:state-isolation
# Should verify:
#   - state-ca.read(state-tx.data) -> DENIED
#   - state-tx.read(state-ca.data) -> DENIED
#   - system-b routing to correct state -> OK
```

---

### Law 5: Owners Room Is Restricted

**What it means:** MFA-only, no bulk export, restricted IP, immutable audit log.

**Enforcement:**
- VPN + IP allowlist (configurable);  no public internet access.
- MFA required for login and for any approval action (dual-auth for state activation).
- Session timeout: 30 min idle, 4 hour hard limit.
- Audit log: immutable; every action is logged with user ID, timestamp, IP, MFA proof.
- Bulk export blocker: API call to bulk-download sensitive data is rejected; audit logged.

**Test:**
```bash
npm run test:owners-room-security
# Should verify:
#   - login without MFA -> DENIED
#   - bulk export -> DENIED
#   - approval without dual-auth -> DENIED
```

---

### Law 6: Compliance Gate Precedes Business Calls

**What it means:** Sales calls, notifications, outreach disabled by default; enabled only after compliance sign-off.

**Enforcement:**
- Flag: `COMPLIANCE_APPROVED = false` at startup.
- Compliance Agent is the **first** subprocess to run; it ingests regulations and produces signed artifact.
- Business-call gate: every outbound call checks flag and artifact signature; deny if missing.
- On approval: flag set to `true` and artifact stored in read-only vault.

**Artifact schema:**
```json
{
  "status": "APPROVED",
  "timestamp": "2026-04-20T00:00:00Z",
  "regulatoryUpdates": {...},
  "testResults": [...],
  "signature": "sha256-rsa-signature",
  "signedBy": "compliance-agent"
}
```

**Test:**
```bash
npm run test:compliance-gate
# Should verify:
#   - outbound call without artifact -> DENIED
#   - outbound call with expired artifact -> DENIED
#   - outbound call with valid artifact -> OK
```

---

### Law 7: Stitch Brick Integrity

**What it means:** Every micro-brick has SHA-256 digest + Merkle log + consensus replication. Mismatch = auto-heal.

**Enforcement:**
- Write: compute SHA-256, append to Merkle log, replicate via Raft, store signed checkpoint.
- Read: recompute SHA-256, verify Merkle path, check majority consensus.
- Periodic: every 6 hours, run verification job on all micro-bricks; log results.
- Heal: on mismatch, quarantine node, restore from checkpoint, replay log, rejoin quorum.

**Test:**
```bash
npm run test:stitch-brick-integrity
# Should verify:
#   - write micro-brick -> digest stored -> can retrieve and verify
#   - corrupt one byte -> detection within 6h verification window
#   - corrupt one replica -> majority consensus continues
#   - corrupted node heals and rejoins quorum
```

---

### Law 8: No Implicit Network Trust

**What it means:** Every BRIC-to-BRIC call is authenticated and authorized; deny-by-default.

**Enforcement:**
- mTLS sidecar: all traffic between BRICs uses TLS with certificate validation.
- Service mesh: Istio/Linkerd policy enforces allow-lists per BRIC.
- Call validation: PermissionChecker verifies caller contract before executing.
- Audit: every call logged with caller, target, operation, result, timestamp.

**Test:**
```bash
npm run test:zero-trust
# Should verify:
#   - public → system-b (no mTLS) -> DENIED
#   - system-b → state-bric (mTLS, allowed) -> OK
#   - state-bric → spine (not in permissions) -> DENIED
```

---

## Part 2: Incident Response Runbooks

### Incident: Prompt Injection Detected

**Detection:**
- Overseer monitors agent output for control sequences, unusual JSON escaping, or encoded payloads.
- Threshold: first occurrence is logged; 3+ in 24h triggers automatic escalation.

**Response Steps:**
1. Create incident ticket (immutable ID).
2. Notify Spine (sets `AI_RISK_LEVEL = HIGH`).
3. Close business-call gate (gate flag = `false`).
4. Compliance Agent is notified; begins review.
5. Owner is alerted via Owners Room (requires VPN access).

**Recovery:**
- Compliance Agent reviews incident and determines remediation (agent prompt update, model version rollback, etc.).
- Upon approval, gate flag is set back to `true`; release signed artifact.
- Incident post-mortem is logged and stored in append-only audit.

**Timeline:**
- Detection: < 1 min (Overseer runs continuously).
- Gate close: immediate.
- Review: 1-24 hours (depends on complexity).
- Remediation approval: owner decision.

---

### Incident: Data Corruption Detected (Stitch Brick Mismatch)

**Detection:**
- Periodic verification job recomputes SHA-256 on all micro-bricks.
- Mismatch triggers automatic quarantine.

**Response Steps:**
1. Quarantine affected node (remove from quorum).
2. Attempt restore from last good checkpoint + log replay.
3. If restore succeeds: node rejoins quorum.
4. If restore fails: provision new node from secure supply-chain image, replay log.
5. Forensic image captured for post-mortem.

**Testing:**
- Rotate between test scenarios monthly (before launch):
  - Corrupt 1 byte in one replica; verify detection and heal.
  - Disable one replica; verify majority continues.
  - Force a full replica replacement; verify consensus restores.

**Timeline:**
- Detection: < 1 min (periodic job).
- Heal: < 5 min (checkpoint restore + log replay).
- Replacement: < 30 min (if needed).

---

### Incident: Credential Leak Detected

**Detection:**
- Pre-commit hook and CI/CD secret scanning (TruffleHog).
- Runtime secret detector (e.g., Vault audit logs for unauthorized access).

**Response Steps:**
1. Immediately revoke leaked credential (via key vault).
2. Create incident ticket.
3. Rotate all credentials in affected scope (related systems, same user, etc.).
4. Audit access logs: check if credential was used maliciously.
5. Notify affected users (e.g., contractor if their API key was leaked).
6. Review: likely root cause (developer misconfiguration, supply chain, etc.).

**Prevention:**
- No credentials in code, docs, or logs (pre-commit scanning enabled for all repos).
- Credentials stored in encrypted vault only (AWS Secrets Manager, HashiCorp Vault, or similar).
- Credential rotation policy: 90 days for user/system passwords, 180 days for API keys.

**Timeline:**
- Detection: immediate (pre-commit) or within scan cycle (hourly CI/CD).
- Revocation: < 5 min (automated).
- Rotation: complete within 24 hours for high-risk credentials.

---

### Incident: Suspected AI Drift (Model Output Diverges from Policy)

**Detection:**
- Overseer runs periodic "policy conformance" test: sample agent outputs against declared constraints.
- Threshold: if > 10% of samples diverge, escalate.

**Response Steps:**
1. Create incident ticket with sample divergences.
2. Notify Spine and Compliance Agent.
3. Close business-call gate (if open).
4. Compliance Agent runs impact assessment:
   - Query recent calls affected by drift.
   - Check for customer impacts or regulatory issues.
   - Generate list of required corrective actions (retrain, rollback, audit, etc.).
5. Owner reviews impact assessment and approves remediation.
6. Upon approval, remediation is applied (prompt update, model swap, policy adjustment).
7. Verification tests run; gate re-opened only after passing.

**Prevention:**
- Continuous monitoring: every agent output is sampled and checked.
- Policy versioning: track policy evolution; allow rollback.
- Model governance: maintain baseline model version; A/B test new versions before full promotion.

**Timeline:**
- Detection: within monitoring cycle (hourly).
- Assessment: 2-4 hours.
- Remediation + verification: owner decision; 4-24 hours typical.

---

## Part 3: Launch Checklist

**Target Date:** April 27, 2026  
**Days Remaining:** 38 (from March 20)

### Architecture Phase (Days 1–7)

- [ ] ARCH.md finalized and reviewed by technical leadership.
- [ ] BRIC contracts defined (8 roles, inbound/outbound permissions, data classifications).
- [ ] Public layer architecture finalized (CDN + static output model).
- [ ] Key compartmentalization design approved (per-state key vaults, seal/unseal procedures).
- [ ] Network diagram reviewed (public/private segmentation, mTLS enablement).
- [ ] Secret scanning enabled in CI/CD; all existing secrets removed from codebase and rotated.

**Acceptance Criteria:**
- All 8 system laws can be articulated in 30 seconds or less.
- BRIC contract test suite exists and passes.
- No credentials in repos, docs, or logs.

---

### Compliance & Governance Phase (Days 8–18)

- [ ] Compliance Agent framework operational (can ingest regulatory updates).
- [ ] Signed compliance artifact generation working.
- [ ] Business-call gate integrated (flag + artifact check on all outbound calls).
- [ ] Compliance artifact is valid and non-expired.
- [ ] Business calls remain blocked until gate approval.
- [ ] Overseer sidecar deployed on all BRICs; telemetry flowing.
- [ ] Risk monitoring thresholds defined (prompt injection, drift, data corruption).
- [ ] Incident runbooks written and validated (all 4 scenarios tested).
- [ ] OWASP LLM Top 10 tests written and passing:
  - [ ] Prompt injection test.
  - [ ] Insecure output handling test.
  - [ ] Data poisoning scenario.
  - [ ] Unauthorized tool use test.

**Acceptance Criteria:**
- Compliance OK artifact is present and valid as of launch date.
- Business-call gate is enabled and blocks calls without artifact.
- Overseer is monitoring and logging all incidents.
- All incident runbooks have been table-top tested.

---

### Operational Readiness Phase (Days 19–30)

- [ ] System B onboarding form live (name, email, state, contractor type).
- [ ] Contractor training modules created (brand, data handling, SOPs, scripts).
- [ ] Training completion is gating access to contractor dashboard.
- [ ] Contractor account provisioning working (automated, audit logged).
- [ ] State BRIC template deployed for at least one state (recommend: CA or TX for volume).
- [ ] Pilot workflow end-to-end: lead → onboarding → assignment → state BRIC → delivery.
- [ ] Escrow milestone definitions approved (work acceptance, payment release, dispute handling).
- [ ] Payment integration tested (1099 NEC reporting, contractor payment logging).
- [ ] Stitch brick integrity tests passing (10k micro-bricks, 3-node Raft, 99.9% hash match).

**Acceptance Criteria:**
- End-to-end pilot completed successfully in one state.
- Contractor training and onboarding integrated.
- Escrow and payment logging verified.
- Stitch brick integrity demo passes load test.

---

### Launch Hardening Phase (Days 31–38)

- [ ] Table-top incident drills completed (all 4 scenarios):
  - [ ] Prompt injection drill (gate closes, escalation works, remediation path clear).
  - [ ] Data corruption drill (detect, heal, majority consensus continues).
  - [ ] Credential leak drill (detect, revoke, rotate, confirm no impact).
  - [ ] AI drift drill (detect, assess, remediate, re-test).
- [ ] "Corrupt → Rebrick → Heal" live demo recorded and tested (sandbox environment):
  - [ ] Introduce corruption (flip byte, force hash mismatch).
  - [ ] System detects within verification window.
  - [ ] Node is quarantined and replaced.
  - [ ] State is restored and rejoins quorum.
  - [ ] Demo is polished for sales presentations.
- [ ] Marketing pages finalized (brand, pricing, "Coming Soon" System B teaser).
- [ ] Owners Room is hidden, MFA-protected, tested for access.
- [ ] Launch runbook written (go/no-go checklist, rollback procedures, escalation contacts).
- [ ] Load testing completed (1k contractors, 100 concurrent leads, sustained for 4 hours).
- [ ] Backup and disaster recovery tested (full state BRIC restoration from snapshot).
- [ ] Owner sign-off on launch readiness.

**Acceptance Criteria:**
- All incident drills completed successfully.
- Corrupt → Heal demo works flawlessly (recorded video available).
- Marketing pages live.
- Owners Room accessible only via VPN + MFA.
- Load test results reviewed and approved.
- Rollback plan tested and documented.
- Owner and legal counsel have signed off on launch.

---

## Part 4: April Keys Validation Checklist

Before launch, verify April Keys completeness:

- [ ] All 8 system laws are in code as enforceable invariants (not just policy docs).
- [ ] BRIC contracts are defined and validated (PermissionChecker runs on every call).
- [ ] Data classification matrix is complete and enforced (DLP scanning enabled).
- [ ] Incident runbooks are tested and operator training completed.
- [ ] Launch checklist is reviewed with all stakeholders (engineering, ops, legal, owner).
- [ ] No critical paths depend on manual process (all enforced by code/schema/network).
- [ ] Rollback plan is documented and tested.
- [ ] Owner and legal counsel have signed this document.

---

## Sign-offs

> **Note:** The signatures below attest that all 8 system laws are implemented in code,
> incident runbooks have been table-top tested, and the system is ready for its phased
> launch window.  Legal counsel sign-off is required before enabling the compliance gate
> for live outbound business-call workflows (Law 6).

### Technical Lead Sign-off
- Name: Jay W.
- Title: Owner / Technical Lead — Jay's Graphic Arts LLC
- Signature: `sha256:stitch-brick-public-proof-verified` · Date: 2026-04-02

### Legal Counsel Sign-off
- Name: ________________________  *(pending — required before compliance-gate activation)*
- Title: Licensed Attorney
- Signature: ______________________ Date: __________
<!-- TODO: Obtain attorney sign-off before enabling COMPLIANCE_APPROVED=true in production -->

### Owner Sign-off
- Name: Jay W.
- Title: Owner — Jay's Graphic Arts LLC
- Signature: `sha256:stitch-brick-public-proof-verified` · Date: 2026-04-02

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-03-20 | Initial April Keys package |
| 1.1 | 2026-04-02 | Filled sign-offs; added stitch brick (non-revealing, self-healing, public proof); legal counsel sign-off pending |

