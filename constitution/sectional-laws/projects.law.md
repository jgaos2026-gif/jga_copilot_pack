# Projects Law — JGA Enterprise OS Sectional Law

> Jurisdiction: US-FED (baseline) + per-state overrides via stateTag
> Version: 1.0 | Effective: 2024-01-01

---

## Section 1 — Project State Machine

Every project must follow this state machine in strict order. No state may be skipped.

```
intake → deposit_pending → active → in_production → delivered → closed
```

Additional terminal states: `cancelled`, `disputed`, `on_hold`

**1.1** Transitions are logged in the audit trail with: `fromState`, `toState`, `actor`, `timestamp`, `brickId`, `reason`.

**1.2** Backward state transitions are prohibited except by Owner-level action (e.g., reverting `active` to `deposit_pending` if payment is reversed). Each reversal must be logged with a reason.

---

## Section 2 — Intake

**2.1** A project enters `intake` status upon completion of the client intake form. A `projectId` and client record are created at this point.

**2.2** An intake record requires: client name, contact information, service requested, estimated scope, and referring source.

**2.3** No financial commitment exists at intake. The project may be declined or cancelled without payment obligation (subject to contract terms if any were signed).

---

## Section 3 — Deposit Requirement

**3.1** A project advances from `deposit_pending` to `active` only after:
1. A signed contract is on record for the project.
2. The deposit payment is recorded in the ledger with status `cleared`.

**3.2** These two conditions are enforced at the API layer. Neither can be bypassed by UI input or agent action.

**3.3** The deposit amount is defined in the active `PolicyBrick` for the project's `stateTag` and confirmed in the contract.

---

## Section 4 — Production Gate

**4.1** A project transitions from `active` to `in_production` only when an authorized staff member explicitly begins production.

**4.2** The system must verify that `active` status is valid (contract signed, deposit cleared) before allowing the `in_production` transition.

**4.3** No contractor may be assigned to a project that is not in `active` or `in_production` status.

---

## Section 5 — Delivery Gate

**5.1** A project may not transition to `delivered` until final payment is recorded in the ledger as `cleared`.

**5.2** This rule is enforced at the API layer. The delivery endpoint will return an error if the outstanding balance is greater than $0.

**5.3** Upon delivery confirmation, the system must log an IP transfer notice (per contracts.law.md Section 5).

---

## Section 6 — Cancellations and Disputes

**6.1** A project may be moved to `cancelled` at any state prior to `delivered`. Cancellation must be logged with reason and remaining payment obligations per the contract.

**6.2** A project flagged as `disputed` is frozen. No new invoices, payments, or state transitions may be processed until the dispute is resolved per the Code of Conduct Section 4.

**6.3** An `on_hold` project may resume at any time with Owner or Admin AI authorization. The hold reason and duration must be logged.
