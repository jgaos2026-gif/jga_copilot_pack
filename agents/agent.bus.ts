import type { AgentMessage, MessageBusChannel } from './agent.types.js';

type ChannelHandler = (msg: AgentMessage) => void;

export class AgentBus {
  private messageLog: AgentMessage[] = [];
  private listeners: Map<MessageBusChannel, Set<ChannelHandler>> = new Map();

  publish(message: AgentMessage): void {
    this.messageLog.push(message);
    const handlers = this.listeners.get(message.channel);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }
  }

  subscribe(channel: MessageBusChannel, handler: ChannelHandler): void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(handler);
  }

  unsubscribe(channel: MessageBusChannel, handler: ChannelHandler): void {
    this.listeners.get(channel)?.delete(handler);
  }

  getLog(): AgentMessage[] {
    return [...this.messageLog];
  }

  clearLog(): void {
    this.messageLog = [];
  }
}

export const agentBus: AgentBus = new AgentBus();
