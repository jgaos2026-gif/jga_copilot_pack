import { auditLog } from '../runtime/audit-log.js';
import { billIntake } from './bill.intake.js';
import type { LedgerEntry } from './bill.pay.js';
import type { Bill } from './bill.types.js';

export class BillReconcile {
  reconcile(
    billId: string,
    ledgerEntry: LedgerEntry,
  ): { ok: boolean; bill: Bill; discrepancy?: number } {
    const bill = billIntake.getBill(billId);
    if (!bill) throw new Error(`Bill not found: ${billId}`);
    if (bill.status !== 'paid') {
      throw new Error(`Bill ${billId} must be in 'paid' status to reconcile. Current status: ${bill.status}`);
    }

    const discrepancy = Math.abs(bill.amount - ledgerEntry.amount);
    const ok = discrepancy === 0;

    const updatedBill = billIntake.updateBill(billId, {
      status: ok ? 'reconciled' : 'disputed',
    });

    auditLog.append({
      actor: 'BillReconcile',
      action: ok ? 'bill_reconciled' : 'bill_reconcile_disputed',
      brickId: billId,
      jurisdiction: updatedBill.stateTag,
      amount: updatedBill.amount,
      metadata: {
        ledgerEntryId: ledgerEntry.entryId,
        ledgerAmount: ledgerEntry.amount,
        billAmount: bill.amount,
        discrepancy,
      },
    });

    return {
      ok,
      bill: updatedBill,
      ...(ok ? {} : { discrepancy }),
    };
  }
}

export const billReconcile: BillReconcile = new BillReconcile();
