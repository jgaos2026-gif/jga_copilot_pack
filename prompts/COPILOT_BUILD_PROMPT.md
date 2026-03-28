# COPILOT BUILD PROMPT

Use this in VS Code Chat after opening the repo.

Read:
- docs/MASTER_SPEC.md
- .github/copilot-instructions.md
- docs/ARCHITECTURE.md
- docs/API_CONTRACTS.md
- docs/BUILD_ORDER.md
- supabase/schema.sql
- supabase/seed.sql

Task:
Scaffold the full JGA Enterprise OS in phases.

Requirements:
- Next.js App Router
- TypeScript
- Tailwind
- Supabase auth and database
- Server-side pricing engine
- Project, client, contract, transaction, ledger, contractor modules
- Owner/admin dashboard
- Contractor portal
- Stability layer pages
- Seeded demo UI

Business rules:
- Never hardcode quote pricing in the frontend
- Production blocked until deposit is paid
- Active status blocked until contract is signed
- Delivery blocked until final payment is paid
- Contractors cannot edit pricing or terms
- Important actions must write ledger events

Work style:
- Create files in small batches
- Explain file-by-file what you are generating
- Use clean readable code
- Add TODO comments only for external credentials or regulated review
