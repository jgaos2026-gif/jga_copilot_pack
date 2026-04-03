import type { Brick } from '../bricks/brick.types.js';
import type { BrickService } from '../bricks/brick.service.js';

export function seedBricks(service: BrickService): Brick[] {
  const illinois = service.createBrick({
    brickType: 'PolicyBrick',
    stateTag: 'IL-01',
    name: 'Illinois Client Policy',
    description:
      'Defines client engagement policies, acceptable payment methods, and SLA commitments for Illinois jurisdiction.',
    metadata: { jurisdiction: 'Illinois', effectiveYear: new Date().getFullYear() },
  });

  const texasLedger = service.createBrick({
    brickType: 'LedgerBrick',
    stateTag: 'TX-44',
    name: 'Texas Revenue Ledger',
    description:
      'Append-only ledger tracking all revenue events, deposits, and final payments for Texas-based projects.',
    metadata: { jurisdiction: 'Texas', currency: 'USD' },
  });

  const federalContract = service.createBrick({
    brickType: 'ContractBrick',
    stateTag: 'US-FED',
    name: 'Federal Contract Template',
    description:
      'Master contract template governing all federal and multi-state engagements. ATTORNEY REVIEW REQUIRED before activation.',
    metadata: { reviewRequired: true, lastReviewedBy: null },
  });

  const cfoAgent = service.createBrick({
    brickType: 'AgentBrick',
    stateTag: 'IL-01',
    name: 'CFO Agent',
    description:
      'Autonomous financial oversight agent responsible for revenue reconciliation, flagging anomalies, and producing weekly compliance health reports.',
    metadata: { role: 'CFO', autonomyLevel: 'supervised', maxSingleActionUSD: 500 },
  });

  const projectProcess = service.createBrick({
    brickType: 'ProcessBrick',
    stateTag: 'TX-44',
    name: 'Project Lifecycle Process',
    description:
      'Defines the end-to-end project state machine: intake → deposit_pending → active → in_production → delivered → closed.',
    metadata: {
      states: ['intake', 'deposit_pending', 'active', 'in_production', 'delivered', 'closed'],
      requiresDepositBeforeProduction: true,
      requiresContractBeforeActive: true,
    },
  });

  return [illinois, texasLedger, federalContract, cfoAgent, projectProcess];
}
