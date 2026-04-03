# Contracts Law — JGA Enterprise OS Sectional Law

> Jurisdiction: US-FED (baseline) + per-state overrides via stateTag
> Version: 1.0 | Effective: 2024-01-01
> **ATTORNEY REVIEW REQUIRED before using any contract template with a new client or jurisdiction.**

---

## Section 1 — Contract Requirements

**1.1** Every project that advances to `active` status must have a signed contract on record.

**1.2** A contract must contain at minimum:
- Scope of work (explicit deliverables)
- Payment schedule (deposit amount, milestone payments, final payment)
- Timeline and delivery dates
- Revision and change-order policy
- Intellectual property assignment clause **(ATTORNEY REVIEW REQUIRED)**
- Late fee terms (if any)
- Dispute resolution clause **(ATTORNEY REVIEW REQUIRED)**
- Governing law and jurisdiction clause **(ATTORNEY REVIEW REQUIRED: must match stateTag)**
- Signature of both the client and authorized representative of Jay's Graphic Arts LLC

**1.3** Contracts must be stored as immutable records (`ContractBrick`) in the system. The original signed document must be attached.

---

## Section 2 — Signature and Execution

**2.1** Electronic signatures are accepted only if the signature process complies with the E-SIGN Act (15 U.S.C. § 7001) and applicable state law. **(ATTORNEY REVIEW REQUIRED: confirm e-signature compliance by state.)**

**2.2** The system must record: signatory name, role, timestamp, IP address, and signature method for each signature event.

**2.3** A contract is not executed until all required parties have signed. Partial execution does not grant project `active` status.

---

## Section 3 — Amendments and Change Orders

**3.1** Any change to scope, price, or timeline after contract execution requires a written change order signed by both parties.

**3.2** Change orders are stored as addenda to the original contract record. The original contract is never modified.

**3.3** Change orders that affect payment amounts must be reflected in the project's ledger and invoicing before work on the changed scope begins.

---

## Section 4 — Termination

**4.1** Contract termination clauses must be defined in the contract. The system enforces the payment obligations that survive termination per the contract terms.

**4.2** Upon termination, the project status must be updated, all outstanding invoices must be resolved, and the contract record must be updated with `terminatedAt` timestamp and reason.

**4.3** Terminated contracts are retained permanently in the system. **(ATTORNEY REVIEW REQUIRED: confirm document retention obligations on contract termination by state.)**

---

## Section 5 — Intellectual Property

**5.1** Ownership of deliverables does not transfer to the client until final payment is cleared in the ledger.

**5.2** The IP assignment terms in the contract govern all deliverables. The system surfaces a notice when final payment clears: "IP transfer triggered — confirm delivery per contract terms."

**5.3** Work-for-hire designations must be explicitly stated in the contract. The system does not assume work-for-hire status. **(ATTORNEY REVIEW REQUIRED.)**
