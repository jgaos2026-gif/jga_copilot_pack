# API CONTRACTS

## Public/API endpoints

### `POST /api/intake`
Creates:
- intake submission
- client record if new
- draft project linked to client

Validations:
- required contact info
- required service tier
- required project description
- required acknowledgements

Response:
```json
{
  "ok": true,
  "clientId": "uuid",
  "projectId": "uuid",
  "status": "intake"
}
```

### `POST /api/pricing/calculate`
Request:
```json
{
  "serviceTier": "basic",
  "urgency": "standard",
  "inquiryVolume7d": 12,
  "activeProjectCount": 4,
  "productionCapacityHours": 80
}
```

Response:
```json
{
  "ok": true,
  "basePrice": 500,
  "demandMultiplier": 1.1,
  "urgencyMultiplier": 1.0,
  "loadFactor": 1.05,
  "adjustedPrice": 577.5,
  "currency": "USD"
}
```

### `POST /api/contracts/mark-signed`
Marks a contract signed and writes ledger event.

### `POST /api/payments/webhook`
Consumes Stripe webhook events.
Rules:
- on deposit payment success -> mark deposit paid, write ledger event
- on final payment success -> mark final paid, write ledger event
- on refund/chargeback -> freeze escrow, write dispute event

### `POST /api/projects/:id/start-production`
Guarded server action or route.
Requires:
- contract signed
- deposit paid

### `POST /api/projects/:id/send-final-invoice`
Requires:
- production complete
- QC passed

### `POST /api/projects/:id/mark-delivered`
Requires:
- final payment paid

### `POST /api/contractor/call-log`
Creates call result log with contractor ownership checks.

### `POST /api/commissions/release`
Owner/admin only.
Requires escrow rules to pass.

## Suggested internal server functions

- `calculateQuote()`
- `createClientFromIntake()`
- `createProjectFromIntake()`
- `canProjectStartProduction()`
- `canProjectBeDelivered()`
- `writeLedgerEvent()`
- `computeAllocationBreakdown()`
- `computeCommissionEscrow()`
- `releaseEligibleEscrow()`
