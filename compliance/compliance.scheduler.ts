export class ComplianceScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastRun: string | null = null;

  start(intervalMs: number, callback: () => void): void {
    if (this.intervalId !== null) {
      throw new Error('ComplianceScheduler is already running. Call stop() before starting again.');
    }

    this.intervalId = setInterval(() => {
      this.lastRun = new Date().toISOString();
      callback();
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  getLastRun(): string | null {
    return this.lastRun;
  }
}

export const complianceScheduler: ComplianceScheduler = new ComplianceScheduler();
