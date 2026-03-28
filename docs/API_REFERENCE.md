# JGA Enterprise OS - Complete API Reference

**Version**: 1.0.0  
**Base URL**: `https://api.jga.local` (production) or `http://localhost:3000/api` (development)  
**Authentication**: Bearer token in `Authorization` header

---

## 1. Health & Status

### GET /api/health

System health check endpoint returning all BRIC statuses.

**Request**:
```bash
curl -X GET http://localhost:3000/api/health
```

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2026-03-28T14:30:45.123Z",
  "version": "1.0.0",
  "bric": {
    "name": "system-b",
    "type": "Nervous System Collection"
  },
  "checks": {
    "database": { "status": "healthy", "message": "Connected to Supabase" },
    "interBricRpc": { "status": "healthy", "message": "Inter-BRIC RPC configured" },
    "eventLedger": { "status": "healthy", "message": "Event ledger operational" },
    "stitchConsensus": { "status": "healthy", "message": "Stitch BRIC reachable" }
  },
  "laws": {
    "#1": "Public Unidirectional - Enforced at firewall",
    "#2": "Spine No PII - Enforced in policy engine",
    "#4": "State Isolation - Enforced via RLS",
    "#7": "Stitch Integrity - Event ledger immutable",
    "#8": "Zero-Trust - mTLS on all inter-BRIC communication"
  }
}
```

---

## 2. Authentication

### POST /api/auth/register

Create new user account.

**Request**:
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Doe"
}
```

**Response** (201 Created):
```json
{
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "fullName": "John Doe"
  },
  "role": "client",
  "message": "Account created. Please verify your email."
}
```

### POST /api/auth/login

Authenticate user.

**Request**:
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response** (200 OK):
```json
{
  "user": {
    "id": "uuid",
    "email": "john@example.com"
  },
  "role": "contractor",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 3600
}
```

### POST /api/auth/mfa/setup

Setup TOTP MFA (Law #5).

**Request**:
```bash
curl -X POST http://localhost:3000/api/auth/mfa/setup \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):
```json
{
  "message": "MFA setup initiated",
  "totpSecret": "JBSWY3DPEBLW64TMMQ======",
  "qrCode": "https://chart.googleapis.com/chart?cht=qr&...",
  "instructions": [
    "1. Scan the QR code with your authenticator app",
    "2. Enter the 6-digit code to verify"
  ]
}
```

### POST /api/auth/mfa/verify

Verify and enable MFA (Law #5).

**Request**:
```json
{
  "code": "123456"
}
```

**Response** (200 OK):
```json
{
  "message": "MFA enabled successfully",
  "mfaEnabled": true,
  "backupCodes": ["BACKUP-1234-...", "BACKUP-5678-..."],
  "warning": "Save these codes in a secure location"
}
```

---

## 3. Contractors

### GET /api/contractors

List all contractors (with optional filters).

**Query Parameters**:
- `id` - Filter by specific contractor ID
- `state` - Filter by state code (CA, IL, TX)
- `status` - Filter by status (active, paused, inactive)

**Request**:
```bash
curl -X GET "http://localhost:3000/api/contractors?state=CA&status=active" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):
```json
{
  "contractors": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "full_name": "Jane Smith",
      "email": "jane@example.com",
      "states_licensed": ["CA", "IL"],
      "specialty_tags": ["graphic design", "video"],
      "status": "active",
      "availability": "available",
      "hourly_rate": 75.00,
      "created_at": "2026-03-01T10:00:00Z"
    }
  ],
  "total": 1
}
```

### POST /api/contractors

Create new contractor profile.

**Request**:
```json
{
  "user_id": "uuid",
  "full_name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1-555-0123",
  "states_licensed": ["CA", "IL"],
  "specialty_tags": ["graphic design", "video"],
  "bio": "Experienced designer...",
  "hourly_rate": 75.00,
  "project_rate": 2000.00
}
```

**Response** (201 Created):
```json
{
  "contractor": { ... },
  "message": "Contractor profile created successfully"
}
```

### PUT /api/contractors/:id

Update contractor profile.

**Request**:
```json
{
  "availability": "booked",
  "current_project_count": 3
}
```

---

## 4. Projects

### GET /api/projects

List projects for current user's state.

**Query Parameters**:
- `state` - State code (default: CA)
- `status` - Filter by project status
- `customer_id` - Filter by customer

**Request**:
```bash
curl -X GET "http://localhost:3000/api/projects?state=CA&status=active" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):
```json
{
  "state": "CA",
  "projects": [
    {
      "id": "uuid",
      "customer_id": "uuid",
      "contractor_id": "uuid",
      "name": "Website Redesign",
      "service_type": "graphic design",
      "status": "active",
      "contract_status": "signed",
      "deposit_status": "confirmed",
      "estimated_value": 5000.00,
      "actual_cost": 4500.00,
      "start_date": "2026-03-15",
      "target_completion_date": "2026-04-15",
      "created_at": "2026-03-01T10:00:00Z"
    }
  ],
  "total": 1
}
```

### POST /api/projects

Create new project (starts in "intake" status).

**Request**:
```json
{
  "customer_id": "uuid",
  "contractor_id": "uuid",
  "name": "Website Redesign",
  "service_type": "graphic design",
  "estimated_value": 5000.00,
  "state": "CA"
}
```

**Response** (201 Created):
```json
{
  "project": { ... },
  "state": "CA",
  "availableTransitions": ["quoted"],
  "message": "Project created in intake state"
}
```

### POST /api/projects/:id/status

Transition project to new status (state machine enforcement).

**Request**:
```json
{
  "newStatus": "active",
  "stateCode": "CA"
}
```

**Rules**:
- Can only transition to valid next states
- `active` requires: contract signed + deposit confirmed
- `in-production` requires: compliance approval

**Response** (200 OK):
```json
{
  "project": { ... },
  "currentStatus": "active",
  "availableTransitions": ["in-production", "cancelled"]
}
```

---

## 5. Customers

**Note**: Customer endpoints use state-specific schema (state_ca, state_il, state_tx)

### GET /api/projects/customers

List customers for a state.

**Query Parameters**:
- `state` - State code (CA, IL, TX)
- `status` - Filter by status

**Response** (200 OK):
```json
{
  "state": "CA",
  "customers": [
    {
      "id": "uuid",
      "company_name": "ACME Corp",
      "contact_name": "John Smith",
      "email": "john@acme.com",
      "status": "active",
      "vip_status": false,
      "total_spent": 15000.00,
      "created_at": "2026-02-01T10:00:00Z"
    }
  ]
}
```

---

## 6. Contracts

### GET /api/contracts

List contracts with filtering.

**Query Parameters**:
- `state` - State code (required)
- `project_id` - Filter by project
- `customer_id` - Filter by customer
- `status` - Filter by status (unsigned, signed, executed)

**Request**:
```bash
curl -X GET "http://localhost:3000/api/contracts?state=CA&status=signed" \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/contracts

Create new contract.

**Request**:
```json
{
  "projectId": "uuid",
  "customerId": "uuid",
  "contractorId": "uuid",
  "stateCode": "CA",
  "documentUrl": "https://storage.example.com/contract.pdf",
  "terms": "Custom terms...",
  "paymentSchedule": "50% deposit, 50% on completion"
}
```

### POST /api/contracts/:id/sign

Sign contract by contractor or customer.

**Request**:
```json
{
  "stateCode": "CA",
  "signedBy": "uuid",
  "signedByName": "Jane Smith",
  "role": "contractor"
}
```

**Response** (200 OK):
```json
{
  "contract": { ... },
  "bothSigned": false,
  "nextStep": "Awaiting customer signature"
}
```

### POST /api/contracts/:id/execute

Execute contract (requires compliance - Law #6).

**Request**:
```json
{
  "stateCode": "CA",
  "complianceArtifactId": "uuid"
}
```

**Response** (200 OK):
```json
{
  "contract": { ... },
  "compliance": {
    "decision": "approved",
    "riskScore": 35,
    "verified": true
  },
  "message": "Contract executed successfully"
}
```

---

## 7. Transactions

### GET /api/transactions

List transactions.

**Query Parameters**:
- `state` - State code (CA, IL, TX)
- `project_id` - Filter by project
- `customer_id` - Filter by customer
- `type` - Filter by type (deposit, payment, refund

, dispute, escrow-release)

**Response** (200 OK):
```json
{
  "state": "CA",
  "transactions": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "type": "deposit",
      "amount": 2500.00,
      "status": "completed",
      "held_in_escrow": false,
      "reference_id": "stripe_12345",
      "created_at": "2026-03-15T10:00:00Z"
    }
  ],
  "totals": {
    "count": 1,
    "totalAmount": 2500.00,
    "heldInEscrow": 0
  }
}
```

### POST /api/transactions

Record transaction.

**Request**:
```json
{
  "projectId": "uuid",
  "customerId": "uuid",
  "type": "deposit",
  "amount": 2500.00,
  "stateCode": "CA",
  "paymentMethod": "stripe",
  "heldInEscrow": true
}
```

### POST /api/escrow/:id/release

Release escrowed funds (requires dual approval - Law #5).

**Request**:
```json
{
  "stateCode": "CA",
  "approverSecondId": "uuid"
}
```

**Response** (200 OK):
```json
{
  "transaction": { ... },
  "releasedAt": "2026-03-20T10:00:00Z",
  "message": "Escrow funds released successfully"
}
```

---

## 8. Compliance

### POST /api/compliance/check

Run compliance check (calls Spine BRIC via mTLS - Law #8, Law #6).

**Request**:
```json
{
  "customerId": "uuid",
  "projectId": "uuid",
  "stateCode": "CA"
}
```

**Response** (200/202/403):
```json
{
  "decision": "approved",
  "riskScore": 42,
  "artifact": {
    "id": "uuid",
    "regulations_checked": ["state-business", "contractor-licensing"],
    "risk_factors": ["contractor-license-expiring"],
    "verified": true
  }
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Description of error",
  "details": "Additional context",
  "timestamp": "2026-03-28T14:30:45.123Z"
}
```

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async processing) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions or compliance blocked) |
| 404 | Not Found |
| 500 | Internal Server Error |
| 503 | Service Unavailable (circuit breaker open) |

---

## Rate Limiting

- 100 requests/minute per user
- 1000 requests/minute per IP
- Burst: 10 requests/second

---

## Authentication

All endpoints require `Authorization: Bearer {token}` header except:
- POST /api/auth/register
- POST /api/auth/login
- GET /api/health

---

## Laws Enforcement in APIs

| Law | Endpoints | Enforcement |
|-----|-----------|-------------|
| **#4**: State Isolation | All | RLS policies + schema isolation |
| **#5**: MFA for Owners | `/api/auth/mfa/*`, `/api/escrow/*/release` | MFA required check |
| **#6**: Compliance Gate | `/api/contracts/*/execute`, `/api/projects/*/status` | Artifact required |
| **#7**: Stitch Integrity | `/api/transactions`, `/api/compliance` | Signatures in event ledger |
| **#8**: Zero-Trust | `/api/compliance/check` | mTLS to Spine BRIC |

---

## Examples

### Complete Project Lifecycle

```bash
# 1. Create project (intake status)
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customer_id":"...", "contractor_id":"...", "name":"...", "service_type":"...", "estimated_value":5000, "state":"CA"}'

# 2. Move to quoted status
curl -X POST http://localhost:3000/api/projects/UUID/status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"newStatus":"quoted", "stateCode":"CA"}'

# 3. Create contract
curl -X POST http://localhost:3000/api/contracts \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"projectId":"...", "customerId":"...", "contractorId":"...", "stateCode":"CA", ...}'

# 4. Sign contract (contractor)
curl -X POST http://localhost:3000/api/contracts/UUID/sign \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"stateCode":"CA", "signedBy":"...", "signedByName":"...", "role":"contractor"}'

# 5. Sign contract (customer)
curl -X POST http://localhost:3000/api/contracts/UUID/sign \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"stateCode":"CA", "signedBy":"...", "signedByName":"...", "role":"customer"}'

# 6. Run compliance check
curl -X POST http://localhost:3000/api/compliance/check \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customerId":"...", "projectId":"...", "stateCode":"CA"}'

# 7. Execute contract (with compliance artifact)
curl -X POST http://localhost:3000/api/contracts/UUID/execute \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"stateCode":"CA", "complianceArtifactId":"..."}'

# 8. Record deposit
curl -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"projectId":"...", "customerId":"...", "type":"deposit", "amount":2500, "stateCode":"CA", "heldInEscrow":true}'

# 9. Activate project (requires deposit confirmed, contract signed)
curl -X POST http://localhost:3000/api/projects/UUID/status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"newStatus":"active", "stateCode":"CA"}'

# 10. Begin production
curl -X POST http://localhost:3000/api/projects/UUID/status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"newStatus":"in-production", "stateCode":"CA"}'
```

---

## Related Documentation

- [EVENT_SYSTEM.md](./EVENT_SYSTEM.md) - Event topics and schemas
- [INTER_BRIC_RPC.md](./INTER_BRIC_RPC.md) - Service-to-service communication
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Data structure
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design

---

**Last Updated**: March 28, 2026
