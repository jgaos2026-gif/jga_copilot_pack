import { approvalQueue, type ApprovalRequest } from '../runtime/approvals.js';
import { auditLog } from '../runtime/audit-log.js';
import { billIntake } from './bill.intake.js';
import type { Bill } from './bill.types.js';

export class BillApproval {
  requestApproval(bill: Bill): { bill: Bill; approvalRequest?: ApprovalRequest } {
    const updated = billIntake.updateBill(bill.billId, { status: 'pending_approval' });

    // Amounts >= $500 require human approval via the escalation queue
    if (bill.amount >= 500) {
      const approvalRequest = approvalQueue.enqueue({
        requestedBy: 'BillApproval',
        action: 'approve_bill',
        amount: bill.amount,
        brickId: bill.billId,
      });

      auditLog.append({
        actor: 'BillApproval',
        action: 'bill_approval_requested',
        brickId: bill.billId,
        jurisdiction: bill.stateTag,
        amount: bill.amount,
        metadata: { vendorName: bill.vendorName, approvalId: approvalRequest.approvalId },
      });

      return { bill: updated, approvalRequest };
    }

    auditLog.append({
      actor: 'BillApproval',
      action: 'bill_approval_requested',
      brickId: bill.billId,
      jurisdiction: bill.stateTag,
      amount: bill.amount,
      metadata: { vendorName: bill.vendorName },
    });

    return { bill: updated };
  }

  approveBill(billId: string, approvedBy: string): Bill {
    const bill = billIntake.getBill(billId);
    if (!bill) throw new Error(`Bill not found: ${billId}`);

    const updated = billIntake.updateBill(billId, { status: 'approved' });

    auditLog.append({
      actor: approvedBy,
      action: 'bill_approved',
      brickId: billId,
      jurisdiction: updated.stateTag,
      amount: updated.amount,
      metadata: { vendorName: updated.vendorName },
    });

    return updated;
  }

  disputeBill(billId: string, reason: string): Bill {
    const bill = billIntake.getBill(billId);
    if (!bill) throw new Error(`Bill not found: ${billId}`);

    const updated = billIntake.updateBill(billId, { status: 'disputed' });

    auditLog.append({
      actor: 'BillApproval',
      action: 'bill_disputed',
      brickId: billId,
      jurisdiction: updated.stateTag,
      amount: updated.amount,
      metadata: { vendorName: updated.vendorName, reason },
    });

    return updated;
  }
}

export const billApproval: BillApproval = new BillApproval();
