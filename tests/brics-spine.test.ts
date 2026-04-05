/**
 * Spine BRIC Unit Tests
 * Validates system laws, policy rules, and AI constraints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { Spine } from '@/brics/spine/index';

const TMP_DIR = '/tmp/tests-brics-spine';

async function cleanup() {
  try {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

describe('Spine — system laws', () => {
  let spine: Spine;

  beforeEach(() => {
    spine = new Spine({ baseDir: TMP_DIR });
  });

  afterEach(cleanup);

  it('initializes all 8 system laws on construction', () => {
    const laws = spine.getAllSystemLaws();
    expect(laws).toHaveLength(8);
  });

  it('getSystemLaw returns correct law by id', () => {
    const law1 = spine.getSystemLaw('law-1');
    expect(law1).not.toBeNull();
    expect(law1!.title).toContain('Unidirectional');
  });

  it('getSystemLaw returns null for unknown id', () => {
    // @ts-expect-error testing invalid input
    expect(spine.getSystemLaw('law-99')).toBeNull();
  });

  it('every law has an enforcedAt field (auditLawEnforcement passes)', async () => {
    const audit = await spine.auditLawEnforcement();
    expect(audit.ok).toBe(true);
    expect(audit.unenforced).toHaveLength(0);
  });
});

describe('Spine — AI constraints', () => {
  let spine: Spine;

  beforeEach(() => {
    spine = new Spine({ baseDir: TMP_DIR });
  });

  it('addAIConstraint stores and returns constraint', () => {
    const c = spine.addAIConstraint(
      'No bulk export',
      'Never export all records at once',
      'blocking',
      ['ava', 'orion']
    );
    expect(c.id).toBeDefined();
    expect(spine.getAIConstraints().some(x => x.id === c.id)).toBe(true);
  });

  it('getAIConstraints returns all stored constraints', () => {
    spine.addAIConstraint('Rule A', 'desc', 'advisory', []);
    spine.addAIConstraint('Rule B', 'desc', 'warning', []);
    expect(spine.getAIConstraints().length).toBeGreaterThanOrEqual(2);
  });
});

describe('Spine — policy rule evaluation', () => {
  let spine: Spine;

  beforeEach(() => {
    spine = new Spine({ baseDir: TMP_DIR });
  });

  it('allow rule grants access when condition matches', () => {
    spine.addPolicyRule('Allow admin', (ctx) => ctx.role === 'admin', 'allow', 10);
    const result = spine.evaluateRules({ role: 'admin' });
    expect(result.allowed).toBe(true);
  });

  it('deny rule blocks access when condition matches', () => {
    spine.addPolicyRule('Block contractor', (ctx) => ctx.role === 'contractor', 'deny', 10);
    const result = spine.evaluateRules({ role: 'contractor' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Block contractor');
  });

  it('higher priority deny beats lower priority allow', () => {
    spine.addPolicyRule('Allow all', () => true, 'allow', 1);
    spine.addPolicyRule('Block contractor', (ctx) => ctx.role === 'contractor', 'deny', 100);
    const result = spine.evaluateRules({ role: 'contractor' });
    expect(result.allowed).toBe(false);
  });

  it('returns allowed=true when no rules match', () => {
    const fresh = new Spine({ baseDir: TMP_DIR });
    const result = fresh.evaluateRules({ role: 'nobody' });
    expect(result.allowed).toBe(true);
  });
});

describe('Spine — violation logging', () => {
  afterEach(cleanup);

  it('logViolation persists to disk', async () => {
    const spine = new Spine({ baseDir: TMP_DIR });
    await spine.logViolation('law-1', 'test violation detail');

    const law = spine.getSystemLaw('law-1');
    expect(law!.violations).toContain('test violation detail');
  });
});

describe('Spine — exportPolicySnapshot', () => {
  it('returns snapshot with all system laws', async () => {
    const spine = new Spine({ baseDir: TMP_DIR });
    const snapshot = await spine.exportPolicySnapshot();
    expect(snapshot.systemLaws.length).toBe(8);
    expect(typeof snapshot.timestamp).toBe('number');
  });
});
