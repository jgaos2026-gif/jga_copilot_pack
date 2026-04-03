import type { AgentDefinition } from './agent.types.js';

export const agentDef: AgentDefinition = {
  agentId: 'ops-agent-001',
  role: 'OpsAgent',
  authorityScope: {
    canDo: [
      'read_project_status',
      'update_project_status',
      'assign_contractor',
      'schedule_task',
      'read_intake_forms',
      'create_intake_record',
      'flag_ops_issue',
      'read_vendor_info',
      'trigger_compliance_check',
    ],
    cannotDo: [
      'edit_pricing',
      'approve_payment',
      'edit_contract_terms',
      'delete_records',
      'manage_users',
      'modify_pricing_policy',
    ],
  },
  reportsTo: 'AdminAgent',
  communicatesVia: 'ops',
  escalationThreshold: 250,
};
