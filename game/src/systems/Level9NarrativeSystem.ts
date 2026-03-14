export type Level9NarrativeState = 'locked' | 'active' | 'completed' | 'failed';

export type Level9NarrativeEventType =
  | 'section-entered'
  | 'floor-reached'
  | 'exit-attempted'
  | 'exit-explored'
  | 'exit-state-confirmed'
  | 'ally-lost'
  | 'cinematic-played'
  | 'stairs-unlocked'
  | 'stairs-reached'
  | 'manual-complete'
  | 'manual-fail';

export type Level9ExitState = 'obstruida' | 'infectada' | 'operativa_persianas_bajas';

export interface Level9NarrativeRule {
  type: Level9NarrativeEventType;
  targetId?: string;
  exitState?: Level9ExitState;
  allyCount?: number;
}

export interface Level9NarrativeBeat {
  id: string;
  label: string;
  description?: string;
  visualPlaceholder?: string;
  completion: Level9NarrativeRule;
  failure?: Level9NarrativeRule;
}

export interface Level9NarrativeConfig {
  levelId: string;
  registryKey?: string;
  failChainOnObjectiveFailure?: boolean;
  beats: Level9NarrativeBeat[];
}

export interface Level9NarrativeEvent {
  type: Level9NarrativeEventType;
  targetId?: string;
  exitState?: Level9ExitState;
  allyCount?: number;
}

export interface Level9NarrativeSnapshot {
  levelId: string;
  activeBeatId?: string;
  chainState: 'running' | 'completed' | 'failed';
  beats: Array<{
    id: string;
    label: string;
    state: Level9NarrativeState;
    visualPlaceholder?: string;
    completedAt?: number;
    failedAt?: number;
  }>;
}

export interface Level9NarrativeCallbacks {
  onBeatActivated?: (beat: Level9NarrativeBeat, snapshot: Level9NarrativeSnapshot) => void;
  onBeatCompleted?: (beat: Level9NarrativeBeat, trigger: Level9NarrativeEvent, snapshot: Level9NarrativeSnapshot) => void;
  onBeatFailed?: (beat: Level9NarrativeBeat, trigger: Level9NarrativeEvent, snapshot: Level9NarrativeSnapshot) => void;
  onVisualCueRequested?: (payload: { beatId: string; visualPlaceholder: string }) => void;
  onChainCompleted?: (snapshot: Level9NarrativeSnapshot) => void;
  onChainFailed?: (snapshot: Level9NarrativeSnapshot) => void;
  onStateChanged?: (snapshot: Level9NarrativeSnapshot) => void;
}

interface RuntimeBeat {
  config: Level9NarrativeBeat;
  state: Level9NarrativeState;
  completedAt?: number;
  failedAt?: number;
}

/**
 * Cadena narrativa del Nivel 9 desacoplada de GameScene.
 *
 * Objetivo: permitir que la escena sólo emita eventos de gameplay
 * mientras este sistema mantiene estado, progresión y validación de beats.
 */
export class Level9NarrativeSystem {
  private readonly config: Level9NarrativeConfig;
  private readonly callbacks: Level9NarrativeCallbacks;
  private readonly runtimeBeats: RuntimeBeat[];
  private readonly failChainOnObjectiveFailure: boolean;
  private activeBeatIndex: number;

  static fromJson(config: Level9NarrativeConfig, callbacks: Level9NarrativeCallbacks = {}): Level9NarrativeSystem {
    return new Level9NarrativeSystem(config, callbacks);
  }

  constructor(config: Level9NarrativeConfig, callbacks: Level9NarrativeCallbacks = {}) {
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
      this.emitVisualCue(activeBeat.config);
    }
  }

  getSnapshot(): Level9NarrativeSnapshot {
    return {
      levelId: this.config.levelId,
      activeBeatId: this.getActiveBeat()?.config.id,
      chainState: this.getChainState(),
      beats: this.runtimeBeats.map((beat) => ({
        id: beat.config.id,
        label: beat.config.label,
        state: beat.state,
        visualPlaceholder: beat.config.visualPlaceholder,
        completedAt: beat.completedAt,
        failedAt: beat.failedAt
      }))
    };
  }

  getActiveBeat(): RuntimeBeat | undefined {
    return this.runtimeBeats[this.activeBeatIndex];
  }

  processEvent(event: Level9NarrativeEvent): Level9NarrativeBeat[] {
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

  completeActiveBeatManually(): Level9NarrativeBeat[] {
    return this.processEvent({ type: 'manual-complete' });
  }

  failActiveBeatManually(): void {
    this.processEvent({ type: 'manual-fail' });
  }

  private completeBeat(activeBeat: RuntimeBeat, event: Level9NarrativeEvent): Level9NarrativeBeat[] {
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
      this.emitVisualCue(nextBeat.config);
    } else {
      this.callbacks.onChainCompleted?.(snapshot);
    }

    this.emitStateChanged();
    return [activeBeat.config];
  }

  private failBeat(activeBeat: RuntimeBeat, event: Level9NarrativeEvent): void {
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
      this.emitVisualCue(nextBeat.config);
    }

    this.emitStateChanged();
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

  private matchesRule(rule: Level9NarrativeRule, event: Level9NarrativeEvent): boolean {
    if (rule.type !== event.type) {
      return false;
    }

    if (rule.targetId && rule.targetId !== event.targetId) {
      return false;
    }

    if (rule.exitState && rule.exitState !== event.exitState) {
      return false;
    }

    if (typeof rule.allyCount === 'number' && rule.allyCount !== event.allyCount) {
      return false;
    }

    return true;
  }

  private emitVisualCue(beat: Level9NarrativeBeat): void {
    if (!beat.visualPlaceholder || beat.visualPlaceholder.trim().length === 0) {
      return;
    }

    this.callbacks.onVisualCueRequested?.({
      beatId: beat.id,
      visualPlaceholder: beat.visualPlaceholder
    });
  }

  private validateConfig(config: Level9NarrativeConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level9NarrativeSystem: levelId es obligatorio.');
    }

    if (config.beats.length === 0) {
      throw new Error('Level9NarrativeSystem: beats debe tener al menos 1 elemento.');
    }

    const beatIds = new Set<string>();

    config.beats.forEach((beat) => {
      if (beat.id.trim().length === 0) {
        throw new Error('Level9NarrativeSystem: cada beat requiere id no vacío.');
      }

      if (beatIds.has(beat.id)) {
        throw new Error(`Level9NarrativeSystem: id de beat duplicado "${beat.id}".`);
      }

      beatIds.add(beat.id);

      if (beat.label.trim().length === 0) {
        throw new Error(`Level9NarrativeSystem: el beat "${beat.id}" requiere label.`);
      }

      if (beat.completion.type !== 'manual-complete' && !beat.completion.targetId) {
        throw new Error(
          `Level9NarrativeSystem: el beat "${beat.id}" requiere completion.targetId cuando completion.type != manual-complete.`
        );
      }

      if (beat.failure && beat.failure.type !== 'manual-fail' && !beat.failure.targetId) {
        throw new Error(
          `Level9NarrativeSystem: el beat "${beat.id}" requiere failure.targetId cuando failure.type != manual-fail.`
        );
      }
    });
  }

  private emitStateChanged(): void {
    this.callbacks.onStateChanged?.(this.getSnapshot());
  }
}
