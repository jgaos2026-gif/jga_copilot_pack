import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus, EventTopics, createEvent } from '@/lib/event-system';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('EventBus', () => {
  it('delivers events to subscribers and allows unsubscribe', async () => {
    const bus = new EventBus();
    const handler = vi.fn(async () => {});
    const unsubscribe = bus.subscribe(EventTopics.LEAD_ASSIGNED, handler);

    await bus.publish(
      createEvent('lead.assigned', EventTopics.LEAD_ASSIGNED, { leadId: 'lead-1' }, 'orion', 'IL-01')
    );
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    await bus.publish(
      createEvent('lead.assigned', EventTopics.LEAD_ASSIGNED, { leadId: 'lead-2' }, 'orion', 'IL-01')
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(bus.getEventLog()).toHaveLength(2);
    expect(bus.getEventLog((event) => event.data.leadId === 'lead-1')).toHaveLength(1);
  });

  it('retries handlers before moving to DLQ', async () => {
    vi.useFakeTimers();
    const bus = new EventBus();
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValue(undefined);

    bus.subscribe(EventTopics.PROJECT_ACTIVATED, handler);

    const publishPromise = bus.publish(
      createEvent(
        'project.activated',
        EventTopics.PROJECT_ACTIVATED,
        { projectId: 'proj-1', customer_id: 'cust-1' },
        'orion',
        'TX-44'
      )
    );

    await vi.runAllTimersAsync();
    await publishPromise;

    expect(handler).toHaveBeenCalledTimes(3);
    expect(bus.getDeadLetterQueue(EventTopics.PROJECT_ACTIVATED)).toHaveLength(0);
  });

  it('moves permanently failing handlers to DLQ', async () => {
    vi.useFakeTimers();
    const bus = new EventBus();
    const handler = vi.fn().mockRejectedValue(new Error('permanent-failure'));

    bus.subscribe(EventTopics.POLICY_BLOCKED, handler);
    const event = createEvent(
      'policy.blocked',
      EventTopics.POLICY_BLOCKED,
      { gateId: 'GATE-01' },
      'vera',
      'IL-01'
    );

    const publishPromise = bus.publish(event);
    await vi.runAllTimersAsync();
    await publishPromise;

    expect(handler).toHaveBeenCalledTimes(4); // initial + 3 retries
    expect(bus.getDeadLetterQueue(EventTopics.POLICY_BLOCKED)).toEqual([event]);
  });

  it('replays DLQ events when handlers recover', async () => {
    vi.useFakeTimers();
    const bus = new EventBus();
    const topic = EventTopics.CUSTOMER_UPDATED;
    const failingHandler = vi.fn().mockRejectedValue(new Error('temporary'));
    const unsubscribeFailing = bus.subscribe(topic, failingHandler);
    const event = createEvent(
      'customer.updated',
      topic,
      { customer_id: 'cust-99', state: 'IL-01' },
      'state-bric',
      'IL-01'
    );

    const publishPromise = bus.publish(event);
    await vi.runAllTimersAsync();
    await publishPromise;
    expect(bus.getDeadLetterQueue(topic)).toHaveLength(1);

    unsubscribeFailing();
    vi.useRealTimers();

    const recoveringHandler = vi.fn(async () => {});
    bus.subscribe(topic, recoveringHandler);

    const replayed = await bus.replayDeadLetterQueue(topic);
    expect(replayed).toBe(1);
    expect(recoveringHandler).toHaveBeenCalledTimes(1);
    expect(bus.getDeadLetterQueue(topic)).toHaveLength(0);
  });
});
