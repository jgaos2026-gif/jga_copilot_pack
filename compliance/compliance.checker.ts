import type { Brick } from '../bricks/brick.types.js';

export interface ProjectCheck {
  stateTag: string;
  status: string;
  hasSignedContract: boolean;
  depositConfirmed: boolean;
  finalPaymentConfirmed: boolean;
}

export interface ComplianceCheckResult {
  compliant: boolean;
  violations: string[];
}

export class ComplianceChecker {
  checkBrick(brick: Brick): ComplianceCheckResult {
    const violations: string[] = [];

    if (!brick.brickId) {
      violations.push('Brick is missing a brickId');
    }
    if (!brick.stateTag) {
      violations.push('Brick is missing a stateTag');
    }
    if (!brick.lifecycle) {
      violations.push('Brick is missing a lifecycle state');
    }
    if (brick.lifecycle === 'active' && !brick.metadata?.['contractSigned']) {
      violations.push(`Brick ${brick.brickId} is active but has no contractSigned metadata flag`);
    }

    return { compliant: violations.length === 0, violations };
  }

  checkProject(project: ProjectCheck): ComplianceCheckResult {
    const violations: string[] = [];

    // Rule: no active without signed contract
    if (project.status === 'active' && !project.hasSignedContract) {
      violations.push('Project cannot be active without a signed contract');
    }

    // Rule: no production without deposit
    if (project.status === 'in_production' && !project.depositConfirmed) {
      violations.push('Project cannot enter production without a confirmed deposit');
    }

    // Rule: no delivery without final payment
    if (project.status === 'delivered' && !project.finalPaymentConfirmed) {
      violations.push('Project cannot be delivered without final payment confirmed');
    }

    // Cascading: if in_production it must also have a contract
    if (project.status === 'in_production' && !project.hasSignedContract) {
      violations.push('Project cannot be in production without a signed contract');
    }

    return { compliant: violations.length === 0, violations };
  }
}

export const complianceChecker: ComplianceChecker = new ComplianceChecker();
