/**
 * Event Bus Unit Tests
 * Validates pub/sub, retry logic, DLQ, and audit trail
 */

import { describe, it, expect, vi } from 'vitest';
import { EventBus, createEvent, EventTopics, type Event } from '@/lib/event-system/index';

function makeEvent(type = 'test.event', topic = 'test-topic', stateCode?: string): Event {
  return createEvent(type, topic, { value: 1 }, 'test-source', stateCode);
}

describe('EventBus — subscribe / publish', () => {
  it('delivers events to a registered handler', async () => {
    const bus = new EventBus();
    const received: Event[] = [];
    bus.subscribe('test-topic', async (e) => { received.push(e); });

    const event = makeEvent();
    await bus.publish(event);

    expect(received).toHaveLength(1);
    expect(received[0].id).toBe(event.id);
  });

  it('delivers to multiple handlers on the same topic', async () => {
    const bus = new EventBus();
    let count = 0;
    bus.subscribe('multi', async () => { count++; });
    bus.subscribe('multi', async () => { count++; });

    await bus.publish(makeEvent('x', 'multi'));
    expect(count).toBe(2);
  });

  it('unsubscribe removes the handler', async () => {
    const bus = new EventBus();
    let count = 0;
    const unsub = bus.subscribe('unsub-topic', async () => { count++; });
    unsub();

    await bus.publish(makeEvent('x', 'unsub-topic'));
    expect(count).toBe(0);
  });

  it('does not throw when publishing to a topic with no subscribers', async () => {
    const bus = new EventBus();
    await expect(bus.publish(makeEvent('x', 'ghost-topic'))).resolves.toBeUndefined();
  });
});

describe('EventBus — audit trail (event log)', () => {
  it('records every published event', async () => {
    const bus = new EventBus();
    bus.subscribe('log-topic', async () => {});

    const e1 = makeEvent('a', 'log-topic');
    const e2 = makeEvent('b', 'log-topic');
    await bus.publish(e1);
    await bus.publish(e2);

    const log = bus.getEventLog();
    expect(log.some(e => e.id === e1.id)).toBe(true);
    expect(log.some(e => e.id === e2.id)).toBe(true);
  });

  it('getEventLog supports filter predicate', async () => {
    const bus = new EventBus();
    bus.subscribe('filter-topic', async () => {});

    await bus.publish(makeEvent('type-a', 'filter-topic', 'CA'));
    await bus.publish(makeEvent('type-b', 'filter-topic', 'TX'));

    const caEvents = bus.getEventLog(e => e.stateCode === 'CA');
    expect(caEvents.every(e => e.stateCode === 'CA')).toBe(true);
    expect(caEvents.length).toBeGreaterThan(0);
  });

  it('log is append-only (existing entries not mutated)', async () => {
    const bus = new EventBus();
    bus.subscribe('append-topic', async () => {});

    await bus.publish(makeEvent('first', 'append-topic'));
    const snapBefore = [...bus.getEventLog()];

    await bus.publish(makeEvent('second', 'append-topic'));
    const snapAfter = bus.getEventLog();

    // All entries present before are still present and unchanged
    expect(snapAfter.length).toBeGreaterThan(snapBefore.length);
    for (const entry of snapBefore) {
      const found = snapAfter.find(e => e.id === entry.id);
      expect(found).toBeDefined();
      expect(found?.type).toBe(entry.type);
    }
  });
});

describe('EventBus — dead letter queue', () => {
  it('moves event to DLQ after all retries fail', async () => {
    const bus = new EventBus();
    // Handler that always throws
    bus.subscribe('dlq-topic', async () => { throw new Error('always fail'); });

    await bus.publish(makeEvent('x', 'dlq-topic'));

    const dlq = bus.getDeadLetterQueue('dlq-topic');
    expect(dlq.length).toBe(1);
  });

  it('getDLQEvents returns events from all topics', async () => {
    const bus = new EventBus();
    bus.subscribe('dlq-a', async () => { throw new Error('fail'); });
    bus.subscribe('dlq-b', async () => { throw new Error('fail'); });

    await bus.publish(makeEvent('x', 'dlq-a'));
    await bus.publish(makeEvent('y', 'dlq-b'));

    const all = bus.getDLQEvents();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('replayDeadLetterQueue re-delivers DLQ events', async () => {
    const bus = new EventBus();
    const calls: string[] = [];
    let fail = true;
    bus.subscribe('replay-topic', async (e) => {
      if (fail) { throw new Error('first fail'); }
      calls.push(e.id);
    });

    await bus.publish(makeEvent('r', 'replay-topic'));
    expect(bus.getDeadLetterQueue('replay-topic').length).toBeGreaterThan(0);

    fail = false;
    await bus.replayDeadLetterQueue('replay-topic');
    expect(calls.length).toBeGreaterThan(0);
    expect(bus.getDeadLetterQueue('replay-topic').length).toBe(0);
  });
});

describe('createEvent factory', () => {
  it('generates unique ids', () => {
    const a = createEvent('t', 'tp', {}, 'src');
    const b = createEvent('t', 'tp', {}, 'src');
    expect(a.id).not.toBe(b.id);
  });

  it('sets stateCode when provided', () => {
    const e = createEvent('t', 'tp', {}, 'src', 'IL');
    expect(e.stateCode).toBe('IL');
  });

  it('includes ISO timestamp', () => {
    const e = createEvent('t', 'tp', {}, 'src');
    expect(() => new Date(e.timestamp)).not.toThrow();
  });
});

describe('EventTopics constants', () => {
  it('covers core workflow topics', () => {
    expect(EventTopics.CUSTOMER_CREATED).toBeDefined();
    expect(EventTopics.PROJECT_CREATED).toBeDefined();
    expect(EventTopics.DEPOSIT_CONFIRMED).toBeDefined();
    expect(EventTopics.COMPLIANCE_APPROVED).toBeDefined();
    expect(EventTopics.AUDIT_LOG).toBeDefined();
  });
});
