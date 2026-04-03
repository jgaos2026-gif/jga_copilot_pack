import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';

import { calculateAdjustedPrice } from '../lib/pricing';
import { ComplianceChecker } from '../compliance/compliance.checker';
import { BrickService } from '../bricks/brick.service';
import { StitchService } from '../stitch/stitch.service';
import { billIntake } from '../billing/bill.intake';
import { billPay } from '../billing/bill.pay';
import { auditLog } from '../runtime/audit-log';
import { AgentOrchestrator } from '../agents/agent.orchestrator';
import { AgentBus } from '../agents/agent.bus';
import { agentDef as cfoDef } from '../agents/cfo.agent';
import { agentDef as vendorPayDef } from '../agents/vendor-pay.agent';

describe('JGA Business Rules', () => {
  // ─── 1. Intake creates client and project correctly ───────────────────────
  it('intake creates a ProcessBrick project with all required fields', () => {
    const brickSvc = new BrickService([]);
    const brick = brickSvc.createBrick({
      brickType: 'ProcessBrick',
      stateTag: 'IL-01',
      name: 'New Client Project Intake',
      description: 'Intake record for a new graphic-arts project',
    });

    expect(brick.brickId).toBeTruthy();
    expect(brick.brickType).toBe('ProcessBrick');
    expect(brick.stateTag).toBe('IL-01');
    expect(brick.lifecycle).toBe('draft');
    expect(brick.version).toBe(1);
    expect(brick.createdAt).toBeTruthy();
    expect(brick.name).toBe('New Client Project Intake');
  });

  // ─── 2. Pricing endpoint returns calculated quote ─────────────────────────
  it('calculateAdjustedPrice returns the correct adjusted price', () => {
    const price = calculateAdjustedPrice({
      basePrice: 500,
      demandMultiplier: 1.1,
      urgencyMultiplier: 1,
      loadFactor: 1.05,
    });
    expect(price).toBe(577.5);
  });

  // ─── 3. Project cannot enter active without signed contract ───────────────
  it('ComplianceChecker flags active project without signed contract', () => {
    const checker = new ComplianceChecker();
    const result = checker.checkProject({
      stateTag: 'IL-01',
      status: 'active',
      hasSignedContract: false,
      depositConfirmed: true,
      finalPaymentConfirmed: false,
    });
    expect(result.compliant).toBe(false);
    expect(result.violations.some((v) => /contract/i.test(v))).toBe(true);
  });

  // ─── 4. Project cannot begin production without deposit ───────────────────
  it('ComplianceChecker flags in_production project without deposit', () => {
    const checker = new ComplianceChecker();
    const result = checker.checkProject({
      stateTag: 'IL-01',
      status: 'in_production',
      hasSignedContract: true,
      depositConfirmed: false,
      finalPaymentConfirmed: false,
    });
    expect(result.compliant).toBe(false);
    expect(result.violations.some((v) => /deposit/i.test(v))).toBe(true);
  });

  // ─── 5. Final delivery is blocked until final payment ─────────────────────
  it('ComplianceChecker blocks delivery without final payment confirmed', () => {
    const checker = new ComplianceChecker();
    const result = checker.checkProject({
      stateTag: 'TX-44',
      status: 'delivered',
      hasSignedContract: true,
      depositConfirmed: true,
      finalPaymentConfirmed: false,
    });
    expect(result.compliant).toBe(false);
    expect(result.violations.some((v) => /final payment/i.test(v))).toBe(true);
  });

  // ─── 6. Contractor cannot mutate pricing or policy data ───────────────────
  it('VendorPayAgent cannot perform modify_pricing_policy', () => {
    const bus = new AgentBus();
    const orchestrator = new AgentOrchestrator(bus, [vendorPayDef, cfoDef]);
    expect(orchestrator.validateAuthority('VendorPayAgent', 'modify_pricing_policy')).toBe(false);
  });

  // ─── 7. Ledger event is written on payment ────────────────────────────────
  it('BillPay.pay() appends a bill_paid audit entry', () => {
    // Create and approve a bill via the shared singletons
    const bill = billIntake.receive({
      vendorName: 'Offset Ink Co',
      amount: 150,
      dueDate: '2026-06-01',
      stateTag: 'TX-44',
    });
    billIntake.updateBill(bill.billId, { status: 'approved' });

    const countBefore = auditLog.getAll().length;
    billPay.pay(bill.billId, 'owner');
    const entries = auditLog.getAll();

    expect(entries.length).toBeGreaterThan(countBefore);
    const payEntry = entries.find((e) => e.action === 'bill_paid' && e.brickId === bill.billId);
    expect(payEntry).toBeDefined();
    expect(payEntry?.actor).toBe('owner');
  });

  // ─── 8. Brick append-only — getBrickHistory returns multiple versions ──────
  it('BrickService keeps all versions in history after updates', () => {
    const brickSvc = new BrickService([]);
    const brick = brickSvc.createBrick({
      brickType: 'LedgerBrick',
      stateTag: 'US-FED',
      name: 'Ledger Entry 001',
      description: 'Initial ledger brick',
    });

    brickSvc.updateBrick({
      brickId: brick.brickId,
      lifecycle: 'active',
      description: 'Updated ledger brick',
    });

    const history = brickSvc.getBrickHistory(brick.brickId);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].version).toBe(1);
    expect(history[1].version).toBe(2);
  });

  // ─── 9. Stitch link validation rejects orphan edges ───────────────────────
  it('StitchService throws when targetId does not exist', () => {
    const knownId = randomUUID();
    const ghostId = randomUUID();
    const stitchSvc = new StitchService(() => [knownId]);

    expect(() =>
      stitchSvc.createLink({
        linkType: 'owns',
        sourceId: knownId,
        targetId: ghostId,
      }),
    ).toThrow(/Target brick not found/);
  });

  // ─── 10. Agent cannot act outside its authority scope ─────────────────────
  it('CFOAgent cannot perform delete_ledger_entry', () => {
    const bus = new AgentBus();
    const orchestrator = new AgentOrchestrator(bus, [cfoDef, vendorPayDef]);
    expect(orchestrator.validateAuthority('CFOAgent', 'delete_ledger_entry')).toBe(false);
  });
});
