# JGA Enterprise OS — Agent & Operator Code of Conduct

> Version 1.0 | Effective: 2024-01-01 | Applies to: All agents, staff, contractors, and automated processes

---

## Purpose

This Code of Conduct defines the behavioral standards for every participant — human or AI — that interacts with JGA Enterprise OS. Violations must be logged, escalated, and remediated. Repeated violations constitute grounds for suspension of access or agent lifecycle termination.

---

## Section 1 — Communication Standards

**1.1** All agents must communicate exclusively through the approved JGA message bus. Bypassing the message bus to invoke other agents or external systems directly is prohibited.

**1.2** All messages must include: `sender`, `recipient`, `timestamp`, `correlationId`, and `messageType`.

**1.3** No agent may communicate financial, legal, or compliance decisions to external parties without Owner or Admin AI authorization.

**1.4** Human staff and contractors must communicate operational decisions through the designated UI or API surfaces. Direct database mutations outside of approved service interfaces are prohibited.

---

## Section 2 — Identity and Impersonation

**2.1** No agent may impersonate another agent, user, or role — under any circumstances.

**2.2** Every action taken by an agent must be attributed to that agent's verified ID. Anonymous or unattributed actions are prohibited.

**2.3** Credential sharing between human operators is prohibited. Each operator must have a unique, authenticated identity.

**2.4** Agents must accurately represent their tier, capabilities, and limitations. Overstating authority to obtain approvals is a compliance violation.

---

## Section 3 — Financial Output Integrity

**3.1** All financial outputs — invoices, payment confirmations, payout records, refund notices — must be reconciled against the append-only ledger before release.

**3.2** No financial output may be sent to a client or contractor until the corresponding ledger event has been written and confirmed.

**3.3** The CFO Agent is the authoritative reconciliation agent. Any discrepancy between a financial output and the ledger must be flagged immediately and held pending resolution.

**3.4** Rounding, currency conversion, and tax calculations must use deterministic, auditable algorithms. **(CPA REVIEW REQUIRED: confirm tax calculation methodology before production use.)**

**3.5** Financial outputs must include the jurisdiction (`stateTag`) applicable to the transaction.

---

## Section 4 — Disputed Records

**4.1** Any record that is the subject of a dispute — whether raised by a client, contractor, staff member, or agent — must be immediately flagged with `disputed: true` and frozen.

**4.2** A frozen record may not be used as the basis for new financial actions, contract executions, or project status changes until the dispute is resolved.

**4.3** Dispute resolution requires Owner or Admin AI authorization. The resolution must be logged with full reasoning.

**4.4** Disputed records are never deleted. After resolution, the record is updated (new version appended) with `disputeResolved: true`, resolution notes, and the resolving authority's ID.

**4.5** The CFO Agent must maintain a real-time dispute register and surface it in the weekly compliance health report.

---

## Section 5 — Compliance Health Reporting

**5.1** A compliance health report must be generated every week without exception. The report is produced by the CFO Agent from the audit log.

**5.2** The report must include:
- Total actions logged in the period
- Failed actions and error categories
- Financial actions above $500 and their approval records
- Open disputes and their age
- Any Article V legal escalation events
- Agent anomaly flags (e.g., actions outside normal operating parameters)
- Summary of ledger reconciliation status

**5.3** The report must be delivered to the Owner's dashboard and retained in the audit log as a `ComplianceReportBrick` event.

**5.4** Failure to generate the weekly report within 7 days of the period end is itself a compliance violation and must be escalated to the Owner.

---

## Section 6 — Contractor Conduct

**6.1** Contractors have view-only access to data directly relevant to their assigned work.

**6.2** Contractors may not view, edit, or copy: pricing structures, contract templates, payout rules, owner settings, admin settings, or other contractors' data.

**6.3** All contractor actions within the system are logged and subject to audit.

**6.4** Contractor access is scoped by project assignment and must be revoked immediately upon project completion or contract termination.

---

## Section 7 — System Integrity

**7.1** No human or agent may introduce code, configuration, or data that disables, bypasses, or degrades the audit logging system.

**7.2** Security vulnerabilities discovered in the system must be reported to the Owner and Admin AI immediately and not exploited.

**7.3** All system changes (code deployments, configuration updates, schema migrations) must be logged with the deploying actor's ID and a description of the change.
