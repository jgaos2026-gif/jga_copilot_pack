import { randomUUID } from 'crypto';

export interface ApprovalRequest {
  approvalId: string;
  requestedBy: string;
  action: string;
  amount: number;
  brickId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  reason?: string;
}

export class ApprovalQueue {
  private queue: ApprovalRequest[] = [];

  enqueue(req: Omit<ApprovalRequest, 'approvalId' | 'status' | 'createdAt'>): ApprovalRequest {
    const entry: ApprovalRequest = {
      ...req,
      approvalId: randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.queue.push(entry);
    return entry;
  }

  approve(approvalId: string, resolvedBy: string, reason?: string): ApprovalRequest {
    const req = this.findOrThrow(approvalId);
    req.status = 'approved';
    req.resolvedAt = new Date().toISOString();
    req.resolvedBy = resolvedBy;
    if (reason) req.reason = reason;
    return { ...req };
  }

  reject(approvalId: string, resolvedBy: string, reason: string): ApprovalRequest {
    const req = this.findOrThrow(approvalId);
    req.status = 'rejected';
    req.resolvedAt = new Date().toISOString();
    req.resolvedBy = resolvedBy;
    req.reason = reason;
    return { ...req };
  }

  getPending(): ApprovalRequest[] {
    return this.queue.filter((r) => r.status === 'pending').map((r) => ({ ...r }));
  }

  getAll(): ApprovalRequest[] {
    return this.queue.map((r) => ({ ...r }));
  }

  private findOrThrow(approvalId: string): ApprovalRequest {
    const req = this.queue.find((r) => r.approvalId === approvalId);
    if (!req) throw new Error(`ApprovalRequest not found: ${approvalId}`);
    return req;
  }
}

export const approvalQueue: ApprovalQueue = new ApprovalQueue();
