#!/usr/bin/env node
/**
 * JGA Enterprise OS — CLI Entrypoint
 *
 * Usage:
 *   npx ts-node bin/jga.ts <command>
 *
 * Commands:
 *   setup              First-time setup: validate env, check dependencies
 *   dev                Start the development server (next dev)
 *   compliance:check   Run the compliance gate check
 *   ops:run            Run scheduled operations in dry-run mode (safe by default)
 */

import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2];

// ---------------------------------------------------------------------------
// Command: setup
// ---------------------------------------------------------------------------

async function cmdSetup(): Promise<void> {
  console.log('🔧 JGA Enterprise OS — Setup\n');

  // 1. Check Node version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (major < 18) {
    console.error(`❌ Node.js >= 18 required. Current: ${nodeVersion}`);
    process.exit(1);
  }
  console.log(`✅ Node.js version: ${nodeVersion}`);

  // 2. Check .env.example exists
  if (!existsSync(join(ROOT, '.env.example'))) {
    console.error('❌ .env.example not found. Repository may be incomplete.');
    process.exit(1);
  }
  console.log('✅ .env.example found');

  // 3. Check .env exists (warn if not)
  if (!existsSync(join(ROOT, '.env'))) {
    console.warn('⚠️  .env not found. Copy .env.example to .env and fill in values before running in production.');
  } else {
    console.log('✅ .env found');
  }

  // 4. Check node_modules
  if (!existsSync(join(ROOT, 'node_modules'))) {
    console.log('📦 Installing dependencies...');
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
  } else {
    console.log('✅ node_modules present');
  }

  // 5. Run compliance check
  console.log('\n🔐 Running compliance check...');
  try {
    execSync('npm run compliance:check', { cwd: ROOT, stdio: 'inherit' });
  } catch {
    console.error('❌ Compliance check failed. Address violations before proceeding.');
    process.exit(1);
  }

  console.log('\n✅ Setup complete. Run `npm run dev` to start the development server.');
}

// ---------------------------------------------------------------------------
// Command: dev
// ---------------------------------------------------------------------------

async function cmdDev(): Promise<void> {
  console.log('🚀 Starting JGA Enterprise OS development server...\n');
  const child = spawn('npx', ['next', 'dev'], { cwd: ROOT, stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code ?? 0));
}

// ---------------------------------------------------------------------------
// Command: compliance:check
// ---------------------------------------------------------------------------

async function cmdComplianceCheck(): Promise<void> {
  try {
    execSync('npx ts-node --esm scripts/compliance-check.ts', { cwd: ROOT, stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Command: ops:run
// ---------------------------------------------------------------------------

interface OpsContext {
  dryRun: boolean;
  stateTag: string;
}

async function cmdOpsRun(): Promise<void> {
  const dryRun = !process.argv.includes('--live');
  const stateTag = process.argv.find((a) => a.startsWith('--state='))?.split('=')[1] ?? 'ALL';

  const ctx: OpsContext = { dryRun, stateTag };

  console.log(`⚙️  JGA Enterprise OS — Ops Run`);
  console.log(`   Mode:  ${dryRun ? 'DRY-RUN (safe, no mutations)' : '⚠️  LIVE (mutations enabled)'}`);
  console.log(`   State: ${stateTag}\n`);

  // Scheduled operations skeleton
  const ops = [
    { name: 'Verify Stitch Brick integrity (all active BRICs)', fn: opVerifyIntegrity },
    { name: 'Check compliance artifact expiry', fn: opCheckComplianceArtifact },
    { name: 'Sweep pending payment intents (> 24h)', fn: opSweepPendingPayments },
    { name: 'Export audit log snapshot to Owners Room', fn: opExportAuditSnapshot },
    { name: 'Run dependency vulnerability scan', fn: opVulnerabilityScan },
  ];

  for (const op of ops) {
    try {
      await op.fn(ctx);
      console.log(`  ✅ ${op.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ ${op.name}: ${message}`);
    }
  }

  console.log(`\n✅ Ops run complete (${dryRun ? 'dry-run' : 'live'})`);
}

// ---------------------------------------------------------------------------
// Scheduled operation stubs
// ---------------------------------------------------------------------------

async function opVerifyIntegrity(ctx: OpsContext): Promise<void> {
  // TODO: iterate over active State BRICs and call VERA agent to verify hashes
  if (ctx.dryRun) return; // no mutations in dry-run
}

async function opCheckComplianceArtifact(_ctx: OpsContext): Promise<void> {
  // TODO: load current compliance artifact, check expiry, alert if near expiry
}

async function opSweepPendingPayments(ctx: OpsContext): Promise<void> {
  // TODO: query payment intents older than 24h in pending state, escalate to Owners Room
  if (ctx.dryRun) return;
}

async function opExportAuditSnapshot(ctx: OpsContext): Promise<void> {
  // TODO: generate read-only audit snapshot, write to Owners Room store
  if (ctx.dryRun) return;
}

async function opVulnerabilityScan(_ctx: OpsContext): Promise<void> {
  // Run npm audit (informational only in dry-run)
  try {
    execSync('npm audit --audit-level=high', { cwd: ROOT, stdio: 'pipe' });
  } catch {
    throw new Error('npm audit found high/critical vulnerabilities. Review before live ops.');
  }
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  switch (command) {
    case 'setup':
      await cmdSetup();
      break;
    case 'dev':
      await cmdDev();
      break;
    case 'compliance:check':
      await cmdComplianceCheck();
      break;
    case 'ops:run':
      await cmdOpsRun();
      break;
    default:
      console.log(`JGA Enterprise OS CLI

Usage: npx ts-node bin/jga.ts <command>

Commands:
  setup              First-time setup: validate env, check dependencies
  dev                Start the development server
  compliance:check   Run the compliance gate check
  ops:run            Run scheduled operations (dry-run by default)
                     --live    Enable live mode (mutations enabled)
                     --state=  Filter to specific state tag (e.g. IL-01)
`);
      process.exit(0);
  }
}

main().catch((err: unknown) => {
  console.error('CLI error:', err);
  process.exit(1);
});
