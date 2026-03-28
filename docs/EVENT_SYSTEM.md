# JGA Enterprise OS - Event System (Nervous System)

Complete specification of the event-driven architecture that powers real-time updates, data flow, and system coordination.

## Architecture Overview

The Event System (Nervous System) is the real-time backbone connecting all BRICs asynchronously. It enables:
- **Decoupled Communication** - BRICs don't call each other directly (Law #8)
- **Event Sourcing** - Complete audit trail via append-only ledger
- **Real-Time Notifications** - Contractors, clients, admins see updates instantly
- **Async Processing** - Time-consuming operations don't block user actions

```
┌────────────────────────────────────────────────────────────┐
│                   EVENT BUS (Kafka/Pub-Sub)                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Topics (partitioned by state or domain):                 │
│  ├─ intakes (Public BRIC publishes)                       │
│  ├─ leads (System B publishes)                            │
│  ├─ customers (State BRIC publishes)                      │
│  ├─ policies (Spine publishes)                            │
│  ├─ compliance (Overseer publishes)                       │
│  ├─ projects (State BRIC publishes)                       │
│  ├─ transactions (State BRIC publishes)                   │
│  └─ system-events (all BRICs for monitoring)              │
│                                                            │
│  Consumers:                                                │
│  ├─ Audit BRIC (subscribes to all)                        │
│  ├─ Stitch BRIC (for signing/consensus)                   │
│  ├─ Real-time Engine (for WebSocket push)                 │
│  ├─ Notification Service (emails, SMS, webhooks)          │
│  └─ Analytics Engine (for dashboards)                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
         │               │               │
         ▼               ▼               ▼
    [State BRIC]   [Spine BRIC]   [Overseer BRIC]
         │               │               │
         └───────────────┴───────────────┘
                  │
         ┌─────────────────┐
         │  Audit Ledger   │
         │  (Immutable)    │
         └─────────────────┘
```

---

## Event Topics & Schemas

### **Topic: `intakes` (Public BRIC)**

**Purpose**: Lead intake from public website

**Producer**: Public BRIC (`api/public/intake`)

**Consumers**:
- System B (lead enrichment)
- Audit BRIC (logging)
- Analytics Engine (dashboard stats)

**Schema**:
```typescript
interface IntakeCreatedEvent {
  event_id: string;           // UUID
  event_type: "intake-created";
  timestamp: ISO8601;
  
  intake_id: string;
  state_code: string;         // CA, IL, TX, etc.
  
  // Client data (optional for webhook/form variations)
  client: {
    company_name: string;
    contact_name: string;
    email: string;
    phone: string;
  };
  
  // Service request
  service_type: string;       // "graphic design", "video", etc.
  scope: string;              // Project description
  estimated_budget?: number;
  
  // Metadata
  source: "public-form" | "webhook" | "api";
  ip_address: string;
  user_agent: string;
  
  hash: string;               // SHA-256(event)
}

// Example
{
  "event_id": "evt_12345-abcde",
  "event_type": "intake-created",
  "timestamp": "2026-03-28T10:30:00Z",
  "intake_id": "intake_98765-fghij",
  "state_code": "CA",
  "client": {
    "company_name": "TechCorp Inc",
    "contact_name": "Alice Smith",
    "email": "alice@techcorp.com",
    "phone": "+1-555-0100"
  },
  "service_type": "graphic design",
  "scope": "3 social media campaigns for Q1",
  "estimated_budget": 5000,
  "source": "public-form",
  "ip_address": "203.0.113.50",
  "user_agent": "Mozilla/5.0...",
  "hash": "sha256_hash_here"
}
```

**Partition Key**: `state_code` (ensures all CA intakes go to same partition)

**Retention**: 90 days (then archived to cold storage)

**Example Consumer (System B)**:
```typescript
async function processIntakeEvent(event: IntakeCreatedEvent) {
  // 1. Validate intake hash
  if (!verifyHash(event)) throw new Error("Corrupted event");
  
  // 2. Check for duplicate
  const isDuplicate = await checkDuplicate(event.client.email);
  if (isDuplicate) return; // Skip, already processed
  
  // 3. Enrich with geolocation
  const enriched = await enrichWithGeo(event);
  
  // 4. Assign contractor
  const contractor = await assignContractor(
    enriched.service_type,
    enriched.state_code,
    enriched.client
  );
  
  // 5. Emit new event
  await publishEvent("leads", {
    event_type: "lead-assigned",
    intake_id: event.intake_id,
    contractor_id: contractor.id,
    state_code: event.state_code,
    timestamp: now(),
    ...
  });
}
```

---

### **Topic: `leads` (System B)**

**Purpose**: Contractor work assignments

**Producer**: System B processor

**Consumers**:
- State BRIC (customer/project creation)
- Real-time Engine (contractor notifications)
- Audit BRIC (logging)

**Schema**:
```typescript
interface LeadAssignedEvent {
  event_id: string;
  event_type: "lead-assigned";
  timestamp: ISO8601;
  
  lead_id: string;            // UUID
  intake_id: string;          // References intake
  contractor_id: string;
  state_code: string;
  
  // Metadata (NO PII per Law #3)
  metadata: {
    service_type: string;
    scope: string;
    estimated_value: number;
    urgency: "low" | "medium" | "high";
  };
  
  hash: string;
}
```

**Partition Key**: `contractor_id` (all work for contractor goes to same partition)

---

### **Topic: `customers` (State BRIC)**

**Purpose**: Customer record changes

**Producer**: State BRIC (per-state partition)

**Consumers**:
- Spine BRIC (policy checks)
- Audit BRIC (logging)
- Owners Room (dashboard)

**Schema**:
```typescript
interface CustomerCreatedEvent {
  event_id: string;
  event_type: "customer-created" | "customer-updated";
  timestamp: ISO8601;
  
  customer_id: string;
  state_code: string;
  
  // Field changes
  old_values?: {
    [field: string]: any;
  };
  new_values: {
    company_name: string;
    contact_name: string;
    email: string;
    phone: string;
    status: string;
    custom_fields?: Record<string, any>;
  };
  
  changed_by: "contractor:{id}" | "system" | "admin:{id}";
  hash: string;
}
```

**Partition Key**: `state_code` (all CA customers in one partition)

---

### **Topic: `projects` (State BRIC)**

**Purpose**: Project status changes

**Producer**: State BRIC

**Consumers**:
- Contractor Portal (notifications)
- Audit BRIC (logging)
- Analytics Engine (reporting)

**Schema**:
```typescript
interface ProjectStatusEvent {
  event_id: string;
  event_type: 
    | "project-created"
    | "project-activated"  // Contract signed + deposit confirmed
    | "project-in-production"
    | "project-completed"
    | "project-cancelled";
  timestamp: ISO8601;
  
  project_id: string;
  customer_id: string;
  state_code: string;
  contractor_id: string;
  
  // State transitions
  old_status?: string;
  new_status: string;
  
  // Triggering action
  trigger_event: string;  // "contract-signed", "deposit-confirmed", etc.
  
  hash: string;
}

// Example: Project activation
{
  "event_id": "evt_project_1",
  "event_type": "project-activated",
  "timestamp": "2026-03-28T14:00:00Z",
  "project_id": "proj_123",
  "customer_id": "cust_456",
  "state_code": "CA",
  "contractor_id": "cont_789",
  "old_status": "contract-pending",
  "new_status": "active",
  "trigger_event": "deposit-confirmed",
  "hash": "..."
}
```

**Partition Key**: `state_code`

---

### **Topic: `policies` (Spine BRIC)**

**Purpose**: Policy evaluation results

**Producer**: Spine BRIC

**Consumers**:
- Compliance BRIC (next layer)
- Audit BRIC (logging)

**Schema**:
```typescript
interface PolicyEvaluatedEvent {
  event_id: string;
  event_type: "policy-evaluated";
  timestamp: ISO8601;
  
  customer_id: string;
  state_code: string;
  
  // Policy evaluation results
  laws_checked: number[];    // [1, 2, 3, 4, 5, 6, 7, 8]
  decisions: {
    law_number: number;
    decision: "approved" | "blocked";
    reason?: string;
  }[];
  
  overall_decision: "approved" | "blocked";
  
  hash: string;
}
```

**Partition Key**: `state_code`

---

### **Topic: `compliance` (Overseer BRIC)**

**Purpose**: Compliance artifact creation and approval

**Producer**: Overseer BRIC

**Consumers**:
- Owners Room (for admin view)
- Audit BRIC (logging)
- Stitch BRIC (for signing)

**Schema**:
```typescript
interface ComplianceArtifactEvent {
  event_id: string;
  event_type: "compliance-artifact-created" | "compliance-approved" | "compliance-blocked";
  timestamp: ISO8601;
  
  customer_id: string;
  state_code: string;
  
  // Artifact 
  artifact_id: string;
  regulations_checked: string[];
  risk_score: number;        // 0-100
  decision: "approved" | "blocked";
  reason?: string;
  
  // Will be signed by Stitch
  needs_signing: boolean;
  
  hash: string;
}
```

**Partition Key**: `state_code`

---

### **Topic: `transactions` (State BRIC)**

**Purpose**: All financial transactions (deposits, payments, refunds)

**Producer**: State BRIC (payment webhook processor)

**Consumers**:
- Ledger BRIC (accounting)
- Analytics Engine (financial reporting)
- Audit BRIC (logging)

**Schema**:
```typescript
interface TransactionEvent {
  event_id: string;
  event_type: "transaction-created";
  timestamp: ISO8601;
  
  transaction_id: string;
  project_id: string;
  customer_id: string;
  state_code: string;
  
  // Transaction details
  type: "deposit" | "payment" | "refund" | "escrow-release";
  amount: number;
  currency: "USD";
  
  reference_id: string;      // Stripe transaction ID, etc.
  description: string;
  
  // For escrow
  escrow_release_conditions?: {
    project_completion_approved: boolean;
    dispute_settled: boolean;
  };
  
  hash: string;
}
```

**Partition Key**: `state_code`

---

### **Topic: `system-events` (All BRICs)**

**Purpose**: System health and monitoring

**Producer**: All BRICs emit errors, warnings, health checks

**Consumers**:
- Monitoring/Alerting system
- Audit BRIC
- Ops Dashboard

**Schema**:
```typescript
interface SystemEvent {
  event_id: string;
  event_type: "error" | "warning" | "health-check" | "performance-metric";
  timestamp: ISO8601;
  
  source_bric: string;       // "spine", "system-b", "state-bric-ca", etc.
  severity: "critical" | "warning" | "info";
  
  message: string;
  error_code?: string;
  stack_trace?: string;
  
  metrics?: {
    [key: string]: number;   // latency, memory, etc.
  };
  
  hash: string;
}
```

**Partition Key**: `source_bric` (or timestamp for sharding)

---

## Event Ledger (Immutable Audit Log)

### **Purpose**
Append-only ledger of all events for compliance (Law #7) and audit trail.

### **Schema**

```sql
CREATE TABLE event_ledger (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event metadata
  event_id UUID NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- BRIC source
  source_bric TEXT NOT NULL,
  
  -- Partition key for sharding
  partition_key TEXT NOT NULL,
  
  -- Event payload (JSON)
  payload JSONB NOT NULL,
  
  -- Integrity (Law #7)
  hash TEXT NOT NULL UNIQUE,      -- SHA-256(payload)
  merkle_root TEXT,               -- Latest Merkle root when inserted
  signature TEXT,                 -- Stitch 3-node consensus signature
  
  -- Audit
  received_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  
  -- Soft constraints (not enforced at DB level, app level enforces)
  immutable: TRUE                 -- No UPDATE/DELETE allowed
);

-- Indexes for performance
CREATE INDEX idx_event_ledger_event_id ON event_ledger(event_id);
CREATE INDEX idx_event_ledger_event_type ON event_ledger(event_type);
CREATE INDEX idx_event_ledger_timestamp ON event_ledger(timestamp);
CREATE INDEX idx_event_ledger_partition ON event_ledger(partition_key);
CREATE INDEX idx_event_ledger_source ON event_ledger(source_bric);

-- Constraint: No deletes
CREATE TRIGGER no_delete_event_ledger
BEFORE DELETE ON event_ledger
FOR EACH ROW
EXECUTE FUNCTION raise_immutable_error();

-- Constraint: No updates
CREATE TRIGGER no_update_event_ledger
BEFORE UPDATE ON event_ledger
FOR EACH ROW
EXECUTE FUNCTION raise_immutable_error();
```

### **Insertion Flow**

```typescript
async function appendEventToLedger(event: Event) {
  // 1. Verify event is well-formed
  validateEventSchema(event);
  
  // 2. Calculate hash
  const hash = sha256(JSON.stringify(event));
  
  // 3. Verify no duplicate (idempotence)
  const existing = await db.query(
    "SELECT id FROM event_ledger WHERE event_id = $1",
    [event.event_id]
  );
  if (existing.length > 0) {
    return; // Already inserted, skip
  }
  
  // 4. Get latest Merkle root from Stitch
  const merkleRoot = await stitch.getLatestMerkleRoot();
  
  // 5. Insert to ledger
  await db.query(
    `INSERT INTO event_ledger 
    (event_id, event_type, timestamp, source_bric, partition_key, 
     payload, hash, merkle_root)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      event.event_id,
      event.event_type,
      event.timestamp,
      event.source_bric,
      event.partition_key,
      JSON.stringify(event),
      hash,
      merkleRoot
    ]
  );
  
  // 6. Submit for Stitch signing (async)
  await publishEvent("internal-stitch", {
    event_type: "sign-ledger-entry",
    ledger_id: insertedId,
    hash: hash,
    merkle_root: merkleRoot
  });
}
```

---

## Event Bus Implementation

### **Technology Options**

| Technology | Throughput | Latency | Cost | Use Case |
|------------|-----------|---------|------|----------|
| **Kafka** | 1M+ msgs/sec | 10-50ms | $ Low | Self-hosted, high-throughput |
| **GCP Pub/Sub** | 100k+ msgs/sec | 50-100ms | $$ Medium | Google Cloud native |
| **AWS SQS+Lambda** | 10k msgs/sec | 100-500ms | $ Low | Serverless, simple |
| **AWS MSK** | 1M+ msgs/sec | 10-50ms | $$ Medium | Managed Kafka |
| **Redis Streams** | 100k msgs/sec | 1-10ms | $ Low | In-memory, low-latency |

**Recommendation for JGA OS**: **Kafka** (self-hosted) or **GCP Pub/Sub** (managed)

### **Kafka Configuration (for Production)**

```yaml
# kafka-config.yml
broker.rack: us-east-1a
num.replica.fetchers: 2
min.insync.replicas: 2

# Topics
topics:
  intakes:
    partitions: 3
    replication_factor: 3
    retention.ms: 7776000000  # 90 days
    compression.type: snappy
    
  leads:
    partitions: 5
    replication_factor: 3
    retention.ms: 2592000000  # 30 days
    
  customers:
    partitions: 10  # Per-state isolation
    replication_factor: 3
    retention.ms: 31536000000 # 1 year (compliance)
    
  projects:
    partitions: 10
    replication_factor: 3
    retention.ms: 31536000000
    
  compliance:
    partitions: 5
    replication_factor: 3
    retention.ms: 63072000000 # 2 years (audit requirement)
    
  system-events:
    partitions: 3
    replication_factor: 2
    retention.ms: 604800000  # 7 days (monitoring)
```

---

## Event Processing Patterns

### **Pattern 1: Synchronous Validation Before Publishing**

```typescript
// Spine BRIC receiving customer-created event
async function receiveCustomerEvent(event: CustomerCreatedEvent) {
  // Synchronously validate before publishing next event
  
  // 1. Check 8 System Laws (synchronous)
  const lawCheck = await checkAllLaws(event.customer_id);
  if (!lawCheck.passed) {
    // Publish blocking event
    await publishEvent("policies", {
      event_type: "policy-blocked",
      reason: lawCheck.failures,
      customer_id: event.customer_id
    });
    return; // Stop further processing
  }
  
  // 2. Publish approval event (triggers next stage)
  await publishEvent("compliance", {
    event_type: "policy-verified",
    customer_id: event.customer_id,
    laws_checked: lawCheck.passed_laws
  });
}
```

### **Pattern 2: Async Job Queue (for Long-Running Tasks)**

```typescript
// Overseer BRIC receiving policy-verified event
async function handlePolicyVerified(event: PolicyVerifiedEvent) {
  // Enqueue long-running compliance check
  
  await jobQueue.enqueue("compliance-check", {
    customer_id: event.customer_id,
    state_code: event.state_code,
    priority: "high"
  });
  
  // Return immediately (don't block)
  // Job continues in background
}

// Job worker (separate container/lambda)
async function complianceCheckWorker(job: Job) {
  const { customer_id, state_code } = job.data;
  
  // Long-running work (2-5 seconds)
  const regulations = await fetchRegulationsForState(state_code);
  const riskScore = await evaluateRisk(customer_id, regulations);
  
  // When done, publish event
  await publishEvent("compliance", {
    event_type: "compliance-evaluated",
    customer_id,
    risk_score,
    decision: riskScore < 50 ? "approved" : "blocked"
  });
  
  // Mark job complete
  job.complete();
}
```

### **Pattern 3: Event-Driven State Machine**

```typescript
// State transitions via events
const projectStateMachine = {
  "intake": {
    events: ["contract-requested"],
    next: "contract-pending"
  },
  "contract-pending": {
    events: ["contract-signed"],
    next: "contract-signed"
  },
  "contract-signed": {
    events: ["deposit-confirmed"],
    next: "active"
  },
  "active": {
    events: ["work-completed"],
    next: "production"
  },
  "production": {
    events: ["final-payment-confirmed"],
    next: "completed"
  }
};

async function transitionProject(event: Event) {
  const project = await getProject(event.project_id);
  const currentState = project.status;
  
  const allowedTransitions = projectStateMachine[currentState];
  if (!allowedTransitions.events.includes(event.event_type)) {
    throw new Error(
      `Cannot transition from ${currentState} via ${event.event_type}`
    );
  }
  
  // Transition is valid, update project
  await db.update("projects", 
    { status: allowedTransitions.next },
    { id: project.id }
  );
  
  // Emit state change event
  await publishEvent("projects", {
    event_type: "project-status-changed",
    project_id: event.project_id,
    old_status: currentState,
    new_status: allowedTransitions.next
  });
}
```

---

## Real-Time Notification System

### **WebSocket Server (for Live Updates)**

```typescript
// lib/realtime.ts
import { WebSocket } from "ws";
import { EventEmitter } from "events";

class RealtimeEngine {
  private wss: WebSocket.Server;
  private subscriptions: Map<string, Set<WebSocket>> = new Map();
  
  constructor(port: number) {
    this.wss = new WebSocket.Server({ port });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
  }
  
  private handleConnection(ws: WebSocket) {
    ws.on("message", (msg: string) => {
      try {
        const { action, channel, auth_token } = JSON.parse(msg);
        
        // Verify auth token
        const userId = this.verifyToken(auth_token);
        
        if (action === "subscribe") {
          // Subscribe to channel (e.g., "contractor:123", "admin:dashboard")
          this.subscribe(channel, ws, userId);
        } else if (action === "unsubscribe") {
          this.unsubscribe(channel, ws);
        }
      } catch (e) {
        ws.send(JSON.stringify({ error: "Invalid message" }));
      }
    });
    
    ws.on("close", () => {
      // Clean up all subscriptions for this connection
      for (const [channel, conns] of this.subscriptions.entries()) {
        conns.delete(ws);
      }
    });
  }
  
  subscribe(channel: string, ws: WebSocket, userId: string) {
    // Verify user has permission to subscribe
    if (!this.canAccessChannel(userId, channel)) {
      ws.send(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(ws);
    
    ws.send(JSON.stringify({ 
      action: "subscribed",
      channel 
    }));
  }
  
  unsubscribe(channel: string, ws: WebSocket) {
    const conns = this.subscriptions.get(channel);
    if (conns) {
      conns.delete(ws);
    }
  }
  
  // Called by event consumers
  async broadcast(channel: string, message: any) {
    const conns = this.subscriptions.get(channel);
    if (!conns) return;
    
    const payload = JSON.stringify(message);
    for (const ws of conns) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
  
  private canAccessChannel(userId: string, channel: string): boolean {
    // Example: "contractor:123" only accessible to that contractor
    const [type, id] = channel.split(":");
    if (type === "contractor" && id === userId) return true;
    if (type === "admin" && userIsAdmin(userId)) return true;
    // ... more rules
    return false;
  }
  
  private verifyToken(token: string): string {
    return jwt.verify(token, process.env.JWT_SECRET).sub;
  }
}

export const realtime = new RealtimeEngine(process.env.REALTIME_PORT || 3001);
```

### **Event Consumer to WebSocket Bridge**

```typescript
// lib/event-to-realtime.ts
import { realtime } from "./realtime";

async function consumeLeadAssignedEvent(event: LeadAssignedEvent) {
  const { contractor_id, lead_id } = event;
  
  // Notify the contractor in real-time
  await realtime.broadcast(`contractor:${contractor_id}`, {
    type: "new-lead",
    lead_id,
    timestamp: event.timestamp,
    message: `You have a new lead!`
  });
}

async function consumeProjectStatusEvent(event: ProjectStatusEvent) {
  const { project_id, customer_id, contractor_id, new_status } = event;
  
  // Notify contractor
  await realtime.broadcast(`contractor:${contractor_id}`, {
    type: "project-update",
    project_id,
    status: new_status,
    message: `Project status changed to ${new_status}`
  });
  
  // Notify admin dashboard
  await realtime.broadcast("admin:projects-list", {
    type: "project-update",
    project_id,
    status: new_status
  });
}
```

---

## Error Handling & Idempotence

### **Idempotent Event Processing**

Every event consumer must be idempotent (safe to process twice):

```typescript
async function processLeadAssignedEvent(event: LeadAssignedEvent) {
  // Step 1: Check if already processed
  const processed = await db.query(
    "SELECT 1 FROM processed_events WHERE event_id = $1",
    [event.event_id]
  );
  
  if (processed.length > 0) {
    return; // Already processed, skip
  }
  
  try {
    // Step 2: Main processing logic
    // ... create customer, project, etc.
    
    // Step 3: Mark as processed ONLY after success
    await db.query(
      "INSERT INTO processed_events (event_id, processed_at) VALUES ($1, $2)",
      [event.event_id, new Date()]
    );
  } catch (error) {
    // Don't mark as processed, will retry
    throw error;
  }
}
```

### **Dead Letter Queue (DLQ)**

For events that fail repeatedly:

```typescript
async function consumeWithDLQ(
  topic: string,
  handler: (event: Event) => Promise<void>
) {
  const consumer = kafka.consumer({ groupId: `${topic}-consumer` });
  
  consumer.subscribe({ topic });
  
  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          await handler(event);
          return; // Success
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            // Send to DLQ
            await kafka.producer().send({
              topic: `${topic}-dlq`,
              messages: [{
                key: event.event_id,
                value: JSON.stringify({
                  original_event: event,
                  error: error.message,
                  attempts,
                  timestamp: new Date()
                })
              }]
            });
          }
          // Exponential backoff before retry
          await sleep(Math.pow(2, attempts) * 1000);
        }
      }
    }
  });
}
```

---

## Monitoring & Observability

### **Key Metrics to Track**

```typescript
interface EventMetrics {
  topic: string;
  event_type: string;
  
  // Throughput
  events_per_second: number;
  messages_in_flight: number;
  
  // Latency
  processing_latency_ms: number;      // p50, p95, p99
  end_to_end_latency_ms: number;      // intake → completed
  
  // Errors
  processing_errors_rate: number;     // % of events that fail
  dlq_messages_count: number;
  
  // Lag
  consumer_lag_messages: number;
  consumer_lag_seconds: number;
}
```

### **Prometheus Metrics Export**

```typescript
import { register, Counter, Histogram, Gauge } from "prom-client";

const eventCounter = new Counter({
  name: "jga_events_total",
  help: "Total events processed",
  labelNames: ["topic", "event_type", "status"]  // status: success, error
});

const processingLatency = new Histogram({
  name: "jga_event_processing_duration_ms",
  help: "Event processing latency",
  labelNames: ["topic"],
  buckets: [10, 50, 100, 500, 1000, 5000]
});

const consumerLag = new Gauge({
  name: "jga_consumer_lag_messages",
  help: "Kafka consumer lag",
  labelNames: ["topic", "partition"]
});

// In consumer
eventCounter.labels(topic, eventType, "success").inc();
processingLatency.labels(topic).observe(duration);

// Export metrics endpoint
app.get("/metrics", (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(register.metrics());
});
```

---

## Event System Summary

```
┌─────────────────────────────────────────────────────────────┐
│  Event System (Nervous System) - Complete Architecture     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Publishers (BRICs emit events):                            │
│  ├─ Public BRIC → intakes                                  │
│  ├─ System B → leads                                       │
│  ├─ State BRIC → customers, projects, transactions          │
│  ├─ Spine BRIC → policies                                  │
│  └─ Overseer BRIC → compliance                             │
│                                                             │
│  Event Bus (Kafka/Pub-Sub):                                │
│  └─ Topics organized by domain/state                       │
│                                                             │
│  Consumers (services subscribed):                           │
│  ├─ Audit BRIC → all topics (append-only ledger)           │
│  ├─ Stitch BRIC → for signing artifacts                    │
│  ├─ Realtime Engine → WebSocket broadcasts                │
│  ├─ Notification Service → emails/SMS/webhooks             │
│  └─ Analytics Engine → dashboards                          │
│                                                             │
│  Event Ledger (immutable):                                 │
│  └─ Append-only log with Stitch signatures (Law #7)       │
│                                                             │
│  Realtime Updates:                                         │
│  └─ WebSocket subscriptions per channel                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Choose event bus technology** (Kafka, Pub/Sub, etc.)
2. **Create topic configurations** (partitioning, retention)
3. **Implement event producers** in each BRIC
4. **Implement event consumers** for each workflow
5. **Set up event ledger database** with Stitch integration
6. **Deploy realtime WebSocket server**
7. **Add monitoring & alerting**

---

**Last Updated:** March 28, 2026

**Related Documentation**:
- [DATA_FLOW.md](./DATA_FLOW.md) - End-to-end data flows
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [SUPABASE.md](./SUPABASE.md) - Database schema
