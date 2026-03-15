import { ObjectiveSystem } from './core/ObjectiveSystem';

export type Level8ObjectiveState = 'locked' | 'active' | 'completed' | 'failed';

export type Level8ObjectiveEventType =
  | 'section-entered'
  | 'route-selected'
  | 'stairs-reached'
  | 'floor-reached'
  | 'rescue-completed'
  | 'combat-completed'
  | 'cinematic-played'
  | 'checkpoint-restored'
  | 'timer-started'
  | 'timer-expired'
  | 'transition-enabled'
  | 'manual-complete'
  | 'manual-fail';

export interface Level8ObjectiveRule {
  type: Level8ObjectiveEventType;
  targetId?: string;
}

export interface Level8ObjectiveConfig {
  id: string;
  label: string;
  description?: string;
  completion: Level8ObjectiveRule;
  failure?: Level8ObjectiveRule;
}

export interface Level8ObjectiveChainConfig {
  levelId: string;
  registryKey?: string;
  failChainOnObjectiveFailure?: boolean;
  objectives: Level8ObjectiveConfig[];
}

export interface Level8ObjectiveEvent {
  type: Level8ObjectiveEventType;
  targetId?: string;
}

export interface Level8ObjectiveSnapshot {
  levelId: string;
  activeObjectiveId?: string;
  chainState: 'running' | 'completed' | 'failed';
  objectives: Array<{
    id: string;
    label: string;
    state: Level8ObjectiveState;
    completedAt?: number;
    failedAt?: number;
  }>;
}

export interface Level8ObjectiveChainCallbacks {
  onObjectiveActivated?: (objective: Level8ObjectiveConfig, snapshot: Level8ObjectiveSnapshot) => void;
  onObjectiveCompleted?: (
    objective: Level8ObjectiveConfig,
    trigger: Level8ObjectiveEvent,
    snapshot: Level8ObjectiveSnapshot
  ) => void;
  onObjectiveFailed?: (objective: Level8ObjectiveConfig, trigger: Level8ObjectiveEvent, snapshot: Level8ObjectiveSnapshot) => void;
  onChainCompleted?: (snapshot: Level8ObjectiveSnapshot) => void;
  onChainFailed?: (snapshot: Level8ObjectiveSnapshot) => void;
  onStateChanged?: (snapshot: Level8ObjectiveSnapshot) => void;
}

interface RuntimeObjective {
  config: Level8ObjectiveConfig;
  state: Level8ObjectiveState;
  completedAt?: number;
  failedAt?: number;
}

export class Level8ObjectiveChain {
  private readonly config: Level8ObjectiveChainConfig;
  private readonly callbacks: Level8ObjectiveChainCallbacks;
  private readonly runtimeObjectives: RuntimeObjective[];
  private readonly coreObjectiveSystem: ObjectiveSystem;
  private readonly failChainOnObjectiveFailure: boolean;
  private activeObjectiveIndex: number;

  static fromJson(
    config: Level8ObjectiveChainConfig,
    callbacks: Level8ObjectiveChainCallbacks = {}
  ): Level8ObjectiveChain {
    return new Level8ObjectiveChain(config, callbacks);
  }

  constructor(config: Level8ObjectiveChainConfig, callbacks: Level8ObjectiveChainCallbacks = {}) {
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

  getSnapshot(): Level8ObjectiveSnapshot {
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

  getObjectiveState(objectiveId: string): Level8ObjectiveState | undefined {
    return this.runtimeObjectives.find((objective) => objective.config.id === objectiveId)?.state;
  }

  getActiveObjective(): RuntimeObjective | undefined {
    return this.runtimeObjectives[this.activeObjectiveIndex];
  }

  isCompleted(): boolean {
    return this.getChainState() === 'completed';
  }

  isFailed(): boolean {
    return this.getChainState() === 'failed';
  }

  processEvent(event: Level8ObjectiveEvent): Level8ObjectiveConfig[] {
    if (this.isCompleted() || this.isFailed()) {
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

  completeActiveObjectiveManually(): Level8ObjectiveConfig[] {
    return this.processEvent({ type: 'manual-complete' });
  }

  failActiveObjectiveManually(): void {
    this.processEvent({ type: 'manual-fail' });
  }

  private completeObjective(activeObjective: RuntimeObjective, event: Level8ObjectiveEvent): Level8ObjectiveConfig[] {
    activeObjective.state = 'completed';
    activeObjective.completedAt = Date.now();

    const completedObjectives = [activeObjective.config];
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
    return completedObjectives;
  }

  private failObjective(activeObjective: RuntimeObjective, event: Level8ObjectiveEvent): void {
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

  private matchesRule(rule: Level8ObjectiveRule, event: Level8ObjectiveEvent): boolean {
    if (rule.type !== event.type) {
      return false;
    }

    if (!rule.targetId) {
      return true;
    }

    return rule.targetId === event.targetId;
  }

  private validateConfig(config: Level8ObjectiveChainConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level8ObjectiveChain: levelId es obligatorio.');
    }

    if (config.objectives.length === 0) {
      throw new Error('Level8ObjectiveChain: objectives debe tener al menos 1 objetivo.');
    }

    const ids = new Set<string>();

    config.objectives.forEach((objective) => {
      if (objective.id.trim().length === 0) {
        throw new Error('Level8ObjectiveChain: cada objetivo requiere un id no vacío.');
      }

      if (ids.has(objective.id)) {
        throw new Error(`Level8ObjectiveChain: id de objetivo duplicado "${objective.id}".`);
      }

      ids.add(objective.id);

      if (objective.label.trim().length === 0) {
        throw new Error(`Level8ObjectiveChain: el objetivo "${objective.id}" requiere label.`);
      }

      if (objective.completion.type !== 'manual-complete' && !objective.completion.targetId) {
        throw new Error(
          `Level8ObjectiveChain: el objetivo "${objective.id}" requiere completion.targetId cuando completion.type != manual-complete.`
        );
      }

      if (objective.failure && objective.failure.type !== 'manual-fail' && !objective.failure.targetId) {
        throw new Error(
          `Level8ObjectiveChain: el objetivo "${objective.id}" requiere failure.targetId cuando failure.type != manual-fail.`
        );
      }
    });
  }

  private emitStateChanged(): void {
    this.callbacks.onStateChanged?.(this.getSnapshot());
  }
}
