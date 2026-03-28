# ACCEPTANCE TESTS

## Flow 1 - Intake
- user submits intake form
- system validates input
- client is created or matched
- project is created with `status = intake`
- ledger event is written

## Flow 2 - Pricing
- frontend requests quote from server
- pricing response includes base price and multipliers
- no hardcoded frontend fallback amount exists

## Flow 3 - Contract gating
- unsigned project cannot move to active
- signed project still cannot move to active until deposit is paid

## Flow 4 - Deposit gate
- when deposit payment succeeds:
  - payment stage becomes `deposit_paid`
  - project may enter production
  - ledger event exists
  - commission escrow may start for System B

## Flow 5 - Final delivery gate
- project cannot be marked delivered before final payment
- once final payment clears and QC passes, delivery action succeeds

## Flow 6 - Contractor restrictions
- contractor user cannot edit:
  - services
  - pricing rules
  - contract templates
  - global settings
  - payout policy
- contractor can create only own call logs and view own earnings

## Flow 7 - Ledger integrity
- payment webhook writes immutable event
- contract signing writes immutable event
- delivery writes immutable event
- refunds/chargebacks write immutable event and freeze relevant escrow

## Flow 8 - State tagging
- records support filtering by state tag
- exports preserve state tags
- archive paths include state-based segmentation

## Flow 9 - Stability layer
- owner can create and edit checklist/review entries
- non-owner cannot access owner stability pages

## Flow 10 - Demo readiness
- app loads with seeded data
- dashboards are navigable without empty-state confusion
