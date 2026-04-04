/**
 * JGA Enterprise OS — Policy Engine
 *
 * A lightweight runtime policy engine that loads JSON policy definitions
 * and validates agent/service actions against the System Constitution and Sectional Laws.
 *
 * Usage:
 *   import { policyEngine } from '@/lib/policy-engine';
 *   const result = policyEngine.validate('project.set_active', context);
 *   if (!result.allow) throw new Error(result.rationale);
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolicyContext {
  /** ID of the actor performing the action */
  actorId: string;
  /** Role of the actor */
  actorRole: 'owner' | 'admin' | 'staff' | 'contractor' | 'client' | 'agent';
  /** BRIC where the action occurs */
  bricId: string;
  /** Optional: resource type being acted upon */
  resourceType?: string;
  /** Optional: resource ID being acted upon */
  resourceId?: string;
  /** Optional: state tag (e.g. "IL-01", "TX-44") */
  stateTag?: string;
  /** Optional: action-specific extra fields used by condition evaluation */
  extras?: Record<string, unknown>;
}

export interface PolicyResult {
  /** Whether the action is allowed */
  allow: boolean;
  /** Human-readable rationale */
  rationale: string;
  /** Gate ID that produced this decision, if applicable */
  gateId?: string;
  /** True if this decision should be escalated to a higher authority */
  requiresEscalation?: boolean;
}

// Internal policy rule shape (matches policies/default.json)
interface PolicyCondition {
  field?: string;
  field2?: string;
  operator?: 'eq' | 'not_eq' | 'in' | 'not_in';
  value?: unknown;
  or?: PolicyCondition[];
  and?: PolicyCondition[];
}

interface PolicyRule {
  id: string;
  action: string;
  description: string;
  conditions: PolicyCondition[];
  effect: 'allow' | 'deny';
  denyRationale: string;
}

interface PolicyFile {
  version: string;
  description: string;
  policies: PolicyRule[];
}

// ---------------------------------------------------------------------------
// Condition evaluator
// ---------------------------------------------------------------------------

function getField(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function evaluateCondition(cond: PolicyCondition, ctx: Record<string, unknown>): boolean {
  if (cond.or) {
    return cond.or.some((c) => evaluateCondition(c, ctx));
  }
  if (cond.and) {
    return cond.and.every((c) => evaluateCondition(c, ctx));
  }

  if (!cond.field || !cond.operator) return true;

  const actualValue = getField(ctx, cond.field);

  switch (cond.operator) {
    case 'eq':
      if (cond.field2) {
        const otherValue = getField(ctx, cond.field2);
        return actualValue === otherValue;
      }
      return actualValue === cond.value;

    case 'not_eq':
      return actualValue !== cond.value;

    case 'in':
      return Array.isArray(cond.value) && cond.value.includes(actualValue);

    case 'not_in':
      return Array.isArray(cond.value) && !cond.value.includes(actualValue);

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Policy Engine
// ---------------------------------------------------------------------------

export class PolicyEngine {
  private rules: PolicyRule[] = [];

  /**
   * Load policies from a JSON file.
   * Call once at application startup or before first validate().
   */
  loadPoliciesFromFile(filePath: string): void {
    const raw = readFileSync(filePath, 'utf8');
    const parsed: PolicyFile = JSON.parse(raw) as PolicyFile;
    this.rules = parsed.policies;
  }

  /**
   * Load policies from a pre-parsed object (useful for tests).
   */
  loadPolicies(policyFile: PolicyFile): void {
    this.rules = policyFile.policies;
  }

  /**
   * Validate an action against loaded policies.
   *
   * @param action - Dot-notation action string, e.g. "project.set_active"
   * @param context - Actor and resource context for condition evaluation
   * @returns PolicyResult with allow/deny + rationale
   */
  validate(action: string, context: PolicyContext): PolicyResult {
    // Build a flat evaluation object for getField()
    const evalCtx: Record<string, unknown> = {
      context: {
        actorId: context.actorId,
        actorRole: context.actorRole,
        bricId: context.bricId,
        resourceType: context.resourceType,
        resourceId: context.resourceId,
        stateTag: context.stateTag,
        extras: context.extras ?? {},
      },
    };

    // Find matching rules for this action
    const matchingRules = this.rules.filter((r) => r.action === action);

    // No rule found: default to deny (fail-closed)
    if (matchingRules.length === 0) {
      return {
        allow: false,
        rationale: `No policy rule found for action "${action}". Default: DENY. (fail-closed)`,
        requiresEscalation: true,
      };
    }

    // Evaluate each matching rule; first failure blocks
    for (const rule of matchingRules) {
      const conditionsMet = rule.conditions.every((c) => evaluateCondition(c, evalCtx));

      if (rule.effect === 'allow' && !conditionsMet) {
        return {
          allow: false,
          rationale: rule.denyRationale,
          gateId: rule.id,
          requiresEscalation: false,
        };
      }

      if (rule.effect === 'deny' && conditionsMet) {
        return {
          allow: false,
          rationale: rule.denyRationale,
          gateId: rule.id,
          requiresEscalation: false,
        };
      }
    }

    // All conditions passed
    const gateId = matchingRules[matchingRules.length - 1]?.id;
    return {
      allow: true,
      rationale: `Action "${action}" is allowed. (${gateId ?? 'policy-engine'})`,
      gateId,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton instance — loads default policies on first use
// ---------------------------------------------------------------------------

let _singleton: PolicyEngine | null = null;

export function getPolicyEngine(): PolicyEngine {
  if (!_singleton) {
    _singleton = new PolicyEngine();
    const defaultPoliciesPath = join(
      fileURLToPath(new URL('.', import.meta.url)),
      'policies',
      'default.json'
    );
    try {
      _singleton.loadPoliciesFromFile(defaultPoliciesPath);
    } catch {
      // In test environments the file path may differ; caller can reload
    }
  }
  return _singleton;
}

/** Convenience re-export */
export const policyEngine = getPolicyEngine();
