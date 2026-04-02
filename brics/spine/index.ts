// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

/**
 * Spine: Core policy repository and system law enforcement
 * 
 * Features:
 * - System law definitions and enforcement
 * - AI constraints and policy rules
 * - Governance rule repository
 * - Compliance integration with Compliance Agent
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

export type SystemLawId = 'law-1' | 'law-2' | 'law-3' | 'law-4' | 'law-5' | 'law-6' | 'law-7' | 'law-8'

export interface SystemLaw {
  id: SystemLawId
  title: string
  description: string
  enforcedAt: 'network' | 'schema' | 'code' | 'audit'
  violations: string[]
}

export interface AIConstraint {
  id: string
  title: string
  rule: string
  severity: 'advisory' | 'warning' | 'blocking'
  appliesTo: string[] // agent names or model names
}

export interface PolicyRule {
  id: string
  title: string
  condition: (context: any) => boolean
  action: 'allow' | 'deny' | 'log'
  priority: number
}

export interface SpineConfig {
  baseDir: string
}

/**
 * Spine: Policy repository and law enforcement
 */
export class Spine {
  private systemLaws: Map<SystemLawId, SystemLaw> = new Map()
  private aiConstraints: Map<string, AIConstraint> = new Map()
  private policyRules: Map<string, PolicyRule> = new Map()

  constructor(private config: SpineConfig) {
    this.initializeSystemLaws()
  }

  async ensureDir() {
    await fs.mkdir(this.config.baseDir, { recursive: true })
  }

  /**
   * Initialize all 8 system laws
   */
  private initializeSystemLaws(): void {
    const laws: SystemLaw[] = [
      {
        id: 'law-1',
        title: 'Unidirectional Public Boundary',
        description: 'Public layer publishes content only; no inbound authenticated endpoint is reachable from the internet.',
        enforcedAt: 'network',
        violations: [],
      },
      {
        id: 'law-2',
        title: 'Spine Does Not Store Customer Data',
        description: 'Spine is strategy/governance only; zero PII, zero payment records, zero project files.',
        enforcedAt: 'schema',
        violations: [],
      },
      {
        id: 'law-3',
        title: 'System B Does Not Bulk-Store Sensitive Records',
        description: 'System B stores only assignment metadata (contractor → state, project ID); not NDAs or payment logs.',
        enforcedAt: 'schema',
        violations: [],
      },
      {
        id: 'law-4',
        title: 'State BRICs Are Fully Isolated',
        description: 'Each state owns its data; cross-state data flow is zero.',
        enforcedAt: 'network',
        violations: [],
      },
      {
        id: 'law-5',
        title: 'Owners Room Is Restricted',
        description: 'MFA-only, no bulk export, restricted IP, immutable audit log.',
        enforcedAt: 'code',
        violations: [],
      },
      {
        id: 'law-6',
        title: 'Compliance Gate Precedes Business Calls',
        description: 'Sales calls, notifications, outreach disabled by default; enabled only after compliance sign-off.',
        enforcedAt: 'code',
        violations: [],
      },
      {
        id: 'law-7',
        title: 'Stitch Brick Integrity',
        description: 'Every micro-brick has SHA-256 digest + Merkle log + consensus replication. Mismatch = auto-heal.',
        enforcedAt: 'code',
        violations: [],
      },
      {
        id: 'law-8',
        title: 'No Implicit Network Trust',
        description: 'Every BRIC-to-BRIC call is authenticated and authorized; deny-by-default.',
        enforcedAt: 'network',
        violations: [],
      },
    ]

    for (const law of laws) {
      this.systemLaws.set(law.id, law)
    }
  }

  /**
   * Define AI constraint
   */
  addAIConstraint(title: string, rule: string, severity: AIConstraint['severity'], appliesTo: string[]): AIConstraint {
    const constraint: AIConstraint = {
      id: randomUUID(),
      title,
      rule,
      severity,
      appliesTo,
    }

    this.aiConstraints.set(constraint.id, constraint)
    return constraint
  }

  /**
   * Add policy rule (enforceable governance)
   */
  addPolicyRule(title: string, condition: PolicyRule['condition'], action: PolicyRule['action'], priority: number): PolicyRule {
    const rule: PolicyRule = {
      id: randomUUID(),
      title,
      condition,
      action,
      priority,
    }

    this.policyRules.set(rule.id, rule)
    return rule
  }

  /**
   * Get system law by ID
   */
  getSystemLaw(lawId: SystemLawId): SystemLaw | null {
    return this.systemLaws.get(lawId) || null
  }

  /**
   * Get all system laws
   */
  getAllSystemLaws(): SystemLaw[] {
    return Array.from(this.systemLaws.values())
  }

  /**
   * Get AI constraints
   */
  getAIConstraints(): AIConstraint[] {
    return Array.from(this.aiConstraints.values())
  }

  /**
   * Log violation of system law
   */
  async logViolation(lawId: SystemLawId, details: string): Promise<void> {
    const law = this.systemLaws.get(lawId)
    if (law) {
      law.violations.push(details)

      await this.ensureDir()
      const filePath = join(this.config.baseDir, `law-${lawId}-violations.json`)
      await fs.writeFile(
        filePath,
        JSON.stringify(
          {
            law: law.title,
            violationCount: law.violations.length,
            violations: law.violations.slice(-100), // Keep last 100
          },
          null,
          2
        ),
        'utf8'
      )
    }
  }

  /**
   * Evaluate policy rules against context
   */
  evaluateRules(context: any): { allowed: boolean; reason: string; appliedRules: string[] } {
    const appliedRules: string[] = []
    let allowed = true
    let reason = 'No rules blocked this action'

    // Sort by priority (higher = execute first)
    const sortedRules = Array.from(this.policyRules.values()).sort((a, b) => b.priority - a.priority)

    for (const rule of sortedRules) {
      try {
        if (rule.condition(context)) {
          appliedRules.push(rule.title)

          if (rule.action === 'deny') {
            allowed = false
            reason = `Denied by rule: ${rule.title}`
            break
          } else if (rule.action === 'allow') {
            allowed = true
            reason = `Allowed by rule: ${rule.title}`
          }
        }
      } catch (e) {
        // Rule evaluation error - log but continue
        console.error(`Rule evaluation error in ${rule.title}:`, e)
      }
    }

    return { allowed, reason, appliedRules }
  }

  /**
   * Export policy snapshot for audit
   */
  async exportPolicySnapshot(): Promise<{
    systemLaws: SystemLaw[]
    aiConstraints: AIConstraint[]
    policyRules: string[]
    timestamp: number
  }> {
    return {
      systemLaws: this.getAllSystemLaws(),
      aiConstraints: this.getAIConstraints(),
      policyRules: Array.from(this.policyRules.values()).map(r => r.title),
      timestamp: Date.now(),
    }
  }

  /**
   * Audit: verify all system laws have enforcement
   */
  async auditLawEnforcement(): Promise<{ ok: boolean; unenforced: SystemLawId[] }> {
    const unenforced: SystemLawId[] = []

    for (const law of this.systemLaws.values()) {
      if (!law.enforcedAt) {
        unenforced.push(law.id)
      }
    }

    return {
      ok: unenforced.length === 0,
      unenforced,
    }
  }
}
