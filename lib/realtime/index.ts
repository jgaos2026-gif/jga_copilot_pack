/**
 * Real-time WebSocket Server
 * Handles live notifications for contractors, customers, and admins
 */

import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { eventBus, Event } from '@/lib/event-system';

export interface WebSocketClient {
  userId: string;
  role: 'contractor' | 'customer' | 'admin' | 'owner';
  stateCode?: string;
  connectedAt: number;
}

/**
 * Real-time notification server
 */
export class RealtimeServer {
  private io: Server;
  private clients: Map<string, WebSocketClient> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // topic -> clientIds

  constructor(port: number = 8080) {
    const httpServer = createServer();
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
    });

    this.setupEventHandlers();
    this.subscribeToEventBus();

    httpServer.listen(port, () => {
      console.log(`Real-time server listening on port ${port}`);
    });
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Authentication
      socket.on('auth', (data: any) => {
        this.handleAuth(socket, data);
      });

      // Subscribe to updates
      socket.on('subscribe', (topic: string) => {
        this.handleSubscribe(socket, topic);
      });

      // Unsubscribe
      socket.on('unsubscribe', (topic: string) => {
        this.handleUnsubscribe(socket, topic);
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle client authentication
   */
  private handleAuth(socket: Socket, data: any): void {
    try {
      const { userId, role, stateCode } = data;

      if (!userId || !role) {
        socket.emit('auth_error', { message: 'Invalid credentials' });
        return;
      }

      // Store client info
      this.clients.set(socket.id, {
        userId,
        role,
        stateCode,
        connectedAt: Date.now(),
      });

      socket.emit('auth_success', {
        clientId: socket.id,
        message: 'Connected to real-time server',
      });

      // Auto-subscribe to relevant topics based on role
      this.autoSubscribe(socket, role, stateCode);
    } catch (error) {
      console.error('Auth error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  }

  /**
   * Auto-subscribe based on role
   */
  private autoSubscribe(socket: Socket, role: string, stateCode?: string): void {
    // All users get general updates
    socket.join('global-updates');

    if (role === 'contractor') {
      // Contractors get leads + project updates for their state
      socket.join(`leads-${stateCode}`);
      socket.join(`projects-${stateCode}`);
      socket.join(`contractor-${socket.id}`); // Personal channel
    } else if (role === 'customer') {
      // Customers get project + transaction updates
      socket.join(`project-updates-${stateCode}`);
      socket.join(`customer-${socket.id}`);
    } else if (role === 'admin' || role === 'owner') {
      // Admins/owners get all updates
      socket.join('admin-updates');
      socket.join('compliance-alerts');
      socket.join('system-alerts');
      socket.join(`admin-${socket.id}`);
    }
  }

  /**
   * Handle topic subscription
   */
  private handleSubscribe(socket: Socket, topic: string): void {
    const client = this.clients.get(socket.id);
    if (!client) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Authorization check based on role/state
    const canSubscribe = this.checkSubscriptionAuth(client, topic);
    if (!canSubscribe) {
      socket.emit('error', { message: 'Not authorized for this topic' });
      return;
    }

    socket.join(topic);

    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(socket.id);

    socket.emit('subscribed', { topic });
  }

  /**
   * Handle unsubscribe
   */
  private handleUnsubscribe(socket: Socket, topic: string): void {
    socket.leave(topic);

    const subs = this.subscriptions.get(topic);
    if (subs) {
      subs.delete(socket.id);
    }

    socket.emit('unsubscribed', { topic });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: Socket): void {
    this.clients.delete(socket.id);

    // Clean up subscriptions
    for (const [topic, clients] of this.subscriptions.entries()) {
      clients.delete(socket.id);
      if (clients.size === 0) {
        this.subscriptions.delete(topic);
      }
    }

    console.log(`Client disconnected: ${socket.id}`);
  }

  /**
   * Check if client can subscribe to topic
   */
  private checkSubscriptionAuth(client: WebSocketClient, topic: string): boolean {
    if (client.role === 'owner') return true; // Owners see all

    if (topic.includes('admin') || topic.includes('compliance')) {
      return client.role === 'admin' || client.role === 'owner';
    }

    if (topic.includes(client.stateCode || '')) {
      return true; // Can subscribe to state-specific topics
    }

    return false;
  }

  /**
   * Subscribe to event bus and broadcast to clients
   */
  private subscribeToEventBus(): void {
    // Listen for all events
    const allTopics = [
      'intakes',
      'leads',
      'customer-events',
      'project-events',
      'policy-events',
      'compliance-events',
      'admin-events',
    ];

    for (const topic of allTopics) {
      eventBus.subscribe(topic, async (event: Event) => {
        await this.broadcastEvent(event);
      });
    }
  }

  /**
   * Broadcast event to relevant clients
   */
  private async broadcastEvent(event: Event): Promise<void> {
    let targetChannels: string[] = [];

    // Route event to appropriate channels based on type
    switch (event.topic) {
      case 'intakes':
        targetChannels = ['admin-updates', 'system-alerts'];
        break;

      case 'leads':
        targetChannels = [
          `leads-${event.stateCode}`,
          'admin-updates',
          `contractor-${event.data.contractor_id}`,
        ];
        break;

      case 'customer-events':
        targetChannels = [
          `project-updates-${event.stateCode}`,
          'admin-updates',
        ];
        break;

      case 'project-events':
        targetChannels = [
          `projects-${event.stateCode}`,
          `customer-${event.data.customer_id}`,
          `project-updates-${event.stateCode}`,
          'admin-updates',
        ];
        break;

      case 'compliance-events':
        targetChannels = ['compliance-alerts', 'admin-updates'];
        break;

      case 'policy-events':
        targetChannels = ['system-alerts', 'admin-updates'];
        break;

      default:
        targetChannels = ['global-updates'];
    }

    // Broadcast to all channels
    for (const channel of targetChannels.filter(Boolean)) {
      this.io.to(channel).emit('event', {
        type: event.type,
        data: event.data,
        timestamp: event.timestamp,
      });
    }
  }

  /**
   * Send direct message to specific client
   */
  public sendToClient(clientId: string, message: any): void {
    this.io.to(clientId).emit('message', message);
  }

  /**
   * Send notification to all users with role
   */
  public notifyRole(role: string, message: any): void {
    const clients = Array.from(this.clients.entries())
      .filter(([, client]) => client.role === role)
      .map(([id]) => id);

    for (const clientId of clients) {
      this.io.to(clientId).emit('notification', message);
    }
  }

  /**
   * Get connected clients count
   */
  public getConnectedCount(): number {
    return this.clients.size;
  }

  /**
   * Get active subscriptions
   */
  public getSubscriptions(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [topic, clients] of this.subscriptions.entries()) {
      result[topic] = clients.size;
    }
    return result;
  }
}

/**
 * Global realtime server instance
 */
export let realtimeServer: RealtimeServer;

/**
 * Initialize realtime server
 */
export function initializeRealtimeServer(port?: number): RealtimeServer {
  if (!realtimeServer) {
    realtimeServer = new RealtimeServer(port);
  }
  return realtimeServer;
}
