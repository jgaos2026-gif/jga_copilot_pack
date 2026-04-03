import type { AgentDefinition } from './agent.types.js';

export const agentDef: AgentDefinition = {
  agentId: 'records-agent-001',
  role: 'RecordsAgent',
  authorityScope: {
    canDo: [
      'write_record',
      'read_record',
      'verify_record_hash',
      'route_record_to_partition',
      'read_retention_policy',
      'generate_records_report',
      'archive_record',
    ],
    cannotDo: [
      'delete_record',
      'update_record',
      'approve_payment',
      'edit_contract_terms',
      'manage_users',
      'modify_pricing_policy',
    ],
  },
  reportsTo: 'AdminAgent',
  communicatesVia: 'records',
  escalationThreshold: 0, // records agent does not handle money
};
