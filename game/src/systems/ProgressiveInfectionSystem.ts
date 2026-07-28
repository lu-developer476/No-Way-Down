export type InfectionSeverity = 'leve' | 'moderada' | 'grave' | 'critica';

export interface InfectionGroupImpact {
  aimStabilityDelta?: number;
  movementSpeedDelta?: number;
  reloadSpeedDelta?: number;
  moraleDelta?: number;
}

export interface InfectionNarrativeHooks {
  rescueLine?: string;
  helpLine?: string;
  postSceneTag?: string;
}

export interface InfectionStageConfig {
  id: string;
  label: string;
  thresholdMs: number;
  severity: InfectionSeverity;
  description: string;
  visualCues: string[];
  behaviorFlags: string[];
  hudMessage?: string;
  groupImpact?: InfectionGroupImpact;
  narrativeHooks?: InfectionNarrativeHooks;
}

export interface ProgressiveInfectionConfig {
  levelId: string;
  infectionId: string;
  totalDurationMs: number;
  registryKey?: string;
  autoStart?: boolean;
  stages: InfectionStageConfig[];
}

export interface ProgressiveInfectionSnapshot {
  levelId: string;
  infectionId: string;
  state: 'idle' | 'running' | 'paused' | 'completed';
  elapsedMs: number;
  totalDurationMs: number;
  normalizedProgress: number;
  currentStageId?: string;
  completedStageIds: string[];
  pendingStageIds: string[];
  rescueEvents: number;
  helpEvents: number;
}

export interface InfectionRescueEvent {
  rescueId: string;
  description?: string;
}

export interface InfectionHelpEvent {
  helperId: string;
  description?: string;
}

export interface PostSceneInfectionPayload {
  sceneId: string;
  infectionId: string;
  stageId?: string;
  severity?: InfectionSeverity;
  behaviorFlags: string[];
  postSceneTag?: string;
  summaryLine: string;
}

export interface ProgressiveInfectionCallbacks {
  onStarted?: (snapshot: ProgressiveInfectionSnapshot) => void;
  onPaused?: (snapshot: ProgressiveInfectionSnapshot) => void;
  onResumed?: (snapshot: ProgressiveInfectionSnapshot) => void;
  onCompleted?: (snapshot: ProgressiveInfectionSnapshot) => void;
  onStateChanged?: (snapshot: ProgressiveInfectionSnapshot) => void;
  onStageChanged?: (stage: InfectionStageConfig, snapshot: ProgressiveInfectionSnapshot) => void;
  onVisualCueRequested?: (payload: { infectionId: string; stageId: string; cues: string[] }) => void;
  onHudMessageRequested?: (payload: { infectionId: string; stageId: string; message: string }) => void;
  onBehaviorUpdated?: (payload: {
    infectionId: string;
    stageId: string;
    behaviorFlags: string[];
    groupImpact?: InfectionGroupImpact;
  }) => void;
  onRescueReactionRequested?: (payload: {
    event: InfectionRescueEvent;
    stage: InfectionStageConfig;
    snapshot: ProgressiveInfectionSnapshot;
    line?: string;
  }) => void;
  onHelpReactionRequested?: (payload: {
    event: InfectionHelpEvent;
    stage: InfectionStageConfig;
    snapshot: ProgressiveInfectionSnapshot;
    line?: string;
  }) => void;
}

/**
 * Sistema narrativo ligero para mostrar el avance de una infección durante
 * la resistencia principal del Nivel 10.
 *
 * Diseño:
 * - El tiempo de combate hace avanzar etapas discretas (sin simulación médica).
 * - Cada etapa publica señales visuales, de HUD y banderas de comportamiento.
 * - Expone hooks para rescate/ayuda/escenas posteriores sin acoplarse al HUD real.
 */
export class ProgressiveInfectionSystem {
  private readonly config: ProgressiveInfectionConfig;
  private readonly callbacks: ProgressiveInfectionCallbacks;
  private readonly registryKey: string;

  private elapsedMs = 0;
  private currentStageIndex = -1;
  private readonly completedStageIds = new Set<string>();
  private rescueEvents = 0;
  private helpEvents = 0;
  private state: ProgressiveInfectionSnapshot['state'] = 'idle';

  static fromJson(config: ProgressiveInfectionConfig, callbacks: ProgressiveInfectionCallbacks = {}): ProgressiveInfectionSystem {
    return new ProgressiveInfectionSystem(config, callbacks);
  }

  constructor(config: ProgressiveInfectionConfig, callbacks: ProgressiveInfectionCallbacks = {}) {
    this.validateConfig(config);
    this.config = {
      ...config,
      stages: [...config.stages].sort((a, b) => a.thresholdMs - b.thresholdMs)
    };
    this.callbacks = callbacks;
    this.registryKey = config.registryKey ?? 'level10ProgressiveInfection';

    if (this.config.autoStart) {
      this.start();
    }
  }

  getRegistryKey(): string {
    return this.registryKey;
  }

  start(): void {
    if (this.state !== 'idle') {
      return;
    }

    this.state = 'running';
    this.pushReachedStages();
    const snapshot = this.getSnapshot();
    this.callbacks.onStarted?.(snapshot);
    this.emitStateChanged();
  }

  pause(): void {
    if (this.state !== 'running') {
      return;
    }

    this.state = 'paused';
    const snapshot = this.getSnapshot();
    this.callbacks.onPaused?.(snapshot);
    this.emitStateChanged();
  }

  resume(): void {
    if (this.state !== 'paused') {
      return;
    }

    this.state = 'running';
    const snapshot = this.getSnapshot();
    this.callbacks.onResumed?.(snapshot);
    this.emitStateChanged();
  }

  reset(): void {
    this.elapsedMs = 0;
    this.currentStageIndex = -1;
    this.completedStageIds.clear();
    this.rescueEvents = 0;
    this.helpEvents = 0;
    this.state = 'idle';
    this.emitStateChanged();
  }

  update(deltaMs: number): void {
    if (this.state !== 'running') {
      return;
    }

    this.elapsedMs = Math.min(this.config.totalDurationMs, this.elapsedMs + Math.max(0, deltaMs));
    this.pushReachedStages();

    if (this.elapsedMs >= this.config.totalDurationMs) {
      this.state = 'completed';
      const snapshot = this.getSnapshot();
      this.callbacks.onCompleted?.(snapshot);
      this.emitStateChanged();
      return;
    }

    this.emitStateChanged();
  }

  reportRescueEvent(event: InfectionRescueEvent): void {
    this.rescueEvents += 1;
    const stage = this.getCurrentStage();
    if (!stage) {
      return;
    }

    this.callbacks.onRescueReactionRequested?.({
      event,
      stage,
      snapshot: this.getSnapshot(),
      line: stage.narrativeHooks?.rescueLine
    });
  }

  reportHelpEvent(event: InfectionHelpEvent): void {
    this.helpEvents += 1;
    const stage = this.getCurrentStage();
    if (!stage) {
      return;
    }

    this.callbacks.onHelpReactionRequested?.({
      event,
      stage,
      snapshot: this.getSnapshot(),
      line: stage.narrativeHooks?.helpLine
    });
  }

  buildPostScenePayload(sceneId: string): PostSceneInfectionPayload {
    const stage = this.getCurrentStage();

    return {
      sceneId,
      infectionId: this.config.infectionId,
      stageId: stage?.id,
      severity: stage?.severity,
      behaviorFlags: [...(stage?.behaviorFlags ?? [])],
      postSceneTag: stage?.narrativeHooks?.postSceneTag,
      summaryLine: stage
        ? `${stage.label}: ${stage.description}`
        : 'Sin síntomas visibles aún, pero la mordida sigue siendo un riesgo latente.'
    };
  }

  getSnapshot(): ProgressiveInfectionSnapshot {
    const completedStageIds = [...this.completedStageIds];
    const pendingStageIds = this.config.stages
      .filter((stage) => !this.completedStageIds.has(stage.id))
      .map((stage) => stage.id);

    return {
      levelId: this.config.levelId,
      infectionId: this.config.infectionId,
      state: this.state,
      elapsedMs: this.elapsedMs,
      totalDurationMs: this.config.totalDurationMs,
      normalizedProgress: this.config.totalDurationMs > 0 ? this.elapsedMs / this.config.totalDurationMs : 1,
      currentStageId: this.getCurrentStage()?.id,
      completedStageIds,
      pendingStageIds,
      rescueEvents: this.rescueEvents,
      helpEvents: this.helpEvents
    };
  }

  private pushReachedStages(): void {
    let changed = false;

    for (let nextIndex = this.currentStageIndex + 1; nextIndex < this.config.stages.length; nextIndex += 1) {
      const stage = this.config.stages[nextIndex];
      if (this.elapsedMs < stage.thresholdMs) {
        break;
      }

      this.currentStageIndex = nextIndex;
      this.completedStageIds.add(stage.id);
      this.emitStage(stage);
      changed = true;
    }

    if (!changed) {
      return;
    }

    this.emitStateChanged();
  }

  private emitStage(stage: InfectionStageConfig): void {
    const snapshot = this.getSnapshot();

    this.callbacks.onStageChanged?.(stage, snapshot);
    this.callbacks.onVisualCueRequested?.({
      infectionId: this.config.infectionId,
      stageId: stage.id,
      cues: [...stage.visualCues]
    });

    if (stage.hudMessage) {
      this.callbacks.onHudMessageRequested?.({
        infectionId: this.config.infectionId,
        stageId: stage.id,
        message: stage.hudMessage
      });
    }

    this.callbacks.onBehaviorUpdated?.({
      infectionId: this.config.infectionId,
      stageId: stage.id,
      behaviorFlags: [...stage.behaviorFlags],
      groupImpact: stage.groupImpact
    });
  }

  private getCurrentStage(): InfectionStageConfig | undefined {
    if (this.currentStageIndex < 0 || this.currentStageIndex >= this.config.stages.length) {
      return undefined;
    }

    return this.config.stages[this.currentStageIndex];
  }

  private emitStateChanged(): void {
    this.callbacks.onStateChanged?.(this.getSnapshot());
  }

  private validateConfig(config: ProgressiveInfectionConfig): void {
    if (!config.levelId.trim()) {
      throw new Error('ProgressiveInfectionSystem: levelId es obligatorio.');
    }

    if (!config.infectionId.trim()) {
      throw new Error('ProgressiveInfectionSystem: infectionId es obligatorio.');
    }

    if (config.totalDurationMs <= 0) {
      throw new Error('ProgressiveInfectionSystem: totalDurationMs debe ser mayor a 0.');
    }

    if (config.stages.length === 0) {
      throw new Error('ProgressiveInfectionSystem: se requiere al menos 1 etapa.');
    }

    const stageIds = new Set<string>();
    let hasZeroThresholdStage = false;

    config.stages.forEach((stage) => {
      if (!stage.id.trim()) {
        throw new Error('ProgressiveInfectionSystem: cada etapa requiere id no vacío.');
      }

      if (stageIds.has(stage.id)) {
        throw new Error(`ProgressiveInfectionSystem: etapa duplicada "${stage.id}".`);
      }
      stageIds.add(stage.id);

      if (!stage.label.trim()) {
        throw new Error(`ProgressiveInfectionSystem: la etapa "${stage.id}" requiere label.`);
      }

      if (!stage.description.trim()) {
        throw new Error(`ProgressiveInfectionSystem: la etapa "${stage.id}" requiere description.`);
      }

      if (stage.thresholdMs < 0 || stage.thresholdMs > config.totalDurationMs) {
        throw new Error(
          `ProgressiveInfectionSystem: thresholdMs inválido en "${stage.id}". Debe estar entre 0 y totalDurationMs.`
        );
      }

      if (stage.thresholdMs === 0) {
        hasZeroThresholdStage = true;
      }

      if (stage.visualCues.length === 0) {
        throw new Error(`ProgressiveInfectionSystem: la etapa "${stage.id}" requiere visualCues.`);
      }

      if (stage.behaviorFlags.length === 0) {
        throw new Error(`ProgressiveInfectionSystem: la etapa "${stage.id}" requiere behaviorFlags.`);
      }
    });

    if (!hasZeroThresholdStage) {
      throw new Error('ProgressiveInfectionSystem: debe existir una etapa inicial con thresholdMs = 0.');
    }
  }
}
