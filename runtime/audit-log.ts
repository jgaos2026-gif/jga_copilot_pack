import { randomUUID } from 'crypto';

export interface AuditEntry {
  entryId: string;
  actor: string;
  action: string;
  brickId: string;
  jurisdiction: string;
  amount?: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export class AuditLog {
  private entries: AuditEntry[] = [];

  append(entry: Omit<AuditEntry, 'entryId' | 'timestamp'>): AuditEntry {
    const full: AuditEntry = {
      ...entry,
      entryId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.entries.push(full);
    return full;
  }

  getAll(): AuditEntry[] {
    return [...this.entries];
  }

  getByBrickId(brickId: string): AuditEntry[] {
    return this.entries.filter((e) => e.brickId === brickId);
  }

  getByActor(actor: string): AuditEntry[] {
    return this.entries.filter((e) => e.actor === actor);
  }
}

export const auditLog: AuditLog = new AuditLog();
