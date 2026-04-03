# Compliance Law — JGA Enterprise OS Sectional Law

> Jurisdiction: US-FED (baseline) + per-state overrides via stateTag
> Version: 1.0 | Effective: 2024-01-01
> **ATTORNEY REVIEW REQUIRED before relying on any system-generated compliance determination for legal purposes.**

---

## Section 1 — Compliance Posture

**1.1** JGA Enterprise OS must maintain a continuous compliance posture. This means all business rules, financial flows, and agent behaviors are checked against this Constitution and the applicable sectional laws at all times.

**1.2** The Compliance Agent (or CFO Agent acting as compliance authority) is responsible for real-time compliance monitoring.

**1.3** A compliance violation is any action that:
- Contradicts this Constitution or a sectional law
- Takes an irreversible financial action above $500 without approval
- Deletes or mutates an immutable record
- Bypasses a required gate (deposit, contract, final payment)
- Is performed by an agent without proper authority for its tier

---

## Section 2 — Violation Handling

**2.1** All compliance violations must be:
1. Blocked (action refused before execution where possible)
2. Logged immediately in the audit trail as a `compliance_violation` event
3. Escalated to the Owner and Admin AI

**2.2** Violations are categorized by severity:

| Severity | Description | Response Time |
|---|---|---|
| **Critical** | Financial action blocked, legal exposure possible | Immediate (real-time alert) |
| **High** | Gate bypass attempted, record mutation attempted | Within 1 hour |
| **Medium** | Unauthorized access attempt, role boundary exceeded | Within 24 hours |
| **Low** | Missing metadata, incomplete log fields | Weekly report |

**2.3** Critical and High violations trigger an Owner notification via all configured channels.

---

## Section 3 — Jurisdiction Management

**3.1** Every record, transaction, and agent action must carry a `stateTag` indicating the applicable jurisdiction.

**3.2** The `stateTag` format is `[STATE_CODE]-[DISTRICT]` for state-level (e.g., `IL-01`, `TX-44`) or `US-FED` for federal.

**3.3** When an action spans multiple jurisdictions, the stricter rule applies.

**3.4** Adding a new jurisdiction requires:
1. Owner authorization
2. A new or updated `PolicyBrick` for the `stateTag`
3. Legal review of applicable state laws **(ATTORNEY REVIEW REQUIRED)**
4. CPA review of applicable state tax obligations **(CPA REVIEW REQUIRED)**

---

## Section 4 — Regulatory Reporting

**4.1** The system must surface reminders for all recurring regulatory filing obligations based on the active `stateTag` set.

**4.2** Federal obligations include (non-exhaustive): quarterly estimated taxes, annual 1099-NEC filings, FUTA deposits.

> // TODO: CPA REVIEW REQUIRED — Confirm full list of federal and state filing obligations and deadlines for Jay's Graphic Arts LLC.

**4.3** Regulatory filing reminders must appear in the Owner dashboard at least 30 days before each deadline.

**4.4** Completed filings must be logged as `ComplianceBrick` events with the filing date, period covered, and confirmation number.

---

## Section 5 — Annual Compliance Review

**5.1** All sectional laws and the Constitution must be reviewed annually by the Owner, with attorney and CPA participation.

**5.2** The review must result in a versioned update to any laws that require change, with changes logged as new `PolicyBrick` or `ComplianceBrick` versions.

**5.3** The annual review date and outcome must be logged in the audit trail.

> **ATTORNEY REVIEW REQUIRED** — Annual legal review of all operational policies is strongly recommended. This system's rules do not substitute for qualified legal counsel.

> **CPA REVIEW REQUIRED** — Annual tax and financial compliance review is mandatory. This system does not provide tax or accounting advice.
