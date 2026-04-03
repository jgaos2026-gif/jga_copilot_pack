# Records Law — JGA Enterprise OS Sectional Law

> Jurisdiction: US-FED (baseline) + per-state overrides via stateTag
> Version: 1.0 | Effective: 2024-01-01
> **ATTORNEY REVIEW REQUIRED before determining final retention schedules for any record category.**

---

## Section 1 — Immutability Principle

**1.1** All records in JGA Enterprise OS are permanent. Hard deletion of any record is prohibited.

**1.2** Records are updated by appending a new versioned entry. Every prior version is preserved and queryable.

**1.3** The `version` field on every record is an integer that increments with each update. Version 1 is the original. No version may be skipped or overwritten.

**1.4** Soft lifecycle transitions (`archived`, `suspended`) are permitted and do not violate this law. The record remains queryable.

---

## Section 2 — Record Categories and Retention

The following minimum retention periods apply. All periods begin from the date of the most recent activity on the record.

| Category | Minimum Retention | Notes |
|---|---|---|
| Financial records (invoices, payments, ledger events) | 7 years | **(CPA REVIEW REQUIRED: confirm IRS and state requirements)** |
| Contracts and change orders | 7 years after expiry | **(ATTORNEY REVIEW REQUIRED: confirm by state)** |
| Client records | 7 years after last project | |
| Contractor records | 7 years after last payment | |
| Audit / event logs | 7 years | |
| Payroll records | 4 years (federal), up to 7 years (state) | **(CPA REVIEW REQUIRED)** |
| Compliance health reports | 7 years | |
| Dispute records | 7 years after resolution | |

> **ATTORNEY REVIEW REQUIRED** — Retention schedules vary by state and record type. The above are conservative defaults. A licensed attorney must confirm these periods for each jurisdiction in which JGA LLC operates.

---

## Section 3 — Access Control for Records

**3.1** Records are accessible only to roles with explicit permission defined in the row-level security policy.

**3.2** Contractors may only access records directly associated with their assigned projects.

**3.3** Financial records above their direct work scope are not accessible to contractors.

**3.4** All record access events are logged in the audit trail.

---

## Section 4 — Data Integrity

**4.1** All records must include a checksum or hash of their content at time of creation. The system must alert if a record's stored hash does not match its current content.

**4.2** Database backups must be encrypted at rest and in transit.

**4.3** Backup restoration procedures must be tested at least annually. Test results must be logged.

---

## Section 5 — Legal Holds

**5.1** Records subject to litigation, regulatory inquiry, or dispute must be placed under a legal hold that prevents lifecycle transitions and ensures retrieval.

**5.2** A legal hold is applied by the Owner or Admin AI and logged with: `holdId`, `appliedBy`, `appliedAt`, `reason`, and `affectedRecordIds`.

**5.3** Legal holds are lifted only by the Owner with an explicit release log entry.

> **ATTORNEY REVIEW REQUIRED** — Legal hold procedures must be reviewed by counsel to ensure compliance with applicable civil procedure rules and regulatory requirements.
