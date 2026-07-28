export interface UnifiedCheckpoint {
  id: string;
  label: string;
  restored: boolean;
  position: { x: number; y: number };
}

export interface MissionTimerState {
  id: string;
  durationMs: number;
  elapsedMs: number;
  running: boolean;
}

export class CheckpointTimerSystem {
  private readonly checkpoints = new Map<string, UnifiedCheckpoint>();
  private readonly timers = new Map<string, MissionTimerState>();

  activateCheckpoint(checkpoint: UnifiedCheckpoint): void {
    this.checkpoints.set(checkpoint.id, { ...checkpoint, restored: true });
  }

  defineTimer(id: string, durationMs: number): void {
    this.timers.set(id, {
      id,
      durationMs,
      elapsedMs: 0,
      running: false
    });
  }

  startTimer(id: string): void {
    const timer = this.timers.get(id);
    if (!timer) {
      return;
    }

    timer.running = true;
  }

  updateTimer(id: string, deltaMs: number): void {
    const timer = this.timers.get(id);
    if (!timer || !timer.running) {
      return;
    }

    timer.elapsedMs = Math.min(timer.durationMs, timer.elapsedMs + Math.max(0, deltaMs));
    if (timer.elapsedMs >= timer.durationMs) {
      timer.running = false;
    }
  }

  getSnapshot(): {
    checkpoints: UnifiedCheckpoint[];
    timers: MissionTimerState[];
  } {
    return {
      checkpoints: [...this.checkpoints.values()].map((checkpoint) => ({ ...checkpoint })),
      timers: [...this.timers.values()].map((timer) => ({ ...timer }))
    };
  }
}
