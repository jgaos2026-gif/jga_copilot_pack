import { randomUUID } from 'crypto';
import { auditLog, type AuditLog } from './audit-log.js';
import { escalationEngine, type EscalationEngine } from './escalation.js';
import { approvalQueue, type ApprovalQueue } from './approvals.js';
import { agentBus, type AgentBus } from '../agents/agent.bus.js';

export interface RuntimeAction {
  actor: string;
  type: string;
  brickId: string;
  jurisdiction: string;
  amount?: number;
  payload: Record<string, unknown>;
}

export interface RuntimeResult {
  success: boolean;
  escalated: boolean;
  approvalRequired: boolean;
  result?: unknown;
}

export class RuntimeOrchestrator {
  constructor(
    private log: AuditLog,
    private escalation: EscalationEngine,
    private approvals: ApprovalQueue,
    private bus: AgentBus,
  ) {}

  processAction(action: RuntimeAction): RuntimeResult {
    const amount = action.amount ?? 0;

    // TODO: agent role lookup could be expanded once session context is available
    const escalationResult = this.escalation.evaluate(action.type, amount, 'AdminAgent');

    let approvalRequired = false;
    let escalated = false;

    if (escalationResult.escalate) {
      escalated = true;
      approvalRequired = escalationResult.requiresHuman;

      this.approvals.enqueue({
        requestedBy: action.actor,
        action: action.type,
        amount,
        brickId: action.brickId,
      });

      this.bus.publish({
        messageId: randomUUID(),
        fromAgent: 'Owner',
        toAgent: 'AdminAgent',
        channel: 'escalation',
        action: 'approval_required',
        payload: {
          actorId: action.actor,
          actionType: action.type,
          brickId: action.brickId,
          amount,
          reason: escalationResult.reason,
        },
        timestamp: new Date().toISOString(),
        requiresApproval: true,
      });
    }

    const entry = this.log.append({
      actor: action.actor,
      action: action.type,
      brickId: action.brickId,
      jurisdiction: action.jurisdiction,
      amount: action.amount,
      metadata: {
        escalated,
        approvalRequired,
        payload: action.payload,
      },
    });

    return {
      success: true,
      escalated,
      approvalRequired,
      result: entry,
    };
  }
}

export const runtimeOrchestrator: RuntimeOrchestrator = new RuntimeOrchestrator(
  auditLog,
  escalationEngine,
  approvalQueue,
  agentBus,
);
