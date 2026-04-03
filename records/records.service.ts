import { randomUUID, createHash } from 'crypto';

export interface WormRecord {
  recordId: string;
  stateTag: string;
  recordType: string;
  content: Record<string, unknown>;
  createdAt: string;
  hash: string;
}

export class RecordsService {
  private store: Map<string, WormRecord> = new Map();

  write(input: { stateTag: string; recordType: string; content: Record<string, unknown> }): WormRecord {
    const recordId = randomUUID();
    const createdAt = new Date().toISOString();
    const hash = this.computeHash(input.content);

    const record: WormRecord = {
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

  read(recordId: string): WormRecord | undefined {
    const record = this.store.get(recordId);
    return record ? { ...record } : undefined;
  }

  readByState(stateTag: string): WormRecord[] {
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
