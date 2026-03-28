## Real-Time WebSocket API

### Overview

Real-time notification server powered by Socket.IO with automatic channel routing based on user role and state assignment. Handlers receive live updates for:
- Lead assignments (contractors)
- Project status changes (customers, admins)
- Compliance alerts (admins)
- Transaction confirmations (all roles)
- System notifications (admins, owners)

---

## Connection & Authentication

### Initial Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:8080', {
  reconnectionDelay: 1000,
  reconnection: true,
  reconnectionAttempts: 5,
  transports: ['websocket'],
});

// Wait for connection
socket.on('connect', () => {
  console.log('Connected to real-time server');
  
  // Authenticate
  socket.emit('auth', {
    userId: 'user-uuid',
    role: 'contractor',
    stateCode: 'CA',
  });
});
```

### Authentication Response

**Success:**
```json
{
  "clientId": "socket-abc123",
  "message": "Connected to real-time server"
}
```

**Failure:**
```json
{
  "message": "Invalid credentials"
}
```

---

## Auto-Subscribed Channels by Role

### Contractor
Auto-subscribed to:
- `leads-[state]` - New lead assignments for their state
- `projects-[state]` - Project updates in their state
- `contractor-[socketId]` - Personal notifications

**Example Usage:**
```javascript
socket.on('event', (data) => {
  if (data.type === 'lead_assigned') {
    console.log('New lead:', data.data);
    // Display notification, add to queue
  }
});
```

### Customer
Auto-subscribed to:
- `project-updates-[state]` - Updates on their projects
- `customer-[socketId]` - Personal notifications (invoice sent, etc.)

### Admin / Owner
Auto-subscribed to:
- `admin-updates` - Administrative notifications
- `compliance-alerts` - Compliance gate events
- `system-alerts` - System-level alerts
- `admin-[socketId]` - Personal admin notifications

---

## Manual Subscriptions

### Subscribe to Custom Topic

```javascript
socket.emit('subscribe', 'some-topic', (response) => {
  if (response.error) {
    console.error('Subscribe failed:', response.error);
  } else {
    console.log('Subscribed to', response.topic);
  }
});

socket.on('subscribed', (data) => {
  console.log('Subscription confirmed:', data.topic);
});
```

### Unsubscribe from Topic

```javascript
socket.emit('unsubscribe', 'some-topic');

socket.on('unsubscribed', (data) => {
  console.log('Unsubscribed from:', data.topic);
});
```

---

## Event Types

### Lead Events (Contractors)

**Lead Assigned:**
```json
{
  "type": "lead_assigned",
  "data": {
    "lead_id": "uuid",
    "company": "Client Corp",
    "contact": "contact@example.com",
    "phone": "+1-555-0123",
    "service_type": "legal",
    "state": "CA",
    "assigned_to": "contractor-uuid",
    "assigned_at": "2026-01-15T10:00:00Z"
  },
  "timestamp": "2026-01-15T10:00:00Z"
}
```

**Lead Status Updated:**
```json
{
  "type": "lead_status_changed",
  "data": {
    "lead_id": "uuid",
    "old_status": "pending",
    "new_status": "contacted",
    "contractor_id": "uuid"
  },
  "timestamp": "2026-01-15T10:01:30Z"
}
```

---

### Project Events (Customers, Contractors, Admins)

**Project Created:**
```json
{
  "type": "project_created",
  "data": {
    "project_id": "uuid",
    "customer_id": "uuid",
    "name": "Contract Review",
    "status": "intake",
    "created_at": "2026-01-15T10:00:00Z"
  },
  "timestamp": "2026-01-15T10:00:00Z"
}
```

**Project Status Changed:**
```json
{
  "type": "project_status_changed",
  "data": {
    "project_id": "uuid",
    "old_status": "intake",
    "new_status": "active",
    "reason": "deposit_confirmed"
  },
  "timestamp": "2026-01-15T10:30:00Z"
}
```

**Deposit Confirmed:**
```json
{
  "type": "deposit_confirmed",
  "data": {
    "project_id": "uuid",
    "customer_id": "uuid",
    "amount": 2500.00,
    "reference_id": "stripe_charge_123",
    "confirmed_at": "2026-01-15T10:15:00Z"
  },
  "timestamp": "2026-01-15T10:15:00Z"
}
```

**Contract Signed:**
```json
{
  "type": "contract_signed",
  "data": {
    "project_id": "uuid",
    "signed_by": "customer-email@example.com",
    "signed_at": "2026-01-15T11:00:00Z",
    "signature_hash": "0x..."
  },
  "timestamp": "2026-01-15T11:00:00Z"
}
```

---

### Compliance Events (Admins)

**Compliance Check Initiated:**
```json
{
  "type": "compliance_check_initiated",
  "data": {
    "project_id": "uuid",
    "check_type": "aml|sanctions|kyc",
    "initiated_at": "2026-01-15T10:00:00Z"
  },
  "timestamp": "2026-01-15T10:00:00Z"
}
```

**Compliance Alert:**
```json
{
  "type": "compliance_alert",
  "data": {
    "severity": "high|medium|low",
    "project_id": "uuid",
    "message": "Failed sanctions check",
    "action_required": true,
    "requires_mfa": true
  },
  "timestamp": "2026-01-15T10:05:00Z"
}
```

**Compliance Status Updated:**
```json
{
  "type": "compliance_status_changed",
  "data": {
    "project_id": "uuid",
    "status": "pending|approved|rejected|review",
    "reviewer_comments": "Additional documentation required",
    "reviewed_at": "2026-01-15T10:30:00Z"
  },
  "timestamp": "2026-01-15T10:30:00Z"
}
```

---

### Transaction Events (All Roles)

**Transaction Created:**
```json
{
  "type": "transaction_created",
  "data": {
    "transaction_id": "uuid",
    "project_id": "uuid",
    "customer_id": "uuid",
    "type": "deposit|payment|refund",
    "amount": 2500.00,
    "reference_id": "stripe_charge_123"
  },
  "timestamp": "2026-01-15T10:00:00Z"
}
```

**Refund Processed:**
```json
{
  "type": "refund_processed",
  "data": {
    "refund_id": "uuid",
    "project_id": "uuid",
    "amount": 2500.00,
    "reason": "customer_dispute|project_cancellation",
    "processed_at": "2026-01-15T10:00:00Z"
  },
  "timestamp": "2026-01-15T10:00:00Z"
}
```

---

### System Events (Admins, Owners)

**System Configuration Changed:**
```json
{
  "type": "system_config_changed",
  "data": {
    "key": "system.max_projects_per_customer",
    "old_value": 5,
    "new_value": 10,
    "changed_by": "owner-uuid",
    "reason": "Capacity increase for Q1"
  },
  "timestamp": "2026-01-15T10:00:00Z"
}
```

**Admin Action:**
```json
{
  "type": "admin_action",
  "data": {
    "action": "dispute_resolved|customer_disabled|project_cancelled",
    "resource_id": "uuid",
    "resource_type": "project|customer",
    "admin_id": "uuid",
    "reason": "Admin reason"
  },
  "timestamp": "2026-01-15T10:00:00Z"
}
```

**System Alert:**
```json
{
  "type": "system_alert",
  "data": {
    "severity": "critical|high|medium",
    "service": "database|api|eventbus|realtime",
    "message": "Database connection pool exhausted",
    "action_required": true
  },
  "timestamp": "2026-01-15T10:00:00Z"
}
```

---

## Event Channels Reference

### Topic-Based Channels

| Channel | Subscribers | Events |
|---------|-------------|--------|
| `global-updates` | All connected users | System announcements, maintenance windows |
| `admin-updates` | Admins, Owners | Configuration changes, actions on projects/customers |
| `compliance-alerts` | Admins, Owners | Compliance check failures, regulatory alerts |
| `system-alerts` | Admins, Owners | Service health, critical errors |

### State-Based Channels

| Channel | Subscribers | Events |
|---------|-------------|--------|
| `leads-[STATE]` | Contractors in state | New lead assignments |
| `projects-[STATE]` | Contractors, Admins in state | Project created, status changes |
| `project-updates-[STATE]` | Customers, Admins in state | Deposit confirmed, contract signed |

### Subscription Channels

| Channel | Type | Events |
|---------|------|--------|
| `contractor-[SOCKET_ID]` | Personal | Direct notifications to contractor |
| `customer-[SOCKET_ID]` | Personal | Invoices, payment confirmations |
| `admin-[SOCKET_ID]` | Personal | Direct admin notifications |

---

## Connection Management

### Graceful Reconnection

The client automatically handles reconnection:
- Exponential backoff: 1s, 2s, 4s, 8s...
- Max 5 reconnection attempts
- Resubscribes to all previous topics on reconnect
- Message buffer prevents loss during disconnect

```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Application handles offline state
});

socket.on('reconnect', () => {
  console.log('Reconnected');
  // Refresh data
});

socket.on('reconnect_failed', () => {
  console.log('Reconnection failed');
  // Switch to polling or show error
});
```

### Manual Disconnect

```javascript
socket.disconnect();
```

---

## Message Ordering & Delivery

### At-Least-Once Delivery

Events are guaranteed to be delivered at least once:
- Backed by EventBus with persistence
- Correlation IDs track event flow
- No duplicate event IDs

### Ordering Guarantees

- Events for same resource (project, customer) arrive in order
- Cross-resource events may be out of order
- Use `timestamp` field for precise ordering if needed

---

## Error Handling

### Authorization Error

```json
{
  "message": "Not authorized for this topic"
}
```

**Example:**
```javascript
socket.on('error', (data) => {
  if (data.message.includes('not authorized')) {
    // Redirect to login or show permission error
  }
});
```

### Authentication Failure

```javascript
socket.on('auth_error', (data) => {
  console.error('Auth failed:', data.message);
  // Redirect to login
});
```

---

## Performance Considerations

### Connection Pooling
- Server maintains connection pool per user role
- ~5 connections per contractor expected
- ~10 connections per admin
- Scales horizontally with Redis adapter

### Message Throughput
- ~1,000 events/second capacity per node
- Auto-scales with multiple nodes (via Redis)

### Memory Usage
- ~1KB per connected client
- ~100KB per state-level subscription

---

## Integration Example

### React Hook for Real-Time Updates

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useRealtime(userId: string, role: string, stateCode?: string) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_REALTIME_URL!, {
      transports: ['websocket'],
    });

    s.on('connect', () => {
      s.emit('auth', { userId, role, stateCode });
      setConnected(true);
    });

    s.on('auth_success', () => {
      console.log('Authenticated to real-time server');
    });

    s.on('event', (event) => {
      setEvents(prev => [event, ...prev.slice(0, 99)]);
      // Application-specific handling
      handleRealtimeEvent(event);
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(s);

    return () => s.disconnect();
  }, [userId, role, stateCode]);

  return { connected, events, socket };
}

// Usage in component
export function ContractorDashboard() {
  const { connected, events } = useRealtime(userId, 'contractor', 'CA');

  return (
    <div>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      <ul>
        {events.map(ev => (
          <li key={ev.id}>{ev.type}: {JSON.stringify(ev.data)}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Debugging

### Enable Socket.IO Debug Logs

```javascript
const socket = io(url, {
  transports: ['websocket'],
});

// In browser console:
localStorage.debug = 'socket.io-client:*';
```

### Check Active Subscriptions

**Client-side:**
```javascript
console.log('Connected:', socket.connected);
console.log('ID:', socket.id);
```

**Server-side endpoint (admin):**
```
GET /api/admin/websocket-status
Response:
{
  "connected_clients": 1250,
  "subscriptions": {
    "leads-CA": 145,
    "leads-IL": 98,
    "admin-updates": 12,
    "compliance-alerts": 12
  }
}
```

---

## Migration from Polling

If migrating from polling-based updates:

1. **Establish WebSocket connection** in `_app.tsx` or root layout
2. **Subscribe to relevant channels** based on user role
3. **Remove or disable polling queries**
4. **Handle offline scenarios** with local storage cache

```typescript
// Before: Polling every 5 seconds
const { data } = useSWR(
  connected ? `/api/projects/${projectId}` : null,
  fetcher,
  { refreshInterval: 5000 }
);

// After: Real-time updates
const { events } = useRealtime(userId, role, state);
const latestUpdate = events.find(e => e.data.project_id === projectId);
```

---

## Scaling & Deployment

### Production Setup

1. **Enable Redis Adapter** for horizontal scaling
   ```javascript
   import { createAdapter } from '@socket.io/redis-adapter';
   io.adapter(createAdapter(pubClient, subClient));
   ```

2. **Configure CORS** in deployment
   ```javascript
   new Server(httpServer, {
     cors: {
       origin: 'https://app.example.com',
       methods: ['GET', 'POST'],
     },
   });
   ```

3. **Set up load balancer** with sticky sessions
   ```nginx
   upstream websocket_backend {
     server localhost:8080;
     server localhost:8081;
     server localhost:8082;
   }
   ```

4. **Monitor connections**
   ```
   GET /metrics (Prometheus format)
   - socket_io_connections
   - socket_io_events_emitted
   - socket_io_events_received
   ```
