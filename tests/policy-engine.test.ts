/**
 * Policy Engine Tests
 * Validates the core compliance gates defined in SYSTEM_CONSTITUTION.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine, type PolicyContext } from '@/lib/policy-engine/index';

// Load the default policies JSON directly so tests don't depend on file system path resolution
import defaultPolicies from '@/lib/policy-engine/policies/default.json';

function makeEngine(): PolicyEngine {
  const engine = new PolicyEngine();
  engine.loadPolicies(defaultPolicies as Parameters<PolicyEngine['loadPolicies']>[0]);
  return engine;
}

function ownerContext(extras: Record<string, unknown> = {}): PolicyContext {
  return {
    actorId: 'owner-1',
    actorRole: 'owner',
    bricId: 'owners-room',
    extras,
  };
}

function contractorContext(extras: Record<string, unknown> = {}): PolicyContext {
  return {
    actorId: 'contractor-1',
    actorRole: 'contractor',
    bricId: 'state-il',
    extras,
  };
}

describe('Policy Engine — GATE-01: project.set_active', () => {
  let engine: PolicyEngine;
  beforeEach(() => { engine = makeEngine(); });

  it('denies when contract_signed is false', () => {
    const result = engine.validate('project.set_active', ownerContext({ contract_signed: false }));
    expect(result.allow).toBe(false);
    expect(result.gateId).toBe('GATE-01');
  });

  it('denies when contract_signed is missing', () => {
    const result = engine.validate('project.set_active', ownerContext({}));
    expect(result.allow).toBe(false);
  });

  it('allows when contract_signed is true', () => {
    const result = engine.validate('project.set_active', ownerContext({ contract_signed: true }));
    expect(result.allow).toBe(true);
  });
});

describe('Policy Engine — GATE-02: project.start_production', () => {
  let engine: PolicyEngine;
  beforeEach(() => { engine = makeEngine(); });

  it('denies when deposit_confirmed is false', () => {
    const result = engine.validate('project.start_production', ownerContext({ deposit_confirmed: false }));
    expect(result.allow).toBe(false);
    expect(result.gateId).toBe('GATE-02');
  });

  it('allows when deposit_confirmed is true', () => {
    const result = engine.validate('project.start_production', ownerContext({ deposit_confirmed: true }));
    expect(result.allow).toBe(true);
  });
});

describe('Policy Engine — GATE-03: project.deliver_final', () => {
  let engine: PolicyEngine;
  beforeEach(() => { engine = makeEngine(); });

  it('denies when final_payment_cleared is false', () => {
    const result = engine.validate('project.deliver_final', ownerContext({ final_payment_cleared: false }));
    expect(result.allow).toBe(false);
    expect(result.gateId).toBe('GATE-03');
  });

  it('allows when final_payment_cleared is true', () => {
    const result = engine.validate('project.deliver_final', ownerContext({ final_payment_cleared: true }));
    expect(result.allow).toBe(true);
  });
});

describe('Policy Engine — GATE-04: business.outbound_call', () => {
  let engine: PolicyEngine;
  beforeEach(() => { engine = makeEngine(); });

  it('denies when compliance_artifact_valid is false', () => {
    const result = engine.validate('business.outbound_call', ownerContext({ compliance_artifact_valid: false }));
    expect(result.allow).toBe(false);
    expect(result.gateId).toBe('GATE-04');
  });

  it('allows when compliance_artifact_valid is true', () => {
    const result = engine.validate('business.outbound_call', ownerContext({ compliance_artifact_valid: true }));
    expect(result.allow).toBe(true);
  });
});

describe('Policy Engine — GATE-05: bric.activate_state', () => {
  let engine: PolicyEngine;
  beforeEach(() => { engine = makeEngine(); });

  it('denies for non-owner even with compliance approval', () => {
    const ctx: PolicyContext = {
      actorId: 'admin-1',
      actorRole: 'admin',
      bricId: 'owners-room',
      extras: { compliance_agent_approved: true },
    };
    const result = engine.validate('bric.activate_state', ctx);
    expect(result.allow).toBe(false);
    expect(result.gateId).toBe('GATE-05');
  });

  it('denies for owner without compliance approval', () => {
    const result = engine.validate('bric.activate_state', ownerContext({ compliance_agent_approved: false }));
    expect(result.allow).toBe(false);
  });

  it('allows for owner with compliance approval', () => {
    const result = engine.validate('bric.activate_state', ownerContext({ compliance_agent_approved: true }));
    expect(result.allow).toBe(true);
  });
});

describe('Policy Engine — GATE-07: pricing.serve_quote', () => {
  let engine: PolicyEngine;
  beforeEach(() => { engine = makeEngine(); });

  it('denies when source is not pricing-engine', () => {
    const result = engine.validate('pricing.serve_quote', ownerContext({ source: 'frontend-hardcoded' }));
    expect(result.allow).toBe(false);
    expect(result.gateId).toBe('GATE-07');
  });

  it('allows when source is pricing-engine', () => {
    const result = engine.validate('pricing.serve_quote', ownerContext({ source: 'pricing-engine' }));
    expect(result.allow).toBe(true);
  });
});

describe('Policy Engine — GATE-08: audit.write', () => {
  let engine: PolicyEngine;
  beforeEach(() => { engine = makeEngine(); });

  it('denies DELETE operation on audit log', () => {
    const result = engine.validate('audit.write', ownerContext({ operation: 'DELETE' }));
    expect(result.allow).toBe(false);
    expect(result.gateId).toBe('GATE-08');
  });

  it('denies UPDATE operation on audit log', () => {
    const result = engine.validate('audit.write', ownerContext({ operation: 'UPDATE' }));
    expect(result.allow).toBe(false);
  });

  it('allows INSERT operation on audit log', () => {
    const result = engine.validate('audit.write', ownerContext({ operation: 'INSERT' }));
    expect(result.allow).toBe(true);
  });

  it('allows append operation on audit log', () => {
    const result = engine.validate('audit.write', ownerContext({ operation: 'append' }));
    expect(result.allow).toBe(true);
  });
});

describe('Policy Engine — Contractor restrictions', () => {
  let engine: PolicyEngine;
  beforeEach(() => { engine = makeEngine(); });

  it('denies contractor from editing pricing', () => {
    const result = engine.validate('pricing.edit', contractorContext());
    expect(result.allow).toBe(false);
  });

  it('allows owner to edit pricing', () => {
    const result = engine.validate('pricing.edit', ownerContext());
    expect(result.allow).toBe(true);
  });

  it('denies contractor from editing contract terms', () => {
    const result = engine.validate('contract.edit_terms', contractorContext());
    expect(result.allow).toBe(false);
  });

  it('allows admin to edit contract terms', () => {
    const ctx: PolicyContext = { actorId: 'admin-1', actorRole: 'admin', bricId: 'owners-room' };
    const result = engine.validate('contract.edit_terms', ctx);
    expect(result.allow).toBe(true);
  });

  it('denies contractor from editing payout rules', () => {
    const result = engine.validate('payout.edit_rules', contractorContext());
    expect(result.allow).toBe(false);
  });
});

describe('Policy Engine — fail-closed default', () => {
  let engine: PolicyEngine;
  beforeEach(() => { engine = makeEngine(); });

  it('denies unknown actions by default (fail-closed)', () => {
    const result = engine.validate('nonexistent.action', ownerContext());
    expect(result.allow).toBe(false);
    expect(result.requiresEscalation).toBe(true);
  });
});
