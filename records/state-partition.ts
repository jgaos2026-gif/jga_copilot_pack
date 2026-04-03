export interface StatePartition {
  stateTag: string;
  recordCount: number;
  partitionKey: string;
}

export class StatePartitionRouter {
  private partitions: Map<string, StatePartition> = new Map();

  route(record: { stateTag: string; recordType: string; recordId: string }): string {
    const year = new Date().getFullYear();
    const partitionKey = `${record.stateTag}/${record.recordType}/${year}`;

    const existing = this.partitions.get(record.stateTag);
    if (existing) {
      existing.recordCount += 1;
      existing.partitionKey = partitionKey;
    } else {
      this.partitions.set(record.stateTag, {
        stateTag: record.stateTag,
        recordCount: 1,
        partitionKey,
      });
    }

    return partitionKey;
  }

  getPartition(stateTag: string): StatePartition | undefined {
    const partition = this.partitions.get(stateTag);
    return partition ? { ...partition } : undefined;
  }

  getAll(): StatePartition[] {
    return [...this.partitions.values()].map((p) => ({ ...p }));
  }
}

export const statePartitionRouter: StatePartitionRouter = new StatePartitionRouter();
