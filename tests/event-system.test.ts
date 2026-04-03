/**
 * Event System Tests
 * Tests for EventBus pub/sub, append-only event log (Law #7), retry logic,
 * dead-letter queue, DLQ replay, createEvent factory, and EventTopics constants.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EventBus,
  createEvent,
  Event,
  EventTopics,
} from '../lib/event-system';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(type: string, topic: string, data: Record<string, unknown> = {}): Event {
  return createEvent(type, topic, data, 'test-source');
}

// ---------------------------------------------------------------------------
// EventBus – subscribe / publish
// ---------------------------------------------------------------------------

describe('EventBus – subscribe and publish', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('delivers an event to a single subscriber', async () => {
    const received: Event[] = [];
    bus.subscribe('topic-a', async (e) => {
      received.push(e);
    });

    const event = makeEvent('CUSTOMER_CREATED', 'topic-a', { id: '123' });
    await bus.publish(event);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('CUSTOMER_CREATED');
    expect(received[0].data.id).toBe('123');
  });

  it('delivers an event to multiple subscribers on the same topic', async () => {
    const log: number[] = [];
    bus.subscribe('multi-topic', async () => log.push(1));
    bus.subscribe('multi-topic', async () => log.push(2));

    await bus.publish(makeEvent('T', 'multi-topic'));

    expect(log).toContain(1);
    expect(log).toContain(2);
    expect(log).toHaveLength(2);
  });

  it('does not deliver to subscribers on a different topic', async () => {
    const received: Event[] = [];
    bus.subscribe('other-topic', async (e) => received.push(e));

    await bus.publish(makeEvent('T', 'target-topic'));

    expect(received).toHaveLength(0);
  });

  it('unsubscribe stops future deliveries', async () => {
    const received: Event[] = [];
    const unsub = bus.subscribe('unsub-topic', async (e) => received.push(e));

    unsub();
    await bus.publish(makeEvent('T', 'unsub-topic'));

    expect(received).toHaveLength(0);
  });

  it('only unsubscribes the specific handler, leaving others intact', async () => {
    const log: number[] = [];
    const unsub1 = bus.subscribe('partial-unsub', async () => log.push(1));
    bus.subscribe('partial-unsub', async () => log.push(2));

    unsub1();
    await bus.publish(makeEvent('T', 'partial-unsub'));

    expect(log).not.toContain(1);
    expect(log).toContain(2);
  });

  it('publishes to an unregistered topic without throwing', async () => {
    await expect(bus.publish(makeEvent('T', 'nonexistent-topic'))).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// EventBus – event log / append-only ledger (Law #7)
// ---------------------------------------------------------------------------

describe('EventBus – append-only event log (Law #7)', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('appends every published event to the log', async () => {
    const e1 = makeEvent('EVT_A', 'log-topic');
    const e2 = makeEvent('EVT_B', 'log-topic');
    await bus.publish(e1);
    await bus.publish(e2);

    const log = bus.getEventLog();
    expect(log).toHaveLength(2);
    expect(log[0].type).toBe('EVT_A');
    expect(log[1].type).toBe('EVT_B');
  });

  it('logs events even when there are no subscribers', async () => {
    const event = makeEvent('ORPHAN', 'no-handlers');
    await bus.publish(event);

    expect(bus.getEventLog()).toHaveLength(1);
    expect(bus.getEventLog()[0].id).toBe(event.id);
  });

  it('getEventLog with a filter does not mutate the original log', async () => {
    await bus.publish(makeEvent('TYPE_A', 't'));
    await bus.publish(makeEvent('TYPE_B', 't'));

    const filtered = bus.getEventLog((e) => e.type === 'TYPE_A');

    expect(filtered).toHaveLength(1);
    expect(bus.getEventLog()).toHaveLength(2); // original unchanged
  });

  it('preserves event order (append-only guarantee)', async () => {
    for (let i = 0; i < 5; i++) {
      await bus.publish(makeEvent(`EVT_${i}`, 'ordered'));
    }

    const types = bus.getEventLog().map((e) => e.type);
    expect(types).toEqual(['EVT_0', 'EVT_1', 'EVT_2', 'EVT_3', 'EVT_4']);
  });

  it('logged events reference the original event objects', async () => {
    const event = makeEvent('REFERENCE', 'ref-topic');
    await bus.publish(event);

    expect(bus.getEventLog()[0]).toBe(event);
  });
});

// ---------------------------------------------------------------------------
// EventBus – retry logic and dead-letter queue
// ---------------------------------------------------------------------------

describe('EventBus – retry and dead-letter queue', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('retries a failing handler 3 times (4 total calls) before sending to DLQ', async () => {
    let callCount = 0;
    bus.subscribe('retry-topic', async () => {
      callCount++;
      throw new Error('transient error');
    });

    const event = makeEvent('T', 'retry-topic');
    await bus.publish(event);

    // 1 initial attempt + 3 retries = 4 total calls
    expect(callCount).toBe(4);
    const dlq = bus.getDeadLetterQueue('retry-topic');
    expect(dlq).toHaveLength(1);
    expect(dlq[0].id).toBe(event.id);
  }, 10_000);

  it('does not add a successful event to the DLQ', async () => {
    bus.subscribe('success-topic', async () => { /* no-op */ });

    await bus.publish(makeEvent('T', 'success-topic'));

    expect(bus.getDeadLetterQueue('success-topic')).toHaveLength(0);
  });

  it('returns an empty array for a topic with no DLQ entries', () => {
    expect(bus.getDeadLetterQueue('unknown-topic')).toEqual([]);
  });

  it('accumulates multiple failed events in the DLQ', async () => {
    bus.subscribe('dlq-multi', async () => {
      throw new Error('always fails');
    });

    await bus.publish(makeEvent('T', 'dlq-multi'));
    await bus.publish(makeEvent('T', 'dlq-multi'));

    expect(bus.getDeadLetterQueue('dlq-multi')).toHaveLength(2);
  }, 15_000);

  it('successful handler does not affect DLQ even after a previous failure', async () => {
    let callCount = 0;
    bus.subscribe('mixed-topic', async () => {
      callCount++;
      if (callCount <= 4) throw new Error('initial failures');
      // succeeds on replay
    });

    const event = makeEvent('T', 'mixed-topic');
    await bus.publish(event);
    expect(bus.getDeadLetterQueue('mixed-topic')).toHaveLength(1);

    // On replay the handler succeeds (callCount now > 4)
    const replayed = await bus.replayDeadLetterQueue('mixed-topic');
    expect(replayed).toBe(1);
    expect(bus.getDeadLetterQueue('mixed-topic')).toHaveLength(0);
  }, 15_000);

  it('replayDeadLetterQueue returns 0 for a topic with an empty DLQ', async () => {
    const count = await bus.replayDeadLetterQueue('empty-dlq-topic');
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// createEvent factory
// ---------------------------------------------------------------------------

describe('createEvent', () => {
  it('produces an event with all required fields', () => {
    const e = createEvent('project_created', 'project-events', { project_id: 'p-1' }, 'state-bric-ca', 'CA');

    expect(e.id).toMatch(/^evt_/);
    expect(e.type).toBe('project_created');
    expect(e.topic).toBe('project-events');
    expect(e.data.project_id).toBe('p-1');
    expect(e.sourceId).toBe('state-bric-ca');
    expect(e.stateCode).toBe('CA');
    expect(new Date(e.timestamp).getTime()).not.toBeNaN();
  });

  it('generates unique IDs for each call', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createEvent('T', 't', {}, 'src').id));
    expect(ids.size).toBe(20);
  });

  it('stateCode is optional and defaults to undefined', () => {
    const e = createEvent('T', 't', {}, 'src');
    expect(e.stateCode).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// EventTopics constants
// ---------------------------------------------------------------------------

describe('EventTopics', () => {
  it('maps CUSTOMER_CREATED to customer-events topic', () => {
    expect(EventTopics.CUSTOMER_CREATED).toBe('customer-events');
  });

  it('maps CUSTOMER_UPDATED to customer-events topic', () => {
    expect(EventTopics.CUSTOMER_UPDATED).toBe('customer-events');
  });

  it('maps PROJECT_CREATED to project-events topic', () => {
    expect(EventTopics.PROJECT_CREATED).toBe('project-events');
  });

  it('maps CONTRACT_SIGNED to contract-events topic', () => {
    expect(EventTopics.CONTRACT_SIGNED).toBe('contract-events');
  });

  it('maps AUDIT_LOG to audit-log topic', () => {
    expect(EventTopics.AUDIT_LOG).toBe('audit-log');
  });

  it('maps MERKLE_ROOT_VERIFIED to stitch-events topic', () => {
    expect(EventTopics.MERKLE_ROOT_VERIFIED).toBe('stitch-events');
  });
});
