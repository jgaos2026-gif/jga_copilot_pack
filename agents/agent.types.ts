export type AgentRole =
  | 'AdminAgent'
  | 'CFOAgent'
  | 'OpsAgent'
  | 'ComplianceAgent'
  | 'RecordsAgent'
  | 'VendorPayAgent';

export type MessageBusChannel =
  | 'finance'
  | 'ops'
  | 'compliance'
  | 'records'
  | 'vendor'
  | 'admin'
  | 'escalation';

export interface AgentDefinition {
  agentId: string;
  role: AgentRole;
  authorityScope: {
    canDo: string[];
    cannotDo: string[];
  };
  reportsTo: AgentRole | 'Owner';
  communicatesVia: MessageBusChannel;
  escalationThreshold: number; // dollar amount above which escalation is required
}

export interface AgentMessage {
  messageId: string;
  fromAgent: AgentRole | 'Owner';
  toAgent: AgentRole | 'Owner';
  channel: MessageBusChannel;
  action: string;
  payload: Record<string, unknown>;
  timestamp: string;
  requiresApproval: boolean;
}
