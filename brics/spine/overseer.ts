/**
 * Overseer: Monitoring, telemetry, and incident escalation
 * 
 * Features:
 * - Continuous monitoring of all BRIC layers
 * - Incident detection (prompt injection, data corruption, credential leak, AI drift)
 * - Automatic escalation to Owners Room
 * - Risk scoring and threshold-based alerts
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

export type IncidentType = 'prompt-injection' | 'data-corruption' | 'credential-leak' | 'ai-drift' | 'compliance-violation'

export interface Incident {
  id: string
  type: IncidentType
  severity: 'low' | 'medium' | 'high' | 'critical'
  detectedAt: number
  bricId: string
  description: string
  evidence: string
  escalated: boolean
  escalatedTo?: string
}

export interface TelemetryPoint {
  timestamp: number
  bricId: string
  metric: string
  value: number | boolean | string
}

export interface OverseerConfig {
  baseDir: string
}

/**
 * Overseer: Monitoring and incident detection
 */
export class Overseer {
  private incidents: Map<string, Incident> = new Map()
  private telemetry: TelemetryPoint[] = []
  private riskLevel = 0

  constructor(private config: OverseerConfig) {}

  async ensureDir() {
    await fs.mkdir(this.config.baseDir, { recursive: true })
  }

  /**
   * Detect prompt injection attempts
   * Pattern: control sequences, JSON escaping, encoded payloads
   */
  async detectPromptInjection(agentOutput: string): Promise<Incident | null> {
    const patterns = [/\\x[0-9a-f]{2}/gi, /\[\[\[/, /}}}\{/g, /eval\(/, /exec\(/]

    const matched = patterns.some(p => p.test(agentOutput))

    if (matched) {
      const incident: Incident = {
        id: randomUUID(),
        type: 'prompt-injection',
        severity: 'high',
        detectedAt: Date.now(),
        bricId: 'overseer',
        description: 'Potential prompt injection detected in agent output',
        evidence: agentOutput.slice(0, 200), // Truncate for safety
        escalated: false,
      }

      this.incidents.set(incident.id, incident)
      this.riskLevel += 50

      await this.logIncident(incident)
      return incident
    }

    return null
  }

  /**
   * Detect data corruption attempts
   * (called when stitch brick verification fails)
   */
  async detectDataCorruption(bricId: string, errorDetails: string): Promise<Incident | null> {
    const incident: Incident = {
      id: randomUUID(),
      type: 'data-corruption',
      severity: 'critical',
      detectedAt: Date.now(),
      bricId,
      description: 'Data corruption detected - stitch brick verification failed',
      evidence: errorDetails.slice(0, 200),
      escalated: false,
    }

    this.incidents.set(incident.id, incident)
    this.riskLevel += 100

    await this.logIncident(incident)
    return incident
  }

  /**
   * Detect credential leak
   * (called from CI/CD secret scanner or runtime detector)
   */
  async detectCredentialLeak(credentialType: string, scope: string): Promise<Incident | null> {
    const incident: Incident = {
      id: randomUUID(),
      type: 'credential-leak',
      severity: 'critical',
      detectedAt: Date.now(),
      bricId: 'security',
      description: `Potential credential leak detected: ${credentialType} in ${scope}`,
      evidence: `Type: ${credentialType}, Scope: ${scope}`,
      escalated: false,
    }

    this.incidents.set(incident.id, incident)
    this.riskLevel += 80

    await this.logIncident(incident)
    return incident
  }

  /**
   * Detect AI drift
   * Sample agent outputs and verify against policy
   */
  async detectAIDrift(policyViolations: number, sampleSize: number): Promise<Incident | null> {
    const driftPercentage = (policyViolations / sampleSize) * 100

    if (driftPercentage > 10) {
      // Threshold: > 10% deviation triggers incident
      const incident: Incident = {
        id: randomUUID(),
        type: 'ai-drift',
        severity: 'high',
        detectedAt: Date.now(),
        bricId: 'ai-system',
        description: `Detected ${policyViolations}/${sampleSize} (${driftPercentage.toFixed(1)}%) policy violations`,
        evidence: `Drift: ${driftPercentage.toFixed(1)}%`,
        escalated: false,
      }

      this.incidents.set(incident.id, incident)
      this.riskLevel += 30

      await this.logIncident(incident)
      return incident
    }

    return null
  }

  /**
   * Detect compliance violations
   */
  async detectComplianceViolation(violationType: string, details: string): Promise<Incident | null> {
    const incident: Incident = {
      id: randomUUID(),
      type: 'compliance-violation',
      severity: 'critical',
      detectedAt: Date.now(),
      bricId: 'compliance',
      description: `Compliance violation detected: ${violationType}`,
      evidence: details.slice(0, 200),
      escalated: false,
    }

    this.incidents.set(incident.id, incident)
    this.riskLevel += 100

    await this.logIncident(incident)
    return incident
  }

  /**
   * Escalate incident to Owners Room
   */
  async escalateIncident(incidentId: string, escalateTo: string): Promise<void> {
    const incident = this.incidents.get(incidentId)
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`)
    }

    incident.escalated = true
    incident.escalatedTo = escalateTo

    console.error(`🚨 ESCALATED: ${incident.type.toUpperCase()} to ${escalateTo}`)
    console.error(`   Severity: ${incident.severity}`)
    console.error(`   Evidence: ${incident.evidence}`)

    await this.ensureDir()
    const filePath = join(this.config.baseDir, `incident-${incidentId}.json`)
    await fs.writeFile(filePath, JSON.stringify(incident, null, 2), 'utf8')
  }

  /**
   * Record telemetry point
   */
  async recordTelemetry(bricId: string, metric: string, value: number | boolean | string): Promise<void> {
    const point: TelemetryPoint = {
      timestamp: Date.now(),
      bricId,
      metric,
      value,
    }

    this.telemetry.push(point)

    // Periodically clean old telemetry (keep last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 86400 * 1000
    this.telemetry = this.telemetry.filter(p => p.timestamp > sevenDaysAgo)
  }

  /**
   * Get current risk level
   */
  getRiskLevel(): number {
    return Math.min(this.riskLevel, 100) // Cap at 100%
  }

  /**
   * Get recent incidents
   */
  getRecentIncidents(limitMinutes: number = 60): Incident[] {
    const cutoffTime = Date.now() - limitMinutes * 60 * 1000
    return Array.from(this.incidents.values()).filter(i => i.detectedAt > cutoffTime)
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): {
    riskLevel: number
    incidentCount: number
    recentIncidents: Incident[]
    telemetryPoints: number
  } {
    return {
      riskLevel: this.getRiskLevel(),
      incidentCount: this.incidents.size,
      recentIncidents: this.getRecentIncidents(60),
      telemetryPoints: this.telemetry.length,
    }
  }

  /**
   * Log incident to disk
   */
  private async logIncident(incident: Incident): Promise<void> {
    await this.ensureDir()
    const filePath = join(this.config.baseDir, `incident-${incident.id}.json`)
    await fs.writeFile(filePath, JSON.stringify(incident, null, 2), 'utf8')

    // Also append to incident log
    const logPath = join(this.config.baseDir, 'incidents.log')
    const line = `${incident.detectedAt} | ${incident.type} | ${incident.severity} | ${incident.bricId}\n`
    await fs.appendFile(logPath, line, 'utf8')
  }

  /**
   * Clear risk level (after remediation)
   */
  clearRiskLevel(): void {
    this.riskLevel = 0
  }
}
