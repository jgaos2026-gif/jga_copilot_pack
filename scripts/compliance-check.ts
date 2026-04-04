#!/usr/bin/env node
/**
 * JGA Enterprise OS — Compliance Check Script
 *
 * Validates that the repository meets all governance and compliance requirements:
 *   1. Required governance documents exist with required sections.
 *   2. All compliance gates have corresponding policy rules.
 *   3. No hardcoded secrets detected (basic scan).
 *   4. Audit logging interface is present in billing/payment code.
 *
 * Exit code 0 = PASS, non-zero = FAIL.
 * Run via: npm run compliance:check
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Required governance documents and their required section markers
// ---------------------------------------------------------------------------

const REQUIRED_DOCS: { path: string; requiredSections: string[] }[] = [
  {
    path: 'SYSTEM_CONSTITUTION.md',
    requiredSections: [
      '## Article I',
      '## Article II',
      '## Article III',
      '## Article IV',
      '## Article V',
      '## Article VI',
    ],
  },
  {
    path: 'CODE_OF_CONDUCT.md',
    requiredSections: [
      '## Our Pledge',
      '## Standards of Behavior',
      '## Reporting Violations',
      '## Enforcement',
    ],
  },
  {
    path: 'SECTIONAL_LAWS.md',
    requiredSections: [
      '## Section 1',
      '## Section 2',
      '## Section 3',
      '## Section 4',
      '## Section 5',
      '## Section 6',
    ],
  },
  {
    path: 'AGENTS.md',
    requiredSections: [
      '## 1. Agent Roster',
      '## 2. Chain of Command',
      '## 3. Inter-Agent Communication',
      '## 4. Mandatory Logging',
    ],
  },
  {
    path: 'ARCHITECTURE_BRICKS_STITCH.md',
    requiredSections: [
      '## 1. Brick System Overview',
      '## 2. Brick Boundaries',
      '## 3. Stitch Brick Tech Data System',
      '## 4. Compliance Gates',
    ],
  },
];

// ---------------------------------------------------------------------------
// Required policy gate IDs
// ---------------------------------------------------------------------------

const REQUIRED_GATE_IDS = [
  'GATE-01',
  'GATE-02',
  'GATE-03',
  'GATE-04',
  'GATE-05',
  'GATE-06',
  'GATE-07',
  'GATE-08',
];

// ---------------------------------------------------------------------------
// Secret patterns (basic — not a replacement for a dedicated secret scanner)
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'AWS Secret Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'Stripe Secret Key', pattern: /sk_live_[0-9a-zA-Z]{24}/ },
  { name: 'Generic password in assignment', pattern: /password\s*=\s*['"][^'"]{8,}['"]/ },
  { name: 'Hardcoded JWT secret', pattern: /jwt[_-]?secret\s*[:=]\s*['"][^'"]{16,}['"]/i },
];

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
const SCAN_EXCLUDE = ['node_modules', '.next', 'dist', '.git', 'lib/policy-engine/policies'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readDoc(relativePath: string): string | null {
  const fullPath = join(ROOT, relativePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf8');
}

function walkFiles(dir: string, extensions: string[], exclude: string[], files: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (exclude.some((ex) => fullPath.includes(ex))) continue;
    let s;
    try {
      s = statSync(fullPath);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      walkFiles(fullPath, extensions, exclude, files);
    } else if (extensions.some((ext) => fullPath.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Check implementations
// ---------------------------------------------------------------------------

function checkGovernanceDocs(): CheckResult[] {
  return REQUIRED_DOCS.map(({ path, requiredSections }) => {
    const content = readDoc(path);
    if (!content) {
      return { name: `doc:${path}`, passed: false, message: `MISSING: ${path}` };
    }
    const missingSections = requiredSections.filter((s) => !content.includes(s));
    if (missingSections.length > 0) {
      return {
        name: `doc:${path}`,
        passed: false,
        message: `${path} is missing required sections: ${missingSections.join(', ')}`,
      };
    }
    return { name: `doc:${path}`, passed: true, message: `${path} OK` };
  });
}

function checkPolicyGates(): CheckResult[] {
  const policyPath = join(ROOT, 'lib', 'policy-engine', 'policies', 'default.json');
  if (!existsSync(policyPath)) {
    return [
      {
        name: 'policy:gates',
        passed: false,
        message: 'MISSING: lib/policy-engine/policies/default.json',
      },
    ];
  }

  const raw = readFileSync(policyPath, 'utf8');
  const missingGates = REQUIRED_GATE_IDS.filter((id) => !raw.includes(`"${id}"`));
  if (missingGates.length > 0) {
    return [
      {
        name: 'policy:gates',
        passed: false,
        message: `Policy file is missing required gates: ${missingGates.join(', ')}`,
      },
    ];
  }
  return [{ name: 'policy:gates', passed: true, message: 'All required policy gates present' }];
}

function checkAuditLoggingInterface(): CheckResult[] {
  const billingPath = join(ROOT, 'lib', 'billing', 'index.ts');
  if (!existsSync(billingPath)) {
    return [
      {
        name: 'audit:billing-interface',
        passed: false,
        message: 'MISSING: lib/billing/index.ts (billing module with audit logging)',
      },
    ];
  }
  const content = readFileSync(billingPath, 'utf8');
  const hasAuditLogger = content.includes('BillingAuditLogger') && content.includes('auditLogger.log');
  return [
    {
      name: 'audit:billing-interface',
      passed: hasAuditLogger,
      message: hasAuditLogger
        ? 'Billing audit logging interface present'
        : 'lib/billing/index.ts does not implement BillingAuditLogger interface',
    },
  ];
}

function checkNoHardcodedSecrets(): CheckResult[] {
  const files = walkFiles(ROOT, SCAN_EXTENSIONS, SCAN_EXCLUDE);

  const violations: string[] = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`${name} detected in ${file.replace(ROOT, '')}`);
      }
    }
  }

  return [
    {
      name: 'security:no-hardcoded-secrets',
      passed: violations.length === 0,
      message:
        violations.length === 0
          ? 'No hardcoded secrets detected'
          : `Hardcoded secret violations: ${violations.join('; ')}`,
    },
  ];
}

function checkEnvExample(): CheckResult[] {
  const envPath = join(ROOT, '.env.example');
  const exists = existsSync(envPath);
  return [
    {
      name: 'env:example-exists',
      passed: exists,
      message: exists ? '.env.example present' : 'MISSING: .env.example',
    },
  ];
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('🔐 JGA Enterprise OS — Compliance Check\n');

  const allResults: CheckResult[] = [
    ...checkGovernanceDocs(),
    ...checkPolicyGates(),
    ...checkAuditLoggingInterface(),
    ...checkNoHardcodedSecrets(),
    ...checkEnvExample(),
  ];

  let passed = 0;
  let failed = 0;

  for (const result of allResults) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} [${result.name}] ${result.message}`);
    if (result.passed) passed++;
    else failed++;
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error(`\n❌ COMPLIANCE CHECK FAILED — ${failed} violation(s) detected.`);
    process.exit(1);
  }

  console.log('\n✅ COMPLIANCE CHECK PASSED — All governance requirements met.');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Compliance check error:', err);
  process.exit(1);
});
