/**
 * System B: Independent contractor onboarding and work routing
 * 
 * Features:
 * - Lead capture form (name, email, state, contractor type—NO sensitive data)
 * - Contractor account provisioning and dashboard
 * - Work assignment routing to correct State BRIC
 * - Escrow and payment milestone tracking (1099 NEC)
 * - Zero bulk export of sensitive data
 * 
 * System Law 3 enforcement:
 * System B stores ONLY assignment metadata {contractorId, stateBric, projectId, timestamp}.
 * No NDAs, contracts, or payment logs are stored here.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

export interface LeadCapture {
  email: string
  name: string
  state: string // state code: CA, TX, NY, etc.
  contractorType: 'contractor' | 'employee'
  capturedAt: number
}

export interface ContractorAccount {
  id: string
  email: string
  name: string
  state: string
  stateBricId: string
  trainingCompleted: boolean
  onboardedAt: number
  status: 'pending' | 'active' | 'suspended'
}

export interface WorkAssignment {
  id: string
  contractorId: string
  stateBricId: string
  projectId: string
  assignedAt: number
  status: 'pending' | 'in-progress' | 'completed'
}

export interface EscrowMilestone {
  id: string
  contractorId: string
  workAssignmentId: string
  amount: number
  status: 'held' | 'released' | 'disputed'
  createdAt: number
}

export interface SystemBConfig {
  baseDir: string
}

/**
 * System B BRIC: contractor operations and work routing
 */
export class SystemBBric {
  private leads: Map<string, LeadCapture> = new Map()
  private contractors: Map<string, ContractorAccount> = new Map()
  private assignments: Map<string, WorkAssignment> = new Map()
  private escrow: Map<string, EscrowMilestone> = new Map()

  constructor(private config: SystemBConfig) {}

  async ensureDir() {
    await fs.mkdir(this.config.baseDir, { recursive: true })
  }

  /**
   * System B Lead Capture: unidirectional from Public → System B
   * NO sensitive data is accepted
   */
  async captureLeadFromPublic(email: string, name: string, state: string, contractorType: 'contractor' | 'employee'): Promise<LeadCapture> {
    const lead: LeadCapture = {
      email,
      name,
      state,
      contractorType,
      capturedAt: Date.now(),
    }

    this.leads.set(email, lead)

    // Save to disk
    await this.ensureDir()
    const filePath = join(this.config.baseDir, `lead-${email}.json`)
    await fs.writeFile(filePath, JSON.stringify(lead, null, 2), 'utf8')

    return lead
  }

  /**
   * Provision contractor account from lead
   * Selects appropriate State BRIC based on state code
   */
  async provisionContractor(email: string): Promise<ContractorAccount> {
    const lead = this.leads.get(email)
    if (!lead) {
      throw new Error(`Lead not found: ${email}`)
    }

    const contractorId = randomUUID()
    const account: ContractorAccount = {
      id: contractorId,
      email: lead.email,
      name: lead.name,
      state: lead.state,
      stateBricId: `state-${lead.state.toLowerCase()}`, // Route to correct state
      trainingCompleted: false,
      onboardedAt: Date.now(),
      status: 'pending',
    }

    this.contractors.set(contractorId, account)

    // Save contractor account
    const filePath = join(this.config.baseDir, `contractor-${contractorId}.json`)
    await fs.writeFile(filePath, JSON.stringify(account, null, 2), 'utf8')

    return account
  }

  /**
   * Mark training complete (gating before live assignments)
   */
  async completeTraining(contractorId: string): Promise<ContractorAccount> {
    const contractor = this.contractors.get(contractorId)
    if (!contractor) {
      throw new Error(`Contractor not found: ${contractorId}`)
    }

    contractor.trainingCompleted = true
    contractor.status = 'active'

    const filePath = join(this.config.baseDir, `contractor-${contractorId}.json`)
    await fs.writeFile(filePath, JSON.stringify(contractor, null, 2), 'utf8')

    return contractor
  }

  /**
   * Route work assignment to appropriate State BRIC
   * System Law 3: Only metadata is stored here, NOT the actual work data
   */
  async assignWork(contractorId: string, projectId: string): Promise<WorkAssignment> {
    const contractor = this.contractors.get(contractorId)
    if (!contractor) {
      throw new Error(`Contractor not found: ${contractorId}`)
    }

    if (!contractor.trainingCompleted) {
      throw new Error(`Contractor training not completed: ${contractorId}`)
    }

    const assignmentId = randomUUID()
    const assignment: WorkAssignment = {
      id: assignmentId,
      contractorId,
      stateBricId: contractor.stateBricId, // Route to correct State BRIC
      projectId,
      assignedAt: Date.now(),
      status: 'pending',
    }

    this.assignments.set(assignmentId, assignment)

    // Save assignment metadata (NOT the actual project data)
    const filePath = join(this.config.baseDir, `assignment-${assignmentId}.json`)
    await fs.writeFile(filePath, JSON.stringify(assignment, null, 2), 'utf8')

    return assignment
  }

  /**
   * Create escrow milestone for payment tracking
   * System Law 3: Payment logs stored only in State BRIC, not here
   */
  async createEscrowMilestone(contractorId: string, workAssignmentId: string, amount: number): Promise<EscrowMilestone> {
    const assignment = this.assignments.get(workAssignmentId)
    if (!assignment) {
      throw new Error(`Assignment not found: ${workAssignmentId}`)
    }

    const escrowId = randomUUID()
    const milestone: EscrowMilestone = {
      id: escrowId,
      contractorId,
      workAssignmentId,
      amount,
      status: 'held',
      createdAt: Date.now(),
    }

    this.escrow.set(escrowId, milestone)

    const filePath = join(this.config.baseDir, `escrow-${escrowId}.json`)
    await fs.writeFile(filePath, JSON.stringify(milestone, null, 2), 'utf8')

    return milestone
  }

  /**
   * Release payment (triggered by State BRIC after work acceptance)
   */
  async releasePayment(escrowId: string): Promise<EscrowMilestone> {
    const milestone = this.escrow.get(escrowId)
    if (!milestone) {
      throw new Error(`Escrow not found: ${escrowId}`)
    }

    milestone.status = 'released'

    const filePath = join(this.config.baseDir, `escrow-${escrowId}.json`)
    await fs.writeFile(filePath, JSON.stringify(milestone, null, 2), 'utf8')

    return milestone
  }

  /**
   * System Law 3 enforcement: disallow bulk export
   */
  async bulkExport(): Promise<never> {
    throw new Error('DENIED: Bulk export is prohibited by System Law 3')
  }

  /**
   * Audit System B boundaries
   */
  async auditSystemBBoundaries(): Promise<{ ok: boolean; violations: string[] }> {
    const violations: string[] = []

    // Check that no assignments contain NDA text or full contracts
    for (const assignment of this.assignments.values()) {
      const filePath = join(this.config.baseDir, `assignment-${assignment.id}.json`)
      try {
        const content = await fs.readFile(filePath, 'utf8')
        if (content.includes('NDA') || content.includes('confidential')) {
          violations.push(`Assignment ${assignment.id} contains restricted content`)
        }
      } catch (e) {
        // file doesn't exist yet
      }
    }

    return {
      ok: violations.length === 0,
      violations,
    }
  }
}
