import type { AgentDefinition } from './agent.types.js';

export const agentDef: AgentDefinition = {
  agentId: 'vendor-pay-agent-001',
  role: 'VendorPayAgent',
  authorityScope: {
    canDo: [
      'read_vendor_bills',
      'submit_payment_request',
      'approve_payment_under_50',
      'flag_vendor_dispute',
      'read_vendor_contracts',
      'generate_payment_receipt',
      'reconcile_vendor_payment',
    ],
    cannotDo: [
      'approve_payment_over_50',
      'edit_vendor_contract_terms',
      'delete_records',
      'manage_users',
      'modify_pricing_policy',
      'access_client_data',
      'write_ledger_entry',
    ],
  },
  reportsTo: 'CFOAgent',
  communicatesVia: 'vendor',
  escalationThreshold: 50,
};
