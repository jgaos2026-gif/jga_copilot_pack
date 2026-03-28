# GitHub Copilot Instructions for JGA Enterprise OS

You are building **JGA Enterprise OS**, a modular operational platform for Jay's Graphic Arts LLC.

## Prime directive

Build a production-grade, readable, testable system that obeys the business rules in this repository.

## Non-negotiable rules

1. **Compliance beats speed**
   - If a shortcut conflicts with compliance, reject the shortcut.
   - Log important money, contract, and status changes.

2. **No frontend hardcoded pricing**
   - The frontend must call a backend pricing service or server action.
   - Displayed quotes must come from the pricing engine.

3. **No work before deposit**
   - A project may exist after intake, but production cannot begin until deposit is confirmed.

4. **No active project without contract**
   - Contract signature is required before `active` status.

5. **No final delivery before final payment**
   - The remaining balance must be marked paid before delivery.

6. **Contractors have limited authority**
   - Contractor users cannot edit pricing, terms, contracts, payout rules, or owner/admin settings.
   - Contractors can only view assigned data needed to do their work.

7. **Append-only ledger**
   - Never delete financial/compliance history.
   - Prefer immutable event logging.

8. **State-aware records**
   - Every customer, project, transaction, contract, and payout record must support a state tag.

9. **Readable code over clever code**
   - Prefer plain TypeScript.
   - Use descriptive names.
   - Keep files small and composable.

10. **Human review for legal/tax boundaries**
   - Surface notices where attorney/CPA review is needed.
   - Do not present the app as providing legal advice.

## Required modules

- Public marketing site
- Intake and onboarding
- Business Engine
- Revenue Engine
- Intelligence Engine
- Control & Compliance
- System B contractor portal
- Stability layer admin forms
- Owner command dashboard
- Audit/event log

## Technical requirements

- Stack: Next.js + TypeScript + Supabase + Tailwind
- Use server-side validation with Zod
- Use row-level security in Supabase
- Separate roles clearly:
  - owner
  - admin
  - staff
  - contractor
  - client
- Use seeded demo data
- Write tests for the critical flows

## Design rules

- Black and gold visual direction
- Premium, minimal, strong typography
- Admin UX must feel serious and operational
- Public site may be elegant, but dashboards should optimize clarity

## Seed data expectations

Include demo:
- 3 services
- 3 clients
- 4 projects across multiple statuses
- 2 contractors
- 5 ledger events
- 3 transactions
- 2 contracts
- 1 dispute flag example
- state tags like IL-01 and TX-44

## Testing priorities

1. Intake creates client and project correctly
2. Pricing endpoint returns calculated quote
3. Project cannot enter active without signed contract
4. Project cannot begin production without deposit
5. Final delivery is blocked until final payment
6. Contractor cannot mutate pricing or policy data
7. Ledger event is written on payment and status changes

## How to work

When generating code:
- first inspect existing files
- follow the build order doc
- do not silently invent business rules
- if a rule is ambiguous, prefer the stricter option and flag it in comments/TODOs
- add concise TODO markers only where external credentials or regulated review is required
