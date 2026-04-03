import { randomUUID } from 'crypto';
import type { Brick } from '../bricks/brick.types.js';
import { complianceChecker } from './compliance.checker.js';

export interface Project {
  projectId: string;
  stateTag: string;
  status: string;
  hasSignedContract: boolean;
  depositConfirmed: boolean;
  finalPaymentConfirmed: boolean;
}

export interface ComplianceReport {
  reportId: string;
  generatedAt: string;
  period: string;
  bricksChecked: number;
  violations: string[];
  overallStatus: 'green' | 'yellow' | 'red';
}

export class ComplianceReporter {
  generate(bricks: Brick[], projects: Project[]): ComplianceReport {
    const violations: string[] = [];

    for (const brick of bricks) {
      const result = complianceChecker.checkBrick(brick);
      violations.push(...result.violations);
    }

    for (const project of projects) {
      const result = complianceChecker.checkProject(project);
      violations.push(...result.violations);
    }

    const totalChecked = bricks.length + projects.length;
    let overallStatus: 'green' | 'yellow' | 'red';

    if (violations.length === 0) {
      overallStatus = 'green';
    } else if (violations.length <= 3) {
      overallStatus = 'yellow';
    } else {
      overallStatus = 'red';
    }

    return {
      reportId: randomUUID(),
      generatedAt: new Date().toISOString(),
      period: this.currentPeriod(),
      bricksChecked: totalChecked,
      violations,
      overallStatus,
    };
  }

  formatReport(report: ComplianceReport): string {
    const lines: string[] = [
      `===== JGA COMPLIANCE REPORT =====`,
      `Report ID : ${report.reportId}`,
      `Generated : ${report.generatedAt}`,
      `Period    : ${report.period}`,
      `Status    : ${report.overallStatus.toUpperCase()}`,
      `Items Checked: ${report.bricksChecked}`,
      `Violations   : ${report.violations.length}`,
      ``,
    ];

    if (report.violations.length > 0) {
      lines.push('--- VIOLATIONS ---');
      report.violations.forEach((v, i) => lines.push(`  ${i + 1}. ${v}`));
    } else {
      lines.push('No violations found.');
    }

    lines.push('');
    lines.push('=================================');
    return lines.join('\n');
  }

  private currentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const week = Math.ceil(
      (now.getDate() + new Date(year, now.getMonth(), 1).getDay()) / 7,
    );
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
}

export const complianceReporter: ComplianceReporter = new ComplianceReporter();
