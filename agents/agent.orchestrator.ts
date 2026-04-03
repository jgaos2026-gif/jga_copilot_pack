import { randomUUID } from 'crypto';
import type { AgentDefinition, AgentMessage, AgentRole } from './agent.types.js';
import { agentBus, type AgentBus } from './agent.bus.js';

export interface RouteResult {
  routed: boolean;
  escalated: boolean;
  reason?: string;
}

export class AgentOrchestrator {
  private agents: Map<AgentRole, AgentDefinition>;

  constructor(
    private bus: AgentBus,
    agents: AgentDefinition[],
  ) {
    this.agents = new Map(agents.map((a) => [a.role, a]));
  }

  routeMessage(message: AgentMessage): RouteResult {
    const fromRole = message.fromAgent === 'Owner' ? null : (message.fromAgent as AgentRole);
    const agent = fromRole ? this.agents.get(fromRole) : null;

    if (fromRole && !agent) {
      return { routed: false, escalated: false, reason: `Unknown agent role: ${fromRole}` };
    }

    if (fromRole && agent && !this.validateAuthority(fromRole, message.action)) {
      const escalated = this.escalate(message, `Action '${message.action}' not in authority scope for ${fromRole}`);
      return { routed: false, escalated, reason: `Action '${message.action}' is not permitted for ${fromRole}` };
    }

    const amount = typeof message.payload['amount'] === 'number' ? message.payload['amount'] : 0;
    if (agent && amount > agent.escalationThreshold) {
      const escalated = this.escalate(message, `Amount ${amount} exceeds escalation threshold ${agent.escalationThreshold} for ${fromRole}`);
      return { routed: true, escalated, reason: `Amount exceeds threshold; escalated` };
    }

    this.bus.publish(message);
    return { routed: true, escalated: false };
  }

  getAgentByRole(role: AgentRole): AgentDefinition | undefined {
    return this.agents.get(role);
  }

  validateAuthority(fromAgent: AgentRole | 'Owner', action: string): boolean {
    if (fromAgent === 'Owner') return true;
    const agent = this.agents.get(fromAgent);
    if (!agent) return false;
    if (agent.authorityScope.cannotDo.includes(action)) return false;
    return agent.authorityScope.canDo.includes(action);
  }

  private escalate(originalMessage: AgentMessage, reason: string): boolean {
    const escalationMsg: AgentMessage = {
      messageId: randomUUID(),
      fromAgent: originalMessage.fromAgent,
      toAgent: 'Owner',
      channel: 'escalation',
      action: 'escalation_required',
      payload: {
        originalMessage,
        reason,
      },
      timestamp: new Date().toISOString(),
      requiresApproval: true,
    };
    this.bus.publish(escalationMsg);
    return true;
  }
}

// Singleton — agents register themselves at startup
export const agentOrchestrator: AgentOrchestrator = new AgentOrchestrator(agentBus, []);
