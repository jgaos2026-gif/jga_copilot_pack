import type { AgentDefinition } from './agent.types.js';

export const agentDef: AgentDefinition = {
  agentId: 'cfo-agent-001',
  role: 'CFOAgent',
  authorityScope: {
    canDo: [
      'read_ledger',
      'write_ledger_entry',
      'approve_payment_under_100',
      'generate_invoice',
      'flag_dispute',
      'view_financial_reports',
      'reconcile_bill',
      'read_transactions',
    ],
    cannotDo: [
      'delete_ledger_entry',
      'edit_contract_terms',
      'modify_pricing_policy',
      'access_contractor_personal_data',
      'approve_payment_over_100',
      'manage_users',
    ],
  },
  reportsTo: 'AdminAgent',
  communicatesVia: 'finance',
  escalationThreshold: 100,
};
