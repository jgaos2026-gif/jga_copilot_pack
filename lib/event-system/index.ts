/**
 * Event Bus Implementation
 * Core pub/sub infrastructure for inter-BRIC communication
 * Implements the Nervous System layer
 */

export interface Event {
  id: string;
  type: string;
  topic: string;
  timestamp: string;
  sourceId: string;
  data: Record<string, any>;
  stateCode?: string;
  correlationId?: string;
  merkleRoot?: string; // For Stitch-signed events
  signature?: string; // Digital signature from Stitch
}

export interface EventHandler {
  (event: Event): Promise<void>;
}

export interface EventTopic {
  name: string;
  handlers: EventHandler[];
  deadLetterQueue?: Event[];
}

/**
 * EventBus - Core pub/sub for system events
 * Implements at-least-once delivery with DLQ support
 */
export class EventBus {
  private topics: Map<string, EventTopic> = new Map();
  private eventLog: Event[] = []; // Audit trail
  private maxDLQSize = 1000;

  /**
   * Subscribe to topic with handler
   */
  subscribe(topic: string, handler: EventHandler): () => void {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, { name: topic, handlers: [], deadLetterQueue: [] });
    }

    const topicData = this.topics.get(topic)!;
    topicData.handlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = topicData.handlers.indexOf(handler);
      if (index > -1) {
        topicData.handlers.splice(index, 1);
      }
    };
  }

  /**
   * Publish event to topic with retry logic
   */
  async publish(event: Event): Promise<void> {
    // Log event to immutable trail
    this.eventLog.push(event);

    const topic = this.topics.get(event.topic);
    if (!topic) {
      console.warn(`No topic registered for: ${event.topic}`);
      return;
    }

    // Process all handlers with retry logic
    for (const handler of topic.handlers) {
      try {
        await this.executeWithRetry(handler, event, 3);
      } catch (error) {
        console.error(`Handler failed for event ${event.id}:`, error);
        this.pushToDeadLetterQueue(topic, event);
      }
    }
  }

  /**
   * Execute handler with exponential backoff retry
   */
  private async executeWithRetry(
    handler: EventHandler,
    event: Event,
    maxRetries: number,
    attempt = 0
  ): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(handler, event, maxRetries, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Push failed event to dead letter queue
   */
  private pushToDeadLetterQueue(topic: EventTopic, event: Event): void {
    if (!topic.deadLetterQueue) {
      topic.deadLetterQueue = [];
    }

    topic.deadLetterQueue.push(event);

    // Keep DLQ size bounded
    if (topic.deadLetterQueue.length > this.maxDLQSize) {
      topic.deadLetterQueue.shift();
    }

    // Log to audit
    console.error(`Event ${event.id} moved to DLQ for topic ${topic.name}`);
  }

  /**
   * Get DLQ for topic (ops/debugging)
   */
  getDeadLetterQueue(topic: string): Event[] {
    return this.topics.get(topic)?.deadLetterQueue || [];
  }

  /**
   * Get all DLQ events across all topics (ops/debugging)
   */
  getDLQEvents(): Event[] {
    const allDLQ: Event[] = [];
    for (const topicData of this.topics.values()) {
      if (topicData.deadLetterQueue) {
        allDLQ.push(...topicData.deadLetterQueue);
      }
    }
    return allDLQ;
  }

  /**
   * Replay DLQ events (manual recovery)
   */
  async replayDeadLetterQueue(topic: string): Promise<number> {
    const topicData = this.topics.get(topic);
    if (!topicData?.deadLetterQueue) return 0;

    const dlq = [...topicData.deadLetterQueue];
    topicData.deadLetterQueue = [];

    let successCount = 0;
    for (const event of dlq) {
      try {
        await this.publish(event);
        successCount++;
      } catch (error) {
        console.error(`Failed to replay event ${event.id}:`, error);
        this.pushToDeadLetterQueue(topicData, event);
      }
    }

    return successCount;
  }

  /**
   * Get event log (for testing/audit)
   */
  getEventLog(filter?: (e: Event) => boolean): Event[] {
    return filter ? this.eventLog.filter(filter) : this.eventLog;
  }
}

/**
 * Global event bus instance
 */
export const eventBus = new EventBus();

/**
 * Event factories for consistency
 */
export const createEvent = (
  type: string,
  topic: string,
  data: Record<string, any>,
  sourceId: string,
  stateCode?: string
): Event => ({
  id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  type,
  topic,
  timestamp: new Date().toISOString(),
  sourceId,
  data,
  stateCode,
});

/**
 * Event type definitions (Nervous System topics)
 */
export const EventTopics = {
  // Public BRIC events
  INTAKE_CREATED: 'intakes',
  LEAD_ASSIGNED: 'leads',
  LEAD_COMPLETED: 'leads',

  // State BRIC events
  CUSTOMER_CREATED: 'customer-events',
  CUSTOMER_UPDATED: 'customer-events',
  PROJECT_CREATED: 'project-events',
  PROJECT_ACTIVATED: 'project-events',
  CONTRACT_SIGNED: 'contract-events',
  DEPOSIT_CONFIRMED: 'project-events',
  WORK_COMPLETED: 'project-events',

  // Spine BRIC events
  POLICY_VERIFIED: 'policy-events',
  POLICY_BLOCKED: 'policy-events',

  // Compliance BRIC events
  COMPLIANCE_APPROVED: 'compliance-events',
  COMPLIANCE_BLOCKED: 'compliance-events',

  // Stitch BRIC events
  MERKLE_ROOT_VERIFIED: 'stitch-events',
  CORRUPTION_DETECTED: 'stitch-events',
  HEALING_COMPLETE: 'stitch-events',

  // Owners Room events
  ADMIN_ACTION: 'admin-events',
  SYSTEM_CONFIG_CHANGED: 'admin-events',

  // Audit/Internal
  AUDIT_LOG: 'audit-log',
};
