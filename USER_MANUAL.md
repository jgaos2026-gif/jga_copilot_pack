# JGA Enterprise OS — User Manual

## 1) Purpose
JGA Enterprise OS manages intake, projects, contracts, payments, compliance gating, and operational audit trails for Jay's Graphic Arts LLC.

## 2) Roles
- **owner**: full system authority
- **admin**: operational administration
- **staff**: internal operations support
- **contractor**: assigned-work access only (restricted authority)
- **client**: client-facing project visibility

## 3) Core Business Rules
- No production before **deposit confirmed**
- No active project without **signed contract**
- No final delivery before **final payment cleared**
- Financial and compliance history is **append-only**

## 4) Getting Started (Local)
1. Install dependencies:
   - `npm install`
2. Configure environment:
   - `cp .env.example .env.local`
   - Populate Supabase keys in `.env.local`
3. Start app:
   - `npm run dev`
4. Open:
   - `http://localhost:3000`

## 5) Main Workflows
### Intake
- Submit lead information through the intake flow.
- System records intake and emits intake event data.

### Pricing
- Use backend pricing endpoint:
  - `GET /api/pricing?tier=basic&urgency=standard&demandMultiplier=1&loadFactor=1`
- Frontend quotes must come from this endpoint.

### Project Lifecycle
1. Create customer
2. Create project
3. Confirm deposit
4. Sign contract
5. Move to active/production
6. Confirm final payment
7. Deliver final work

## 6) Dashboard/API Areas
- `/api/projects`
- `/api/contracts`
- `/api/transactions`
- `/api/contractors`
- `/api/dashboard`
- `/api/health`

## 7) Testing & Validation
- Run unit tests:
  - `npm run test:run`
- Run coverage:
  - `npm run test:run -- --coverage`
- Run lint:
  - `npm run lint`
- Type-check:
  - `npm run type-check`

## 8) Troubleshooting
- Missing Supabase env vars:
  - Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.
- Auth failures:
  - Verify role setup and token/session values.
- Pricing errors:
  - Confirm `tier` exists in `services` and query params are valid.

## 9) Compliance Notice
This system supports compliance workflows and controls, but it is not legal or tax advice. Legal/tax boundary decisions require attorney/CPA review.
