import { randomUUID } from 'crypto';
import { z } from 'zod';
import { auditLog } from '../runtime/audit-log.js';
import type { Bill } from './bill.types.js';

const BillInputSchema = z.object({
  vendorName: z.string().min(1, 'vendorName is required'),
  amount: z.number().positive('amount must be positive'),
  dueDate: z.string().min(1, 'dueDate is required'),
  stateTag: z.string().min(1, 'stateTag is required'),
});

export type BillInput = z.infer<typeof BillInputSchema>;

export class BillIntake {
  private bills: Map<string, Bill> = new Map();

  receive(input: BillInput): Bill {
    const parsed = BillInputSchema.parse(input);

    const now = new Date().toISOString();
    const bill: Bill = {
      billId: randomUUID(),
      vendorName: parsed.vendorName,
      amount: parsed.amount,
      dueDate: parsed.dueDate,
      stateTag: parsed.stateTag,
      status: 'received',
      createdAt: now,
      updatedAt: now,
    };

    this.bills.set(bill.billId, bill);

    auditLog.append({
      actor: 'BillIntake',
      action: 'bill_received',
      brickId: bill.billId,
      jurisdiction: bill.stateTag,
      amount: bill.amount,
      metadata: { vendorName: bill.vendorName, dueDate: bill.dueDate },
    });

    return { ...bill };
  }

  getBill(billId: string): Bill | undefined {
    const bill = this.bills.get(billId);
    return bill ? { ...bill } : undefined;
  }

  updateBill(billId: string, updates: Partial<Bill>): Bill {
    const bill = this.bills.get(billId);
    if (!bill) throw new Error(`Bill not found: ${billId}`);
    const updated: Bill = { ...bill, ...updates, updatedAt: new Date().toISOString() };
    this.bills.set(billId, updated);
    return { ...updated };
  }
}

export const billIntake: BillIntake = new BillIntake();
