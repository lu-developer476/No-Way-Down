import { ObjectiveSystem } from './core/ObjectiveSystem';

export type Level9ObjectiveState = 'locked' | 'active' | 'completed' | 'failed';

export type Level9ObjectiveEventType =
  | 'section-entered'
  | 'floor-reached'
  | 'exit-attempted'
  | 'exit-evaluated'
  | 'exit-backtracked'
  | 'cinematic-played'
  | 'combat-completed'
  | 'permanent-loss-applied'
  | 'stairs-reached'
  | 'group-escaped'
  | 'manual-complete'
  | 'manual-fail';

export interface Level9ObjectiveRule {
  type: Level9ObjectiveEventType;
  targetId?: string;
  minLosses?: number;
}

export interface Level9ObjectiveConfig {
  id: string;
  label: string;
  description?: string;
  completion: Level9ObjectiveRule;
  failure?: Level9ObjectiveRule;
}

export interface Level9ObjectiveChainConfig {
  levelId: string;
  registryKey?: string;
  failChainOnObjectiveFailure?: boolean;
  objectives: Level9ObjectiveConfig[];
}

export interface Level9ObjectiveEvent {
  type: Level9ObjectiveEventType;
  targetId?: string;
  losses?: number;
}

export interface Level9ObjectiveSnapshot {
  levelId: string;
  activeObjectiveId?: string;
  chainState: 'running' | 'completed' | 'failed';
  objectives: Array<{
    id: string;
    label: string;
    state: Level9ObjectiveState;
    completedAt?: number;
    failedAt?: number;
  }>;
}

export interface Level9ObjectiveChainCallbacks {
  onObjectiveActivated?: (objective: Level9ObjectiveConfig, snapshot: Level9ObjectiveSnapshot) => void;
  onObjectiveCompleted?: (
    objective: Level9ObjectiveConfig,
    trigger: Level9ObjectiveEvent,
    snapshot: Level9ObjectiveSnapshot
  ) => void;
  onObjectiveFailed?: (
    objective: Level9ObjectiveConfig,
    trigger: Level9ObjectiveEvent,
    snapshot: Level9ObjectiveSnapshot
  ) => void;
  onChainCompleted?: (snapshot: Level9ObjectiveSnapshot) => void;
  onChainFailed?: (snapshot: Level9ObjectiveSnapshot) => void;
  onStateChanged?: (snapshot: Level9ObjectiveSnapshot) => void;
}

interface RuntimeObjective {
  config: Level9ObjectiveConfig;
  state: Level9ObjectiveState;
  completedAt?: number;
  failedAt?: number;
}

/**
 * Cadena de objetivos del Nivel 9 configurable por JSON.
 *
 * - Soporta estados locked / active / completed / failed.
 * - Consume eventos desacoplados de cinemáticas, combate y pérdidas permanentes.
 * - Permite evitar hardcode en GameScene: sólo se emiten eventos de dominio.
 */
export class Level9ObjectiveChain {
  private readonly config: Level9ObjectiveChainConfig;
  private readonly callbacks: Level9ObjectiveChainCallbacks;
  private readonly runtimeObjectives: RuntimeObjective[];
  private readonly coreObjectiveSystem: ObjectiveSystem;
  private readonly failChainOnObjectiveFailure: boolean;
  private activeObjectiveIndex: number;

  static fromJson(
    config: Level9ObjectiveChainConfig,
    callbacks: Level9ObjectiveChainCallbacks = {}
  ): Level9ObjectiveChain {
    return new Level9ObjectiveChain(config, callbacks);
  }

  constructor(config: Level9ObjectiveChainConfig, callbacks: Level9ObjectiveChainCallbacks = {}) {
    this.validateConfig(config);

    this.config = config;
    this.callbacks = callbacks;
    this.failChainOnObjectiveFailure = config.failChainOnObjectiveFailure ?? true;
    this.runtimeObjectives = config.objectives.map((objective, index) => ({
      config: objective,
      state: index === 0 ? 'active' : 'locked'
    }));

    this.coreObjectiveSystem = new ObjectiveSystem(
      config.objectives.map((objective) => ({
        id: objective.id,
        label: objective.label,
        completion: [{ type: objective.completion.type, targetId: objective.completion.targetId }],
        failure: objective.failure ? { type: objective.failure.type, targetId: objective.failure.targetId } : undefined
      }))
    );

    this.activeObjectiveIndex = this.runtimeObjectives.findIndex((objective) => objective.state === 'active');

    this.emitStateChanged();

    const activeObjective = this.getActiveObjective();
    if (activeObjective) {
      this.callbacks.onObjectiveActivated?.(activeObjective.config, this.getSnapshot());
    }
  }

  getSnapshot(): Level9ObjectiveSnapshot {
    return {
      levelId: this.config.levelId,
      activeObjectiveId: this.getActiveObjective()?.config.id,
      chainState: this.getChainState(),
      objectives: this.runtimeObjectives.map((runtimeObjective) => ({
        id: runtimeObjective.config.id,
        label: runtimeObjective.config.label,
        state: runtimeObjective.state,
        completedAt: runtimeObjective.completedAt,
        failedAt: runtimeObjective.failedAt
      }))
    };
  }

  getActiveObjective(): RuntimeObjective | undefined {
    return this.runtimeObjectives[this.activeObjectiveIndex];
  }

  getObjectiveState(objectiveId: string): Level9ObjectiveState | undefined {
    return this.runtimeObjectives.find((objective) => objective.config.id === objectiveId)?.state;
  }

  processEvent(event: Level9ObjectiveEvent): Level9ObjectiveConfig[] {
    if (this.isTerminalState()) {
      return [];
    }

    const activeObjective = this.getActiveObjective();
    if (!activeObjective || activeObjective.state !== 'active') {
      return [];
    }

    if (activeObjective.config.failure && this.matchesRule(activeObjective.config.failure, event)) {
      this.coreObjectiveSystem.failActiveObjective();
      this.failObjective(activeObjective, event);
      return [];
    }

    if (!this.matchesRule(activeObjective.config.completion, event)) {
      return [];
    }

    const coreCompleted = this.coreObjectiveSystem.process({ type: event.type, targetId: event.targetId });
    if (!coreCompleted) {
      return [];
    }

    return this.completeObjective(activeObjective, event);
  }

  completeActiveObjectiveManually(): Level9ObjectiveConfig[] {
    return this.processEvent({ type: 'manual-complete' });
  }

  failActiveObjectiveManually(): void {
    this.processEvent({ type: 'manual-fail' });
  }

  private completeObjective(activeObjective: RuntimeObjective, event: Level9ObjectiveEvent): Level9ObjectiveConfig[] {
    activeObjective.state = 'completed';
    activeObjective.completedAt = Date.now();

    this.activeObjectiveIndex += 1;
    const nextObjective = this.runtimeObjectives[this.activeObjectiveIndex];
    if (nextObjective) {
      nextObjective.state = 'active';
    }

    const snapshot = this.getSnapshot();
    this.callbacks.onObjectiveCompleted?.(activeObjective.config, event, snapshot);

    if (nextObjective) {
      this.callbacks.onObjectiveActivated?.(nextObjective.config, snapshot);
    } else {
      this.callbacks.onChainCompleted?.(snapshot);
    }

    this.emitStateChanged();
    return [activeObjective.config];
  }

  private failObjective(activeObjective: RuntimeObjective, event: Level9ObjectiveEvent): void {
    activeObjective.state = 'failed';
    activeObjective.failedAt = Date.now();

    if (this.failChainOnObjectiveFailure) {
      this.activeObjectiveIndex = -1;
    }

    const snapshot = this.getSnapshot();
    this.callbacks.onObjectiveFailed?.(activeObjective.config, event, snapshot);

    if (this.failChainOnObjectiveFailure) {
      this.callbacks.onChainFailed?.(snapshot);
      this.emitStateChanged();
      return;
    }

    this.activeObjectiveIndex += 1;
    const nextObjective = this.runtimeObjectives[this.activeObjectiveIndex];
    if (nextObjective) {
      nextObjective.state = 'active';
      this.callbacks.onObjectiveActivated?.(nextObjective.config, this.getSnapshot());
    }

    this.emitStateChanged();
  }

  private getChainState(): 'running' | 'completed' | 'failed' {
    if (this.runtimeObjectives.some((objective) => objective.state === 'failed')) {
      return 'failed';
    }

    if (this.runtimeObjectives.every((objective) => objective.state === 'completed')) {
      return 'completed';
    }

    return 'running';
  }

  private isTerminalState(): boolean {
    const chainState = this.getChainState();
    return chainState === 'completed' || chainState === 'failed';
  }

  private matchesRule(rule: Level9ObjectiveRule, event: Level9ObjectiveEvent): boolean {
    if (rule.type !== event.type) {
      return false;
    }

    if (rule.targetId && rule.targetId !== event.targetId) {
      return false;
    }

    if (typeof rule.minLosses === 'number' && (event.losses ?? 0) < rule.minLosses) {
      return false;
    }

    return true;
  }

  private validateConfig(config: Level9ObjectiveChainConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level9ObjectiveChain: levelId es obligatorio.');
    }

    if (!Array.isArray(config.objectives) || config.objectives.length === 0) {
      throw new Error('Level9ObjectiveChain: objectives debe tener al menos 1 objetivo.');
    }

    const objectiveIds = new Set<string>();

    config.objectives.forEach((objective) => {
      if (objective.id.trim().length === 0) {
        throw new Error('Level9ObjectiveChain: cada objetivo requiere un id no vacío.');
      }

      if (objectiveIds.has(objective.id)) {
        throw new Error(`Level9ObjectiveChain: id de objetivo duplicado "${objective.id}".`);
      }

      objectiveIds.add(objective.id);

      if (objective.label.trim().length === 0) {
        throw new Error(`Level9ObjectiveChain: el objetivo "${objective.id}" requiere label.`);
      }

      if (objective.completion.type !== 'manual-complete' && !objective.completion.targetId) {
        throw new Error(
          `Level9ObjectiveChain: el objetivo "${objective.id}" requiere completion.targetId cuando completion.type != manual-complete.`
        );
      }

      if (objective.failure && objective.failure.type !== 'manual-fail' && !objective.failure.targetId) {
        throw new Error(
          `Level9ObjectiveChain: el objetivo "${objective.id}" requiere failure.targetId cuando failure.type != manual-fail.`
        );
      }
    });
  }

  private emitStateChanged(): void {
    this.callbacks.onStateChanged?.(this.getSnapshot());
  }
}
