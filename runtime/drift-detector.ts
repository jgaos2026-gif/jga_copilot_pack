export interface DriftReport {
  brickId: string;
  drifted: boolean;
  driftedKeys: string[];
}

export class DriftDetector {
  private expectedStates: Map<string, Record<string, unknown>> = new Map();

  registerExpectedState(brickId: string, expectedState: Record<string, unknown>): void {
    this.expectedStates.set(brickId, { ...expectedState });
  }

  checkDrift(brickId: string, currentState: Record<string, unknown>): { drifted: boolean; driftedKeys: string[] } {
    const expected = this.expectedStates.get(brickId);
    if (!expected) {
      return { drifted: false, driftedKeys: [] };
    }

    const driftedKeys: string[] = [];
    const allKeys = new Set([...Object.keys(expected), ...Object.keys(currentState)]);

    for (const key of allKeys) {
      if (JSON.stringify(expected[key]) !== JSON.stringify(currentState[key])) {
        driftedKeys.push(key);
      }
    }

    return { drifted: driftedKeys.length > 0, driftedKeys };
  }

  runFullScan(brickStates: Map<string, Record<string, unknown>>): DriftReport[] {
    const results: DriftReport[] = [];

    for (const [brickId, currentState] of brickStates.entries()) {
      const { drifted, driftedKeys } = this.checkDrift(brickId, currentState);
      results.push({ brickId, drifted, driftedKeys });
    }

    return results;
  }
}

export const driftDetector: DriftDetector = new DriftDetector();
