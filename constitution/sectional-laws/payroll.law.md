# Payroll Law — JGA Enterprise OS Sectional Law

> Jurisdiction: US-FED (baseline) + per-state overrides via stateTag
> Version: 1.0 | Effective: 2024-01-01

> // TODO: CPA REVIEW REQUIRED — All payroll rules in this document must be reviewed by a licensed CPA before activation in any jurisdiction.
> // TODO: ATTORNEY REVIEW REQUIRED — Employment classification (employee vs. independent contractor) determinations must be reviewed by an attorney familiar with applicable state and federal law.

---

## Section 1 — Worker Classification

**1.1** Every worker paid through JGA Enterprise OS must be classified as either an **employee** or an **independent contractor** before any payment is issued.

**1.2** Classification is stored on the worker record with the classifying authority's ID, date, and applicable test applied (e.g., IRS common-law test, ABC test).

**1.3** Misclassification is a federal and state compliance violation. The system will not allow payroll processing if `workerClassification` is absent or `unclassified`.

> // TODO: CPA REVIEW REQUIRED — Review IRS 20-factor test and applicable state ABC test compliance for each worker before classification is finalized.

---

## Section 2 — Contractor Payments (1099)

**2.1** Contractors are paid per the agreed rate in their signed contract. No payment may exceed the contracted rate without a signed change order.

**2.2** Payments to a single contractor totalling **$600 or more in a calendar year** require a Form 1099-NEC to be issued by January 31 of the following year. The system must track cumulative payments per contractor per tax year.

> // TODO: CPA REVIEW REQUIRED — Confirm 1099-NEC threshold and filing deadlines for each tax year. Threshold and rules are subject to IRS change.

**2.3** The system must prompt the Owner when a contractor's cumulative annual payments approach $550 (warning threshold).

**2.4** Contractor payments are processed only after the associated project milestone or deliverable is marked complete by an authorized staff member.

**2.5** All contractor payment records must be retained for a minimum of 4 years from the payment date.

> // TODO: CPA REVIEW REQUIRED — Confirm retention period aligns with IRS audit statute of limitations and applicable state requirements.

---

## Section 3 — Employee Payroll (W-2)

**3.1** Employee payroll is not managed directly by this system in its current version. Payroll must be processed through a licensed payroll provider.

> // TODO: CPA REVIEW REQUIRED — Integrate approved payroll provider API. Do not process W-2 payroll through this system until CPA approves the integration and tax withholding logic.

**3.2** When the payroll integration is active, the system must record each payroll run in the ledger with: `payPeriodStart`, `payPeriodEnd`, `grossAmount`, `netAmount`, `withholdingBreakdown`, and `payrollProviderId`.

**3.3** Federal and state payroll tax obligations (FICA, FUTA, SUTA, state income tax) must be calculated and remitted on schedule.

> // TODO: CPA REVIEW REQUIRED — Confirm deposit schedules and filing deadlines for federal and each state payroll tax jurisdiction.

---

## Section 4 — Payout Approval and Disbursement

**4.1** No payout above $500 may be disbursed without Owner-level approval (per Constitution Article II).

**4.2** All disbursements must be logged in the append-only ledger before the funds are released.

**4.3** Payout records must include: `recipientId`, `paymentMethod`, `amount`, `currency`, `periodCovered`, `approvedBy`, `approvedAt`, `ledgerEventId`.

---

## Section 5 — Expense Reimbursements

**5.1** Expense reimbursements are non-taxable only if they meet IRS accountable plan requirements. The system must flag reimbursements that do not have a supporting receipt attached.

> // TODO: CPA REVIEW REQUIRED — Confirm accountable plan compliance and per-diem rates annually.

**5.2** Reimbursement requests must be submitted with: receipt attachment, expense category, project association (if applicable), and submitter ID.

**5.3** Approved reimbursements are logged in the ledger and processed with the next payment cycle.
