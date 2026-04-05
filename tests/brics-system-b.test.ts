/**
 * System B BRIC Unit Tests
 * Validates contractor onboarding, work assignment, escrow, and Law #3 enforcement
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { SystemBBric } from '@/brics/system-b/index';

const TMP_DIR = '/tmp/tests-system-b';

async function cleanup() {
  try {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

describe('SystemBBric — lead capture (Law #3: no sensitive data)', () => {
  let bric: SystemBBric;

  beforeEach(async () => {
    await cleanup();
    bric = new SystemBBric({ baseDir: TMP_DIR });
  });

  afterEach(cleanup);

  it('captureLeadFromPublic stores lead with minimal metadata', async () => {
    const lead = await bric.captureLeadFromPublic('alice@example.com', 'Alice', 'CA', 'contractor');
    expect(lead.email).toBe('alice@example.com');
    expect(lead.name).toBe('Alice');
    expect(lead.state).toBe('CA');
    expect(lead.capturedAt).toBeGreaterThan(0);
  });

  it('persists lead to disk', async () => {
    await bric.captureLeadFromPublic('bob@example.com', 'Bob', 'TX', 'employee');
    const filePath = `${TMP_DIR}/lead-bob@example.com.json`;
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.email).toBe('bob@example.com');
  });
});

describe('SystemBBric — contractor provisioning', () => {
  let bric: SystemBBric;

  beforeEach(async () => {
    await cleanup();
    bric = new SystemBBric({ baseDir: TMP_DIR });
  });

  afterEach(cleanup);

  it('provisionContractor creates a pending account from existing lead', async () => {
    await bric.captureLeadFromPublic('carol@example.com', 'Carol', 'IL', 'contractor');
    const account = await bric.provisionContractor('carol@example.com');
    expect(account.id).toBeDefined();
    expect(account.status).toBe('pending');
    expect(account.trainingCompleted).toBe(false);
    expect(account.stateBricId).toBe('state-il');
  });

  it('provisionContractor throws when lead does not exist', async () => {
    await expect(bric.provisionContractor('nobody@example.com')).rejects.toThrow(/Lead not found/);
  });

  it('completeTraining sets account to active', async () => {
    await bric.captureLeadFromPublic('dave@example.com', 'Dave', 'NY', 'contractor');
    const account = await bric.provisionContractor('dave@example.com');
    const updated = await bric.completeTraining(account.id);
    expect(updated.trainingCompleted).toBe(true);
    expect(updated.status).toBe('active');
  });
});

describe('SystemBBric — work assignment routing', () => {
  let bric: SystemBBric;
  let contractorId: string;

  beforeEach(async () => {
    await cleanup();
    bric = new SystemBBric({ baseDir: TMP_DIR });
    await bric.captureLeadFromPublic('eve@example.com', 'Eve', 'CA', 'contractor');
    const account = await bric.provisionContractor('eve@example.com');
    contractorId = account.id;
    await bric.completeTraining(contractorId);
  });

  afterEach(cleanup);

  it('assignWork routes to correct state BRIC', async () => {
    const assignment = await bric.assignWork(contractorId, 'proj-abc');
    expect(assignment.stateBricId).toBe('state-ca');
    expect(assignment.projectId).toBe('proj-abc');
    expect(assignment.status).toBe('pending');
  });

  it('assignWork throws if training not completed', async () => {
    // New contractor without training
    await bric.captureLeadFromPublic('frank@example.com', 'Frank', 'TX', 'contractor');
    const account = await bric.provisionContractor('frank@example.com');
    await expect(bric.assignWork(account.id, 'proj-xyz')).rejects.toThrow(/training not completed/);
  });
});

describe('SystemBBric — escrow milestones', () => {
  let bric: SystemBBric;
  let contractorId: string;
  let assignmentId: string;

  beforeEach(async () => {
    await cleanup();
    bric = new SystemBBric({ baseDir: TMP_DIR });
    await bric.captureLeadFromPublic('grace@example.com', 'Grace', 'CA', 'contractor');
    const account = await bric.provisionContractor('grace@example.com');
    contractorId = account.id;
    await bric.completeTraining(contractorId);
    const assignment = await bric.assignWork(contractorId, 'proj-001');
    assignmentId = assignment.id;
  });

  afterEach(cleanup);

  it('createEscrowMilestone holds funds', async () => {
    const milestone = await bric.createEscrowMilestone(contractorId, assignmentId, 500);
    expect(milestone.status).toBe('held');
    expect(milestone.amount).toBe(500);
  });

  it('releasePayment marks milestone as released', async () => {
    const milestone = await bric.createEscrowMilestone(contractorId, assignmentId, 750);
    const released = await bric.releasePayment(milestone.id);
    expect(released.status).toBe('released');
  });
});

describe('SystemBBric — Law #3 enforcement', () => {
  afterEach(cleanup);

  it('bulkExport always throws (Law #3)', async () => {
    const bric = new SystemBBric({ baseDir: TMP_DIR });
    await expect(bric.bulkExport()).rejects.toThrow(/DENIED/);
  });

  it('auditSystemBBoundaries returns ok=true for clean assignments', async () => {
    const bric = new SystemBBric({ baseDir: TMP_DIR });
    await bric.captureLeadFromPublic('henry@example.com', 'Henry', 'CA', 'contractor');
    const account = await bric.provisionContractor('henry@example.com');
    await bric.completeTraining(account.id);
    await bric.assignWork(account.id, 'proj-clean');

    const audit = await bric.auditSystemBBoundaries();
    expect(audit.ok).toBe(true);
    expect(audit.violations).toHaveLength(0);
  });
});
