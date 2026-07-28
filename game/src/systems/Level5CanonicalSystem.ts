export type Level5CanonicalBeatState = 'locked' | 'active' | 'completed' | 'failed';

export type Level5CanonicalEventType =
  | 'timer-started'
  | 'floor-reached'
  | 'checkpoint-activated'
  | 'infected-wave-cleared'
  | 'cinematic-played'
  | 'door-defense-cleared'
  | 'context-shared'
  | 'coworkers-fled'
  | 'loot-secured'
  | 'level-finished'
  | 'manual-complete'
  | 'manual-fail';

export interface Level5CanonicalRule {
  type: Level5CanonicalEventType;
  targetId?: string;
  floor?: 1 | 2 | 3;
  count?: number;
}

export interface Level5CanonicalBeat {
  id: string;
  label: string;
  description: string;
  completion: Level5CanonicalRule;
  failure?: Level5CanonicalRule;
  visualPlaceholder?: string;
}

export interface Level5WaveGroup {
  id: string;
  floor: 1 | 2 | 3;
  label: string;
  infectedCount: number;
  spawnAnchors: Array<{ x: number; y: number }>;
}

export interface Level5CheckpointConfig {
  id: string;
  floor: 2 | 3;
  label: string;
  restorePosition: { x: number; y: number };
}

export interface Level5CanonicalConfig {
  levelId: string;
  timerMs: number;
  startsAtFloor: 3;
  doorEventFloor: 1;
  checkpointRegistryKey?: string;
  stateRegistryKey?: string;
  timerRegistryKey?: string;
  failChainOnObjectiveFailure?: boolean;
  checkpoints: Level5CheckpointConfig[];
  waveGroups: Level5WaveGroup[];
  beats: Level5CanonicalBeat[];
}

export interface Level5CanonicalEvent {
  type: Level5CanonicalEventType;
  targetId?: string;
  floor?: 1 | 2 | 3;
  count?: number;
}

export interface Level5CanonicalTimerSnapshot {
  startedAt?: number;
  deadlineAt?: number;
  remainingMs: number;
  formattedRemaining: string;
  state: 'idle' | 'running' | 'expired' | 'completed';
}

export interface Level5CanonicalSnapshot {
  levelId: string;
  activeBeatId?: string;
  chainState: 'running' | 'completed' | 'failed';
  activeCheckpointId?: string;
  restoredFloor?: 2 | 3;
  timer: Level5CanonicalTimerSnapshot;
  beats: Array<{ id: string; label: string; state: Level5CanonicalBeatState }>;
}

export interface Level5CanonicalCallbacks {
  onBeatActivated?: (beat: Level5CanonicalBeat, snapshot: Level5CanonicalSnapshot) => void;
  onBeatCompleted?: (beat: Level5CanonicalBeat, event: Level5CanonicalEvent, snapshot: Level5CanonicalSnapshot) => void;
  onBeatFailed?: (beat: Level5CanonicalBeat, event: Level5CanonicalEvent, snapshot: Level5CanonicalSnapshot) => void;
  onTimerTick?: (timer: Level5CanonicalTimerSnapshot, snapshot: Level5CanonicalSnapshot) => void;
  onTimerExpired?: (snapshot: Level5CanonicalSnapshot) => void;
  onStateChanged?: (snapshot: Level5CanonicalSnapshot) => void;
  onVisualCueRequested?: (payload: { beatId: string; visualPlaceholder: string }) => void;
}

interface RuntimeBeat {
  config: Level5CanonicalBeat;
  state: Level5CanonicalBeatState;
}

export class Level5CanonicalSystem {
  private readonly config: Level5CanonicalConfig;
  private readonly callbacks: Level5CanonicalCallbacks;
  private readonly runtimeBeats: RuntimeBeat[];
  private readonly failChainOnObjectiveFailure: boolean;

  private timerState: Level5CanonicalTimerSnapshot['state'] = 'idle';
  private timerStartedAt?: number;
  private timerDeadlineAt?: number;
  private lastSecondBroadcast?: number;
  private activeCheckpointId?: string;
  private restoredFloor?: 2 | 3;
  private activeBeatIndex = 0;

  constructor(config: Level5CanonicalConfig, callbacks: Level5CanonicalCallbacks = {}) {
    this.validateConfig(config);

    this.config = config;
    this.callbacks = callbacks;
    this.failChainOnObjectiveFailure = config.failChainOnObjectiveFailure ?? true;
    this.runtimeBeats = config.beats.map((beat, index) => ({
      config: beat,
      state: index === 0 ? 'active' : 'locked'
    }));

    this.emitStateChanged();
    this.emitBeatActivated();
  }

  startTimer(now = Date.now()): void {
    if (this.timerState === 'running') {
      return;
    }

    this.timerState = 'running';
    this.timerStartedAt = now;
    this.timerDeadlineAt = now + this.config.timerMs;
    this.lastSecondBroadcast = undefined;

    this.processEvent({ type: 'timer-started' });
    this.emitStateChanged();
  }

  update(now = Date.now()): void {
    if (this.timerState !== 'running' || this.timerDeadlineAt === undefined) {
      return;
    }

    const remainingMs = Math.max(0, this.timerDeadlineAt - now);
    const currentSecond = Math.ceil(remainingMs / 1000);

    if (this.lastSecondBroadcast !== currentSecond) {
      this.lastSecondBroadcast = currentSecond;
      this.callbacks.onTimerTick?.(this.getTimerSnapshot(now), this.getSnapshot(now));
    }

    if (remainingMs === 0) {
      this.timerState = 'expired';
      if (this.failChainOnObjectiveFailure) {
        const activeBeat = this.getActiveBeat();
        if (activeBeat) {
          activeBeat.state = 'failed';
        }
      }

      const snapshot = this.getSnapshot(now);
      this.callbacks.onTimerExpired?.(snapshot);
      this.emitStateChanged(now);
    }
  }

  processEvent(event: Level5CanonicalEvent, now = Date.now()): void {
    if (this.getChainState() !== 'running') {
      return;
    }

    if (event.type === 'checkpoint-activated' && event.targetId) {
      const checkpoint = this.config.checkpoints.find((entry) => entry.id === event.targetId);
      if (checkpoint) {
        this.activeCheckpointId = checkpoint.id;
        this.restoredFloor = checkpoint.floor;
      }
    }

    const activeBeat = this.getActiveBeat();
    if (!activeBeat || activeBeat.state !== 'active') {
      this.emitStateChanged(now);
      return;
    }

    if (activeBeat.config.failure && this.matchesRule(activeBeat.config.failure, event)) {
      activeBeat.state = 'failed';
      this.callbacks.onBeatFailed?.(activeBeat.config, event, this.getSnapshot(now));

      if (this.failChainOnObjectiveFailure) {
        this.emitStateChanged(now);
        return;
      }

      this.advanceBeat(activeBeat, undefined, now);
      return;
    }

    if (!this.matchesRule(activeBeat.config.completion, event)) {
      this.emitStateChanged(now);
      return;
    }

    this.advanceBeat(activeBeat, event, now);
  }

  getSnapshot(now = Date.now()): Level5CanonicalSnapshot {
    return {
      levelId: this.config.levelId,
      activeBeatId: this.getActiveBeat()?.config.id,
      chainState: this.getChainState(),
      activeCheckpointId: this.activeCheckpointId,
      restoredFloor: this.restoredFloor,
      timer: this.getTimerSnapshot(now),
      beats: this.runtimeBeats.map((beat) => ({
        id: beat.config.id,
        label: beat.config.label,
        state: beat.state
      }))
    };
  }

  private advanceBeat(activeBeat: RuntimeBeat, event?: Level5CanonicalEvent, now = Date.now()): void {
    activeBeat.state = 'completed';
    if (event) {
      this.callbacks.onBeatCompleted?.(activeBeat.config, event, this.getSnapshot(now));
    }

    this.activeBeatIndex += 1;
    const nextBeat = this.getActiveBeat();
    if (nextBeat) {
      nextBeat.state = 'active';
      this.emitBeatActivated(now);
    } else {
      this.timerState = this.timerState === 'expired' ? 'expired' : 'completed';
    }

    this.emitStateChanged(now);
  }

  private emitBeatActivated(now = Date.now()): void {
    const activeBeat = this.getActiveBeat();
    if (!activeBeat || activeBeat.state !== 'active') {
      return;
    }

    this.callbacks.onBeatActivated?.(activeBeat.config, this.getSnapshot(now));
    if (activeBeat.config.visualPlaceholder) {
      this.callbacks.onVisualCueRequested?.({
        beatId: activeBeat.config.id,
        visualPlaceholder: activeBeat.config.visualPlaceholder
      });
    }
  }

  private emitStateChanged(now = Date.now()): void {
    this.callbacks.onStateChanged?.(this.getSnapshot(now));
  }

  private getTimerSnapshot(now = Date.now()): Level5CanonicalTimerSnapshot {
    const remainingMs = this.timerDeadlineAt ? Math.max(0, this.timerDeadlineAt - now) : this.config.timerMs;
    return {
      startedAt: this.timerStartedAt,
      deadlineAt: this.timerDeadlineAt,
      remainingMs,
      formattedRemaining: Level5CanonicalSystem.formatDuration(remainingMs),
      state: this.timerState
    };
  }

  private getActiveBeat(): RuntimeBeat | undefined {
    return this.runtimeBeats[this.activeBeatIndex];
  }

  private getChainState(): 'running' | 'completed' | 'failed' {
    if (this.runtimeBeats.some((beat) => beat.state === 'failed')) {
      return 'failed';
    }

    if (this.runtimeBeats.length > 0 && this.runtimeBeats.every((beat) => beat.state === 'completed')) {
      return 'completed';
    }

    return 'running';
  }

  private matchesRule(rule: Level5CanonicalRule, event: Level5CanonicalEvent): boolean {
    if (rule.type !== event.type) {
      return false;
    }

    if (rule.targetId && rule.targetId !== event.targetId) {
      return false;
    }

    if (rule.floor !== undefined && rule.floor !== event.floor) {
      return false;
    }

    if (rule.count !== undefined && rule.count !== event.count) {
      return false;
    }

    return true;
  }

  private validateConfig(config: Level5CanonicalConfig): void {
    if (config.timerMs !== 5 * 60 * 1000) {
      throw new Error('Level5CanonicalSystem: el timer canónico debe ser de 5 minutos exactos.');
    }

    if (config.startsAtFloor !== 3) {
      throw new Error('Level5CanonicalSystem: el nivel canónico debe iniciar en el 3° piso.');
    }

    if (config.doorEventFloor !== 1) {
      throw new Error('Level5CanonicalSystem: el evento de puerta debe ocurrir en el 1° piso.');
    }

    const floors = new Set(config.checkpoints.map((checkpoint) => checkpoint.floor));
    if (!floors.has(2) || !floors.has(3)) {
      throw new Error('Level5CanonicalSystem: se requieren checkpoints en pisos 2 y 3.');
    }

    if (config.beats.length === 0) {
      throw new Error('Level5CanonicalSystem: se requieren beats narrativos.');
    }
  }

  static formatDuration(totalMs: number): string {
    const safeMs = Math.max(0, Math.floor(totalMs));
    const totalSeconds = Math.ceil(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
}
