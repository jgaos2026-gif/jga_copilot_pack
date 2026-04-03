import { randomUUID } from 'crypto';
import { auditLog } from '../runtime/audit-log.js';
import { billIntake } from './bill.intake.js';
import type { Bill } from './bill.types.js';

export interface LedgerEntry {
  entryId: string;
  billId: string;
  amount: number;
  paidBy: string;
  paidAt: string;
  stateTag: string;
}

export class BillPay {
  private ledger: Map<string, LedgerEntry> = new Map();

  pay(billId: string, paidBy: string): { bill: Bill; ledgerEntry: LedgerEntry } {
    const bill = billIntake.getBill(billId);
    if (!bill) throw new Error(`Bill not found: ${billId}`);
    if (bill.status !== 'approved') {
      throw new Error(`Bill ${billId} must be in 'approved' status before payment. Current status: ${bill.status}`);
    }

    const paidAt = new Date().toISOString();
    const ledgerEntry: LedgerEntry = {
      entryId: randomUUID(),
      billId,
      amount: bill.amount,
      paidBy,
      paidAt,
      stateTag: bill.stateTag,
    };

    this.ledger.set(ledgerEntry.entryId, ledgerEntry);

    const updatedBill = billIntake.updateBill(billId, {
      status: 'paid',
      ledgerEntryId: ledgerEntry.entryId,
    });

    auditLog.append({
      actor: paidBy,
      action: 'bill_paid',
      brickId: billId,
      jurisdiction: updatedBill.stateTag,
      amount: updatedBill.amount,
      metadata: {
        vendorName: updatedBill.vendorName,
        ledgerEntryId: ledgerEntry.entryId,
      },
    });

    return { bill: updatedBill, ledgerEntry: { ...ledgerEntry } };
  }

  getLedgerEntry(entryId: string): LedgerEntry | undefined {
    const entry = this.ledger.get(entryId);
    return entry ? { ...entry } : undefined;
  }
}

export const billPay: BillPay = new BillPay();
