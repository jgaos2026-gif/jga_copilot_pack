import type { AgentDefinition } from './agent.types.js';

export const agentDef: AgentDefinition = {
  agentId: 'admin-agent-001',
  role: 'AdminAgent',
  authorityScope: {
    canDo: [
      'read_all_records',
      'write_system_config',
      'approve_payment_under_500',
      'manage_users',
      'assign_roles',
      'view_audit_log',
      'manage_contractors',
      'override_ops_decision',
      'generate_compliance_report',
      'manage_bricks',
    ],
    cannotDo: [
      'delete_ledger_entry',
      'delete_audit_log',
      'modify_owner_settings',
      'approve_payment_over_500',
    ],
  },
  reportsTo: 'Owner',
  communicatesVia: 'admin',
  escalationThreshold: 500,
};
