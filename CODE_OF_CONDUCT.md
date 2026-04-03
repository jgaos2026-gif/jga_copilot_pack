# JGA Enterprise OS — Code of Conduct

**Version:** 1.0  
**Effective Date:** 2026-04-03  
**Scope:** All contributors, operators, agents, contractors, and clients interacting with the JGA Enterprise OS platform and its repositories.

---

## Our Pledge

We pledge to make participation in the JGA Enterprise OS project a respectful, professional, and legally compliant experience for everyone. All participants—human or AI—must act in the interest of the business, its clients, and the integrity of its systems.

---

## Standards of Behavior

### Expected Behaviors

- Communicate professionally and respectfully.
- Act in good faith and in the best interest of clients and the business.
- Follow the chain of command defined in AGENTS.md and SYSTEM_CONSTITUTION.md.
- Report potential compliance violations, security incidents, or ambiguous situations promptly.
- Document decisions that affect money, contracts, or legal standing.
- Prefer transparency over opacity in all system interactions.
- Protect personally identifiable information (PII) and treat financial data with care.

### Unacceptable Behaviors

- Inventing, fabricating, or backdating records or data.
- Bypassing authentication, authorization, or compliance gates.
- Exposing secrets, credentials, or PII in logs, messages, or code.
- Providing legal or tax advice disguised as system output.
- Harassing, discriminating against, or intimidating any participant.
- Acting outside one's defined role scope (see AGENTS.md for role limitations).
- Attempting to suppress, delete, or alter audit logs.
- Committing code that hardcodes secrets or bypasses `.env`-based configuration.

---

## AI Agent Conduct Standards

All AI agents operating within JGA Enterprise OS must:

1. **Explain risk clearly** — surface uncertainty before acting on high-stakes decisions.
2. **Log decisions** — every significant action affecting money, contracts, or status must be logged.
3. **Escalate uncertainty** — when unsure, prefer pause and escalation over autonomous action.
4. **Protect the business first** — default to the stricter, safer choice.
5. **Obey the hierarchy** — Owner → AVA → ORION → VERA → Specialized Agents. No agent may override a higher authority.
6. **Never pretend to be infallible** — AI outputs are advisory; final authority rests with the Owner.

---

## Reporting Violations

Report potential violations to the repository owner or compliance contact:

- **Platform:** GitHub Issues (use the `compliance` label)
- **Urgent/sensitive:** Contact the Owner directly via the Owners Room emergency channel.

All reports will be handled confidentially. Retaliatory behavior toward reporters is a violation of this Code of Conduct and will result in removal from the project.

---

## Enforcement

Violations of this Code of Conduct may result in:

1. A written warning with documented remediation steps.
2. Temporary removal of access to the repository or system.
3. Permanent removal from the project.
4. Escalation to legal counsel where applicable.

All enforcement actions are logged in the immutable audit trail.

---

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org/) (version 2.1), extended with JGA-specific AI agent and compliance rules.

---

## Appendix A — Sectional Law Alignment

This Code of Conduct is subordinate to SYSTEM_CONSTITUTION.md and SECTIONAL_LAWS.md. Where conflict exists, the Constitution and Sectional Laws prevail.
