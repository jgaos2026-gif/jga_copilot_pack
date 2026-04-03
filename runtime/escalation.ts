import type { AgentRole } from '../agents/agent.types.js';

export interface EscalationRule {
  ruleId: string;
  description: string;
  threshold: number;
  requiresHuman: boolean;
  agentRole: AgentRole | 'any';
}

export interface EscalationResult {
  escalate: boolean;
  requiresHuman: boolean;
  reason: string;
}

const rules: EscalationRule[] = [
  {
    ruleId: 'rule-human-500',
    description: 'Any amount >= $500 requires human approval',
    threshold: 500,
    requiresHuman: true,
    agentRole: 'any',
  },
  {
    ruleId: 'rule-admin-100',
    description: 'Amount >= $100 requires AdminAgent approval',
    threshold: 100,
    requiresHuman: false,
    agentRole: 'AdminAgent',
  },
  {
    ruleId: 'rule-self-approve',
    description: 'Amount < $100 may be self-approved by the acting agent',
    threshold: 0,
    requiresHuman: false,
    agentRole: 'any',
  },
];

export class EscalationEngine {
  evaluate(action: string, amount: number, agentRole: AgentRole): EscalationResult {
    if (amount >= 500) {
      return {
        escalate: true,
        requiresHuman: true,
        reason: `Amount $${amount} >= $500 threshold; human approval required for action '${action}'`,
      };
    }

    if (amount >= 100) {
      return {
        escalate: true,
        requiresHuman: false,
        reason: `Amount $${amount} >= $100 threshold; AdminAgent approval required for action '${action}' by ${agentRole}`,
      };
    }

    return {
      escalate: false,
      requiresHuman: false,
      reason: `Amount $${amount} < $100; ${agentRole} may self-approve action '${action}'`,
    };
  }

  getRules(): EscalationRule[] {
    return [...rules];
  }
}

export const escalationEngine: EscalationEngine = new EscalationEngine();
