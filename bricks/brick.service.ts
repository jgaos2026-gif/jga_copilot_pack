import { randomUUID } from 'crypto';
import type { Brick, BrickCreateInput, BrickUpdateInput } from './brick.types.js';
import { BrickCreateInputSchema, BrickUpdateInputSchema } from './brick.schema.js';

// Append-only store — entries are never removed or mutated.
// Multiple entries with the same brickId represent historical versions.
export const brickStore: Brick[] = [];

export class BrickService {
  constructor(private readonly store: Brick[] = brickStore) {}

  createBrick(input: BrickCreateInput): Brick {
    const parsed = BrickCreateInputSchema.parse(input);
    const now = new Date().toISOString();

    const brick: Brick = {
      brickId: randomUUID(),
      brickType: parsed.brickType,
      stateTag: parsed.stateTag,
      lifecycle: 'draft',
      name: parsed.name,
      description: parsed.description,
      version: 1,
      createdAt: now,
      updatedAt: now,
      metadata: parsed.metadata ?? {},
    };

    this.store.push(brick);
    return brick;
  }

  updateBrick(input: BrickUpdateInput): Brick {
    const parsed = BrickUpdateInputSchema.parse(input);
    const latest = this.getBrickById(parsed.brickId);

    if (!latest) {
      throw new Error(`Brick not found: ${parsed.brickId}`);
    }

    const now = new Date().toISOString();

    // Appends a new version — never mutates the prior entry.
    const updated: Brick = {
      ...latest,
      lifecycle: parsed.lifecycle ?? latest.lifecycle,
      description: parsed.description ?? latest.description,
      metadata: parsed.metadata !== undefined ? { ...latest.metadata, ...parsed.metadata } : latest.metadata,
      version: latest.version + 1,
      updatedAt: now,
    };

    this.store.push(updated);
    return updated;
  }

  getBrickById(brickId: string): Brick | undefined {
    // Walk in reverse to find the latest version efficiently.
    for (let i = this.store.length - 1; i >= 0; i--) {
      if (this.store[i].brickId === brickId) {
        return this.store[i];
      }
    }
    return undefined;
  }

  getBrickHistory(brickId: string): Brick[] {
    return this.store.filter((b) => b.brickId === brickId);
  }

  getAllBricks(): Brick[] {
    // Collect only the latest version of each brickId.
    const latestMap = new Map<string, Brick>();
    for (const brick of this.store) {
      latestMap.set(brick.brickId, brick);
    }
    return Array.from(latestMap.values());
  }
}
