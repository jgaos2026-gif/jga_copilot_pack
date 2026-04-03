import type { AgentDefinition } from './agent.types.js';

export const agentDef: AgentDefinition = {
  agentId: 'compliance-agent-001',
  role: 'ComplianceAgent',
  authorityScope: {
    canDo: [
      'read_compliance_records',
      'generate_compliance_report',
      'flag_compliance_violation',
      'check_jurisdiction_rules',
      'read_contracts',
      'read_audit_log',
      'trigger_escalation',
      'read_retention_policies',
    ],
    cannotDo: [
      'edit_contract_terms',
      'approve_payment',
      'delete_records',
      'manage_users',
      'modify_pricing_policy',
      'write_ledger_entry',
    ],
  },
  reportsTo: 'AdminAgent',
  communicatesVia: 'compliance',
  escalationThreshold: 0, // compliance violations always escalate
};
