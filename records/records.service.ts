import { randomUUID, createHash } from 'crypto';

export interface Record {
  recordId: string;
  stateTag: string;
  recordType: string;
  content: Record<string, unknown>;
  createdAt: string;
  hash: string;
}

export class RecordsService {
  private store: Map<string, Record> = new Map();

  write(input: { stateTag: string; recordType: string; content: Record<string, unknown> }): Record {
    const recordId = randomUUID();
    const createdAt = new Date().toISOString();
    const hash = this.computeHash(input.content);

    const record: Record = {
      recordId,
      stateTag: input.stateTag,
      recordType: input.recordType,
      content: { ...input.content },
      createdAt,
      hash,
    };

    this.store.set(recordId, record);
    return { ...record };
  }

  read(recordId: string): Record | undefined {
    const record = this.store.get(recordId);
    return record ? { ...record } : undefined;
  }

  readByState(stateTag: string): Record[] {
    return [...this.store.values()]
      .filter((r) => r.stateTag === stateTag)
      .map((r) => ({ ...r }));
  }

  verify(recordId: string): boolean {
    const record = this.store.get(recordId);
    if (!record) return false;
    return this.computeHash(record.content) === record.hash;
  }

  private computeHash(content: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(content)).digest('hex');
  }
}

export const recordsService: RecordsService = new RecordsService();
