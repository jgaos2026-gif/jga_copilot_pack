# Billing Law — JGA Enterprise OS Sectional Law

> Jurisdiction: US-FED (baseline) + per-state overrides via stateTag
> Version: 1.0 | Effective: 2024-01-01
> **ATTORNEY REVIEW REQUIRED before activating billing for any new state jurisdiction.**

---

## Section 1 — Invoice Generation

**1.1** An invoice may only be generated after a project exists in the system with a valid `projectId` and at least `intake` status.

**1.2** All invoices must include:
- Unique invoice number (system-generated, sequential, non-reusable)
- Client legal name and billing address
- Jay's Graphic Arts LLC name, address, and EIN
- Itemised list of services with unit price and quantity
- Applied tax rate and jurisdiction (`stateTag`)
- Payment due date
- Accepted payment methods
- Outstanding balance

**1.3** Invoices must not be edited after delivery. If a correction is required, a credit memo or revised invoice must be issued and both documents retained.

**1.4** Invoice amounts must be derived from the pricing engine. Hardcoded or manually entered prices are prohibited.

---

## Section 2 — Deposit Requirements

**2.1** A deposit is required before any production work begins. The minimum deposit amount is defined in the active `PolicyBrick` for the applicable jurisdiction.

**2.2** Production may not begin until the deposit payment is confirmed in the ledger with status `cleared`.

**2.3** Deposit amounts are non-refundable unless otherwise specified in the signed contract. **(ATTORNEY REVIEW REQUIRED: confirm enforceability of deposit non-refund clause by state.)**

---

## Section 3 — Final Payment and Delivery

**3.1** Final delivery of any project asset is blocked until the final payment is recorded in the ledger as `cleared`.

**3.2** The system must enforce this rule at the API and UI layer. No manual override is permitted without an Owner-level approval logged in the audit trail.

**3.3** Partial payments must be tracked individually in the ledger. A running balance must be maintained per project.

---

## Section 4 — Late Fees and Collections

**4.1** Late fees may only be applied if they are specified in the signed contract for the project. **(ATTORNEY REVIEW REQUIRED: confirm late fee cap by state — some states limit late fees.)**

**4.2** Late fee calculation must use the rate and grace period defined in the contract, not a system default.

**4.3** Any account sent to collections must be flagged in the system with `collectionStatus: true` and frozen from new invoicing until resolved.

---

## Section 5 — Taxes

**5.1** Applicable sales tax must be calculated at invoice generation time using the jurisdiction's current rate. **(CPA REVIEW REQUIRED: confirm taxability of graphic arts services by state before invoicing.)**

**5.2** Tax rates are stored in the `PolicyBrick` for each `stateTag` and must be updated when rates change.

**5.3** Tax-exempt clients must provide a valid exemption certificate before tax is waived. The certificate must be stored as an attachment on the client record.

**5.4** The system does not provide tax advice. All tax-related outputs are for billing record purposes only. **(CPA REVIEW REQUIRED.)**
