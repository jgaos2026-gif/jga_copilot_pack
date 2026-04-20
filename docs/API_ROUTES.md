## API Route Contracts & Specifications

### Overview
Complete REST API implementation for JGA Enterprise OS with endpoints for:
- Public intake forms (Law #1: unidirectional)
- State-specific customer/project management
- Transaction processing and payments
- Authentication and MFA
- Admin operations with security gates

---

## Authentication

### Login
**Endpoint:** `POST /api/auth/login`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "user_metadata": {
      "role": "contractor|customer|admin|owner"
    }
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 3600
  }
}
```

**Error Responses:**
- `401`: Invalid credentials
- `400`: Missing email or password

---

### MFA Verification
**Endpoint:** `POST /api/auth/mfa-verify`

**Law #5 Requirement:** Owners and admins require MFA (TOTP) with 4-hour verification window

**Request Body:**
```json
{
  "userId": "uuid",
  "totpToken": "123456"
}
```

**Response (200):**
```json
{
  "status": "verified",
  "mfaWindowExpires": "2026-01-15T14:30:00Z"
}
```

**Error Responses:**
- `401`: Invalid TOTP token
- `409`: MFA already verified (within 4-hour window)
- `400`: User not found

---

## Public API (Law #1: Unidirectional)

### Intake Submission
**Endpoint:** `POST /api/intake`

**Rate Limit:** 5 requests per IP per hour

**Request Body:**
```json
{
  "company": "Company Name",
  "contact": "contact@example.com",
  "phone": "+1-555-0123",
  "service_type": "legal|accounting|consulting",
  "scope": "Details about service needed",
  "state": "CA|IL|TX"
}
```

**Response (201):**
```json
{
  "intake_id": "uuid",
  "status": "received",
  "message": "Lead intake recorded. Contractor will contact you within 24 hours."
}
```

**Event Emitted:**
```json
{
  "type": "intake_created",
  "topic": "intakes",
  "data": {
    "company": "Company Name",
    "contact": "contact@example.com",
    "state_code": "CA",
    "service_type": "legal",
    "source": "public-form"
  }
}
```

**Error Responses:**
- `400`: Invalid input (missing required fields, invalid email, invalid state code)
- `429`: Rate limit exceeded

---

## State-Specific APIs

### Create Customer
**Endpoint:** `POST /api/state-[STATE]/customers`

**Authentication:** Required (Bearer token)

**URL Parameters:**
- `STATE`: `CA` | `IL` | `TX`

**Request Body:**
```json
{
  "company_name": "Client Corp",
  "contact_name": "Jane Doe",
  "email": "jane@corp.example.com",
  "phone": "+1-555-0123"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "status": "created",
  "state_code": "CA"
}
```

**Database (RLS Enforced - Law #4):**
```sql
-- Created in customers table with state_code constraint
INSERT INTO customers (state_code, company_name, contact_name, email, phone, status)
VALUES ('CA', 'Client Corp', 'Jane Doe', 'jane@corp.example.com', '+1-555-0123', 'active')
WHERE state_code = 'CA'; -- RLS Policy enforces this
```

**Event Emitted:**
```json
{
  "type": "customer_created",
  "topic": "customer-events",
  "data": {
    "customer_id": "uuid",
    "state_code": "CA"
  }
}
```

**Error Responses:**
- `401`: No authorization header
- `400`: Invalid input or state code
- `409`: Email already exists in state

---

### Create Project
**Endpoint:** `POST /api/state-[STATE]/projects`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "customer_id": "uuid",
  "name": "Project Name",
  "description": "Detailed project description",
  "service_type": "legal|accounting|consulting",
  "estimated_value": 5000.00
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "status": "created",
  "state_code": "CA",
  "deposit_required": 2500.00
}
```

**Workflow:**
1. Project created with status `intake`
2. Deposit required calculated from estimated_value
3. Project awaits: contract signature + deposit confirmation
4. Compliance check initiated for high-value projects (>$25k)

**Event Emitted:**
```json
{
  "type": "project_created",
  "topic": "project-events",
  "data": {
    "project_id": "uuid",
    "customer_id": "uuid",
    "state_code": "CA",
    "estimated_value": 5000
  }
}
```

**Error Responses:**
- `401`: Unauthorized
- `400`: Invalid customer_id or state mismatch
- `404`: Customer not found
- `409`: Customer limited to N projects (max_projects_per_customer config)

---

### Get Project Details
**Endpoint:** `GET /api/state-[STATE]/projects/[ID]`

**Response (200):**
```json
{
  "id": "uuid",
  "state_code": "CA",
  "customer_id": "uuid",
  "name": "Project Name",
  "status": "intake|active|completed|disputed",
  "deposit_status": "pending|confirmed|refunded",
  "contract_status": "pending|signed|executed",
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

**Error Responses:**
- `404`: Project not found (or state mismatch)
- `401`: Unauthorized

---

### Record Transaction
**Endpoint:** `POST /api/state-[STATE]/transactions`

**Authentication:** Required (Bearer token)

**Types:**
- `deposit`: Initial customer deposit
- `payment`: Contractor invoice payment
- `refund`: Partial or full refund

**Request Body:**
```json
{
  "project_id": "uuid",
  "customer_id": "uuid",
  "type": "deposit|payment|refund",
  "amount": 2500.00,
  "reference_id": "stripe_charge_123"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "status": "recorded",
  "reference_id": "stripe_charge_123"
}
```

**Auto-Updates (Deposit Type):**
- Project `deposit_status` → `confirmed`
- Emits `deposit_confirmed` event
- May trigger compliance check if not yet verified

**Event Emitted:**
```json
{
  "type": "deposit_confirmed",
  "topic": "customer-events",
  "data": {
    "project_id": "uuid",
    "amount": 2500,
    "transaction_id": "uuid",
    "state_code": "CA"
  }
}
```

**Error Responses:**
- `400`: Invalid project_id or amount
- `404`: Project not found
- `422`: Invalid transaction type
- `409`: Transaction already recorded (idempotency check via reference_id)

---

### Issue Stripe Payment Link
**Endpoint:** `POST /api/payments/stripe-link`

**Authentication:** Server-side only (requires `SUPABASE_SERVICE_ROLE_KEY` + `STRIPE_SECRET_KEY`)

**Purpose:** Creates a Stripe Payment Link for deposit or final payment, logs a `transactions` row with `payment_stage` set to `deposit_sent` or `final_sent`, and updates the project `payment_stage` to match.

**Request Body:**
```json
{
  "project_id": "uuid",
  "client_id": "uuid",
  "amount": 2500.00,
  "currency": "USD",
  "payment_stage": "deposit",
  "description": "Deposit for project ACME-42",
  "customer_email": "client@example.com",
  "success_url": "https://app.yourdomain.com/pay/success",
  "state_tag": "IL-01",
  "metadata": {
    "quote_id": "Q-1234"
  }
}
```

**Response (201):**
```json
{
  "url": "https://pay.stripe.com/p/link_123",
  "payment_link_id": "plink_123",
  "processor": "stripe",
  "payment_stage": "deposit_sent"
}
```

**Notes:**
- Amount is stored in dollars; Stripe is charged using integer cents.
- Fallback success URL can be provided via `STRIPE_PAYMENT_SUCCESS_URL`.
- Payment completion should be confirmed via Stripe webhook to move `payment_stage` to `deposit_paid` or `final_paid`.

---

## Payment Webhooks

### Payment Received
**Endpoint:** `POST /api/webhooks/payment-received`

**Webhook Source:** Stripe, Square, PayPal, etc.

**Request Headers:**
```
X-Stripe-Signature: timestamp=...,version=...,signature=...
Content-Type: application/json
```

**Request Body (Stripe example):**
```json
{
  "transaction_id": "txn_123",
  "amount": 2500,
  "project_id": "uuid",
  "state_code": "CA",
  "customer_email": "jane@corp.example.com",
  "timestamp": "2026-01-15T10:00:00Z"
}
```

**Signature Verification:**
```typescript
// Verify HMAC-SHA256 signature
const signature = req.headers['x-stripe-signature'];
const body = rawBody; // Must use raw body, not parsed JSON
const computed = hmac('sha256', STRIPE_WEBHOOK_SECRET, body);
if (computed !== signature.split(',')[2]) {
  return 401; // Invalid signature
}
```

**Response (200):**
```json
{
  "status": "received",
  "transaction_id": "txn_123"
}
```

**Idempotency:**
- Webhooks are idempotent via `transaction_id`
- Duplicate calls return 200 (no double-charge)

**Error Responses:**
- `401`: Invalid signature
- `400`: Invalid payload
- `409`: Duplicate transaction (already recorded)

---

## Admin API (Law #5: MFA + Dual-Auth)

### Get Admin Dashboard
**Endpoint:** `GET /api/admin/dashboard`

**Headers:**
```
Authorization: Bearer [access_token with MFA verified]
```

**MFA Requirement:**
- User must have valid MFA verification (within 4-hour window)
- If expired: endpoint returns `403 Forbidden: MFA verification required`

**Response (200):**
```json
{
  "overview": {
    "total_customers": 1250,
    "total_projects": 3420,
    "active_projects": 1820,
    "total_revenue": 15250000.00,
    "pending_deposits": 425000.00,
    "disputed_projects": 12
  },
  "by_state": {
    "CA": {
      "customers": 650,
      "projects": 1850,
      "revenue": 8500000.00
    },
    "IL": {
      "customers": 350,
      "projects": 950,
      "revenue": 4200000.00
    },
    "TX": {
      "customers": 250,
      "projects": 620,
      "revenue": 2550000.00
    }
  },
  "alerts": [
    {
      "type": "compliance",
      "severity": "high",
      "message": "3 projects failing compliance checks",
      "count": 3
    }
  ]
}
```

**Error Responses:**
- `401`: Missing authentication
- `403`: MFA verification expired (>4 hours)
- `403`: Insufficient role (requires `admin` or `owner`)

---

### Update System Configuration
**Endpoint:** `POST /api/admin/config`

**Headers:**
```
Authorization: Bearer [owner_token with MFA verified]
```

**Dual-Auth Requirement (Law #5):**
- Requires BOTH owner + approver signatures
- Each must have valid MFA (within 4-hour window)
- Request includes both signatures in Authorization header

**Request Body:**
```json
{
  "key": "system.max_projects_per_customer",
  "value": 10,
  "reason": "Capacity planning for Q1 2026"
}
```

**Request Headers (Dual-Auth Pattern):**
```
Authorization: Bearer [owner_token]
X-Approver-Signature: [approver_signature]
```

**Response (200):**
```json
{
  "status": "updated",
  "key": "system.max_projects_per_customer",
  "old_value": 5,
  "new_value": 10,
  "applied_at": "2026-01-15T10:00:00Z"
}
```

**Event Emitted (with audit trail):**
```json
{
  "type": "system_config_changed",
  "topic": "admin-events",
  "data": {
    "key": "system.max_projects_per_customer",
    "old_value": 5,
    "new_value": 10,
    "changed_by": "owner_uuid",
    "approved_by": "approver_uuid",
    "reason": "Capacity planning for Q1 2026"
  }
}
```

**Error Responses:**
- `403`: MFA verification expired
- `403`: Missing approver signature
- `403`: Approver MFA verification expired
- `403`: Only owner role can change system config
- `400`: Invalid configuration key

---

### Get Audit Log
**Endpoint:** `GET /api/admin/audit-log`

**Query Parameters:**
```
?start_date=2026-01-01
&end_date=2026-01-31
&event_type=customer_created|project_activated|transaction_recorded
&page=1
&limit=50
```

**Role-Based Access:**
- `owner`: Can see all audit logs
- `auditor`: Can see audit logs for own state
- All others: Access denied

**Response (200):**
```json
{
  "total": 1250,
  "page": 1,
  "limit": 50,
  "events": [
    {
      "id": "uuid",
      "timestamp": "2026-01-15T10:23:45Z",
      "event_type": "customer_created",
      "actor": "contractor-uuid",
      "actor_role": "contractor",
      "resource_id": "customer-uuid",
      "resource_type": "customer",
      "state_code": "CA",
      "changes": {
        "company_name": ["", "Client Corp"],
        "status": ["", "active"]
      }
    }
  ]
}
```

**Error Responses:**
- `401`: Not authenticated
- `403`: Insufficient permissions

---

### Resolve Dispute
**Endpoint:** `POST /api/admin/disputes/[ID]/resolve`

**Request Body:**
```json
{
  "resolution": "full_refund|partial_refund|reject|split",
  "refund_amount": 2500.00,
  "notes": "Customer provided additional documentation"
}
```

**Authorization:**
- Requires `owner` role
- Requires MFA verification
- Emits audit trail event

**Response (200):**
```json
{
  "dispute_id": "uuid",
  "status": "resolved",
  "resolution": "full_refund",
  "refund_amount": 2500.00,
  "resolved_at": "2026-01-15T10:00:00Z"
}
```

**Event Emitted:**
```json
{
  "type": "dispute_resolved",
  "topic": "admin-events",
  "data": {
    "dispute_id": "uuid",
    "project_id": "uuid",
    "resolution": "full_refund",
    "refund_amount": 2500,
    "resolved_by": "owner_uuid"
  }
}
```

---

## Health & Status

### Health Check
**Endpoint:** `GET /api/health`

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T10:00:00Z",
  "services": {
    "api": "ok",
    "database": "ok",
    "eventBus": "ok",
    "redis": "ok",
    "realtime": "ok"
  },
  "version": "1.0.0"
}
```

---

## Error Response Format

All error responses follow standard format:

```json
{
  "error": "Error message",
  "code": "INVALID_INPUT|NOT_FOUND|UNAUTHORIZED|RATE_LIMITED|etc",
  "details": {
    "field": "company_name",
    "message": "Must be at least 1 character"
  },
  "request_id": "req-uuid"
}
```

---

## Rate Limiting

- **Public APIs** (`/api/intake`): 5 req/hour per IP
- **Authenticated APIs**: 100 req/hour per user
- **Admin APIs**: 50 req/hour per user
- **WebHooks**: No limit (needs signature verification)

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1610704800
```

---

## Idempotency

For state-changing requests (POST/PUT):
- Include `Idempotency-Key: [UUID]` header
- Response includes `Idempotency-Key` for verification
- Duplicate requests return 200 with cached response

**Example:**
```
POST /api/state-CA/transactions
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

---

## WebSocket Real-Time API

See `docs/REALTIME.md` for WebSocket events, channels, and subscriptions.
