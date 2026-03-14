export type Level10NarrativeState = 'locked' | 'active' | 'completed' | 'failed';

export type Level10NarrativeEventType =
  | 'cinematic-played'
  | 'parking-explored'
  | 'resources-secured'
  | 'twin-bitten'
  | 'usable-car-discovered'
  | 'resistance-started'
  | 'resistance-completed'
  | 'infection-progressed'
  | 'sister-death-cinematic-played'
  | 'duo-escaped'
  | 'road-cinematic-played'
  | 'ambush-triggered'
  | 'open-ending-cinematic-played'
  | 'manual-complete'
  | 'manual-fail';

export interface Level10NarrativeRule {
  type: Level10NarrativeEventType;
  targetId?: string;
  durationMs?: number;
}

export interface Level10NarrativeBeat {
  id: string;
  label: string;
  description: string;
  completion: Level10NarrativeRule;
  failure?: Level10NarrativeRule;
  visualPlaceholders: string[];
}

export interface Level10NarrativeConfig {
  levelId: string;
  registryKey?: string;
  failChainOnObjectiveFailure?: boolean;
  beats: Level10NarrativeBeat[];
}

export interface Level10NarrativeEvent {
  type: Level10NarrativeEventType;
  targetId?: string;
  durationMs?: number;
}

export interface Level10NarrativeSnapshot {
  levelId: string;
  activeBeatId?: string;
  chainState: 'running' | 'completed' | 'failed';
  beats: Array<{
    id: string;
    label: string;
    state: Level10NarrativeState;
    completedAt?: number;
    failedAt?: number;
  }>;
}

export interface Level10NarrativeCallbacks {
  onBeatActivated?: (beat: Level10NarrativeBeat, snapshot: Level10NarrativeSnapshot) => void;
  onBeatCompleted?: (beat: Level10NarrativeBeat, trigger: Level10NarrativeEvent, snapshot: Level10NarrativeSnapshot) => void;
  onBeatFailed?: (beat: Level10NarrativeBeat, trigger: Level10NarrativeEvent, snapshot: Level10NarrativeSnapshot) => void;
  onVisualCueRequested?: (payload: { beatId: string; visualPlaceholder: string }) => void;
  onChainCompleted?: (snapshot: Level10NarrativeSnapshot) => void;
  onChainFailed?: (snapshot: Level10NarrativeSnapshot) => void;
  onStateChanged?: (snapshot: Level10NarrativeSnapshot) => void;
}

interface RuntimeBeat {
  config: Level10NarrativeBeat;
  state: Level10NarrativeState;
  completedAt?: number;
  failedAt?: number;
}

/**
 * Cadena narrativa del Nivel 10 (estacionamiento + escape hacia San Telmo).
 *
 * El sistema consume eventos de dominio para evitar acoplar la progresión
 * narrativa directamente a GameScene.
 */
export class Level10NarrativeSystem {
  private readonly config: Level10NarrativeConfig;
  private readonly callbacks: Level10NarrativeCallbacks;
  private readonly runtimeBeats: RuntimeBeat[];
  private readonly failChainOnObjectiveFailure: boolean;
  private activeBeatIndex: number;

  static fromJson(config: Level10NarrativeConfig, callbacks: Level10NarrativeCallbacks = {}): Level10NarrativeSystem {
    return new Level10NarrativeSystem(config, callbacks);
  }

  constructor(config: Level10NarrativeConfig, callbacks: Level10NarrativeCallbacks = {}) {
    this.validateConfig(config);

    this.config = config;
    this.callbacks = callbacks;
    this.failChainOnObjectiveFailure = config.failChainOnObjectiveFailure ?? true;
    this.runtimeBeats = config.beats.map((beat, index) => ({
      config: beat,
      state: index === 0 ? 'active' : 'locked'
    }));

    this.activeBeatIndex = this.runtimeBeats.findIndex((beat) => beat.state === 'active');

    this.emitStateChanged();
    const activeBeat = this.getActiveBeat();
    if (activeBeat) {
      this.callbacks.onBeatActivated?.(activeBeat.config, this.getSnapshot());
      this.emitVisualCues(activeBeat.config);
    }
  }

  getSnapshot(): Level10NarrativeSnapshot {
    return {
      levelId: this.config.levelId,
      activeBeatId: this.getActiveBeat()?.config.id,
      chainState: this.getChainState(),
      beats: this.runtimeBeats.map((beat) => ({
        id: beat.config.id,
        label: beat.config.label,
        state: beat.state,
        completedAt: beat.completedAt,
        failedAt: beat.failedAt
      }))
    };
  }

  processEvent(event: Level10NarrativeEvent): Level10NarrativeBeat[] {
    if (this.isTerminalState()) {
      return [];
    }

    const activeBeat = this.getActiveBeat();
    if (!activeBeat || activeBeat.state !== 'active') {
      return [];
    }

    if (activeBeat.config.failure && this.matchesRule(activeBeat.config.failure, event)) {
      this.failBeat(activeBeat, event);
      return [];
    }

    if (!this.matchesRule(activeBeat.config.completion, event)) {
      return [];
    }

    return this.completeBeat(activeBeat, event);
  }

  completeActiveBeatManually(): Level10NarrativeBeat[] {
    return this.processEvent({ type: 'manual-complete' });
  }

  failActiveBeatManually(): void {
    this.processEvent({ type: 'manual-fail' });
  }

  private getActiveBeat(): RuntimeBeat | undefined {
    return this.runtimeBeats[this.activeBeatIndex];
  }

  private completeBeat(activeBeat: RuntimeBeat, event: Level10NarrativeEvent): Level10NarrativeBeat[] {
    activeBeat.state = 'completed';
    activeBeat.completedAt = Date.now();

    this.activeBeatIndex += 1;
    const nextBeat = this.runtimeBeats[this.activeBeatIndex];
    if (nextBeat) {
      nextBeat.state = 'active';
    }

    const snapshot = this.getSnapshot();
    this.callbacks.onBeatCompleted?.(activeBeat.config, event, snapshot);

    if (nextBeat) {
      this.callbacks.onBeatActivated?.(nextBeat.config, snapshot);
      this.emitVisualCues(nextBeat.config);
    } else {
      this.callbacks.onChainCompleted?.(snapshot);
    }

    this.emitStateChanged();
    return [activeBeat.config];
  }

  private failBeat(activeBeat: RuntimeBeat, event: Level10NarrativeEvent): void {
    activeBeat.state = 'failed';
    activeBeat.failedAt = Date.now();

    if (this.failChainOnObjectiveFailure) {
      this.activeBeatIndex = -1;
    }

    const snapshot = this.getSnapshot();
    this.callbacks.onBeatFailed?.(activeBeat.config, event, snapshot);

    if (this.failChainOnObjectiveFailure) {
      this.callbacks.onChainFailed?.(snapshot);
      this.emitStateChanged();
      return;
    }

    this.activeBeatIndex += 1;
    const nextBeat = this.runtimeBeats[this.activeBeatIndex];
    if (nextBeat) {
      nextBeat.state = 'active';
      this.callbacks.onBeatActivated?.(nextBeat.config, this.getSnapshot());
      this.emitVisualCues(nextBeat.config);
    }

    this.emitStateChanged();
  }

  private matchesRule(rule: Level10NarrativeRule, event: Level10NarrativeEvent): boolean {
    if (rule.type !== event.type) {
      return false;
    }

    if (rule.targetId && rule.targetId !== event.targetId) {
      return false;
    }

    if (typeof rule.durationMs === 'number' && rule.durationMs !== event.durationMs) {
      return false;
    }

    return true;
  }

  private getChainState(): 'running' | 'completed' | 'failed' {
    if (this.runtimeBeats.some((beat) => beat.state === 'failed')) {
      return 'failed';
    }

    if (this.runtimeBeats.every((beat) => beat.state === 'completed')) {
      return 'completed';
    }

    return 'running';
  }

  private isTerminalState(): boolean {
    const state = this.getChainState();
    return state === 'completed' || state === 'failed';
  }

  private emitVisualCues(beat: Level10NarrativeBeat): void {
    beat.visualPlaceholders.forEach((visualPlaceholder) => {
      this.callbacks.onVisualCueRequested?.({ beatId: beat.id, visualPlaceholder });
    });
  }

  private emitStateChanged(): void {
    this.callbacks.onStateChanged?.(this.getSnapshot());
  }

  private validateConfig(config: Level10NarrativeConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level10NarrativeSystem: levelId es obligatorio.');
    }

    if (config.beats.length === 0) {
      throw new Error('Level10NarrativeSystem: beats debe tener al menos 1 elemento.');
    }

    const beatIds = new Set<string>();
    config.beats.forEach((beat) => {
      if (beat.id.trim().length === 0) {
        throw new Error('Level10NarrativeSystem: cada beat requiere id no vacío.');
      }

      if (beatIds.has(beat.id)) {
        throw new Error(`Level10NarrativeSystem: id de beat duplicado "${beat.id}".`);
      }
      beatIds.add(beat.id);

      if (beat.label.trim().length === 0) {
        throw new Error(`Level10NarrativeSystem: el beat "${beat.id}" requiere label.`);
      }

      if (beat.description.trim().length === 0) {
        throw new Error(`Level10NarrativeSystem: el beat "${beat.id}" requiere description.`);
      }

      if (beat.visualPlaceholders.length === 0) {
        throw new Error(`Level10NarrativeSystem: el beat "${beat.id}" requiere visualPlaceholders.`);
      }

      if (beat.completion.type !== 'manual-complete' && !beat.completion.targetId) {
        throw new Error(
          `Level10NarrativeSystem: el beat "${beat.id}" requiere completion.targetId cuando completion.type != manual-complete.`
        );
      }

      if (beat.failure && beat.failure.type !== 'manual-fail' && !beat.failure.targetId) {
        throw new Error(
          `Level10NarrativeSystem: el beat "${beat.id}" requiere failure.targetId cuando failure.type != manual-fail.`
        );
      }
    });
  }
}
