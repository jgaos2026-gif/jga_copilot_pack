export type BrickType =
  | 'PolicyBrick'
  | 'ProcessBrick'
  | 'OpsBrick'
  | 'LedgerBrick'
  | 'ComplianceBrick'
  | 'ContractBrick'
  | 'RecordBrick'
  | 'AgentBrick';

export type BrickLifecycle = 'draft' | 'active' | 'suspended' | 'archived';

export interface Brick {
  brickId: string; // UUID - immutable
  brickType: BrickType;
  stateTag: string; // e.g. IL-01, TX-44, US-FED
  lifecycle: BrickLifecycle;
  name: string;
  description: string;
  version: number; // increments on each update (append-only)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  metadata: Record<string, unknown>;
}

export interface BrickCreateInput {
  brickType: BrickType;
  stateTag: string;
  name: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface BrickUpdateInput {
  brickId: string;
  lifecycle?: BrickLifecycle;
  description?: string;
  metadata?: Record<string, unknown>;
}
