/**
 * Compliance Agent Unit Tests
 * Validates regulation ingestion, artifact generation, and compliance gate (Law #6)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { ComplianceAgent } from '@/brics/spine/compliance-agent';

const TMP_DIR = '/tmp/tests-compliance-agent';

async function cleanup() {
  try {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

describe('ComplianceAgent — regulation ingestion', () => {
  let agent: ComplianceAgent;

  beforeEach(async () => {
    await cleanup();
    agent = new ComplianceAgent({ baseDir: TMP_DIR });
  });

  afterEach(cleanup);

  it('ingestRegulation stores and returns the regulation', async () => {
    const reg = await agent.ingestRegulation(
      'NIST SP 800-53',
      'NIST',
      'Security controls baseline',
      'rev5'
    );
    expect(reg.id).toBeDefined();
    expect(reg.title).toBe('NIST SP 800-53');
    expect(reg.source).toBe('NIST');
  });

  it('checkRegulatoryUpdates returns true after ingesting a regulation', async () => {
    await agent.ingestRegulation('OWASP Top 10', 'OWASP', 'Web security risks', '2023');
    const hasUpdates = await agent.checkRegulatoryUpdates();
    expect(hasUpdates).toBe(true);
  });
});

describe('ComplianceAgent — artifact generation and gate (Law #6)', () => {
  let agent: ComplianceAgent;

  beforeEach(async () => {
    await cleanup();
    agent = new ComplianceAgent({ baseDir: TMP_DIR });
  });

  afterEach(cleanup);

  it('gate is closed (not approved) on fresh construction', () => {
    const state = agent.getComplianceState();
    expect(state.approved).toBe(false);
    expect(state.artifact).toBeUndefined();
  });

  it('generateArtifact sets approved=true', async () => {
    await agent.ingestRegulation('NIST', 'NIST', 'desc', '1.0');
    await agent.generateComplianceArtifact();
    const state = agent.getComplianceState();
    expect(state.approved).toBe(true);
    expect(state.artifact).toBeDefined();
    expect(state.artifact!.status).toBe('APPROVED');
  });

  it('verifyArtifact returns ok=true for a valid artifact', async () => {
    await agent.ingestRegulation('NIST', 'NIST', 'desc', '1.0');
    await agent.generateComplianceArtifact();
    const result = await agent.verifyComplianceGate();
    expect(result.ok).toBe(true);
  });

  it('revokeCompliance sets approved=false and artifact status to REVOKED', async () => {
    await agent.ingestRegulation('NIST', 'NIST', 'desc', '1.0');
    await agent.generateComplianceArtifact();
    await agent.revokeCompliance('violation detected in test');
    const state = agent.getComplianceState();
    expect(state.approved).toBe(false);
    expect(state.artifact!.status).toBe('REVOKED');
  });

  it('verifyArtifact returns error when no artifact exists', async () => {
    const result = await agent.verifyComplianceGate();
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('ComplianceAgent — auditComplianceGate', () => {
  afterEach(cleanup);

  it('lists no-artifact as a violation', async () => {
    const agent = new ComplianceAgent({ baseDir: TMP_DIR });
    const audit = await agent.auditComplianceGate();
    // No artifact means violations present
    expect(audit.violations.length).toBeGreaterThan(0);
  });

  it('returns ok=true when artifact exists and all tests passed', async () => {
    const agent = new ComplianceAgent({ baseDir: TMP_DIR });
    await agent.ingestRegulation('NIST', 'NIST', 'desc', '1.0');
    await agent.generateComplianceArtifact();
    const audit = await agent.auditComplianceGate();
    expect(audit.ok).toBe(true);
  });
});
