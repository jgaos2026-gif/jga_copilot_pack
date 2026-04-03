export type BillStatus =
  | 'received'
  | 'pending_approval'
  | 'approved'
  | 'paid'
  | 'reconciled'
  | 'disputed';

export interface Bill {
  billId: string;
  vendorName: string;
  amount: number;
  dueDate: string;
  stateTag: string;
  status: BillStatus;
  brickId?: string;
  ledgerEntryId?: string;
  createdAt: string;
  updatedAt: string;
}
