import { ObjectiveSystem } from './core/ObjectiveSystem';

export type Level7ObjectiveState = 'locked' | 'active' | 'completed';

export type Level7ObjectiveCompletionEventType =
  | 'section-entered'
  | 'checkpoint-completed'
  | 'combat-zone-cleared'
  | 'cinematic-played'
  | 'manual';

export interface Level7ObjectiveCompletionRule {
  type: Level7ObjectiveCompletionEventType;
  targetId?: string;
}

export interface Level7ObjectiveConfig {
  id: string;
  label: string;
  description?: string;
  completion: Level7ObjectiveCompletionRule;
}

export interface Level7ObjectiveChainConfig {
  levelId: string;
  registryKey?: string;
  objectives: Level7ObjectiveConfig[];
}

export interface Level7ObjectiveCompletionEvent {
  type: Level7ObjectiveCompletionEventType;
  targetId?: string;
}

export interface Level7ObjectiveSnapshot {
  levelId: string;
  activeObjectiveId?: string;
  objectives: Array<{
    id: string;
    label: string;
    state: Level7ObjectiveState;
    completedAt?: number;
  }>;
}

export interface Level7ObjectiveChainCallbacks {
  onObjectiveActivated?: (objective: Level7ObjectiveConfig, snapshot: Level7ObjectiveSnapshot) => void;
  onObjectiveCompleted?: (
    objective: Level7ObjectiveConfig,
    trigger: Level7ObjectiveCompletionEvent,
    snapshot: Level7ObjectiveSnapshot
  ) => void;
  onStateChanged?: (snapshot: Level7ObjectiveSnapshot) => void;
}

interface RuntimeObjective {
  config: Level7ObjectiveConfig;
  state: Level7ObjectiveState;
  completedAt?: number;
}

export class Level7ObjectiveChain {
  private readonly config: Level7ObjectiveChainConfig;
  private readonly callbacks: Level7ObjectiveChainCallbacks;
  private readonly runtimeObjectives: RuntimeObjective[];
  private readonly coreObjectiveSystem: ObjectiveSystem;
  private activeObjectiveIndex: number;

  static fromJson(
    config: Level7ObjectiveChainConfig,
    callbacks: Level7ObjectiveChainCallbacks = {}
  ): Level7ObjectiveChain {
    return new Level7ObjectiveChain(config, callbacks);
  }

  constructor(config: Level7ObjectiveChainConfig, callbacks: Level7ObjectiveChainCallbacks = {}) {
    this.validateConfig(config);
    this.config = config;
    this.callbacks = callbacks;

    this.runtimeObjectives = config.objectives.map((objective, index) => ({
      config: objective,
      state: index === 0 ? 'active' : 'locked'
    }));

    this.coreObjectiveSystem = new ObjectiveSystem(
      config.objectives.map((objective) => ({
        id: objective.id,
        label: objective.label,
        completion: [{ type: objective.completion.type, targetId: objective.completion.targetId }]
      }))
    );

    this.activeObjectiveIndex = this.runtimeObjectives.findIndex((objective) => objective.state === 'active');

    this.emitStateChanged();
    const activeObjective = this.getActiveObjective();
    if (activeObjective) {
      this.callbacks.onObjectiveActivated?.(activeObjective.config, this.getSnapshot());
    }
  }

  getSnapshot(): Level7ObjectiveSnapshot {
    return {
      levelId: this.config.levelId,
      activeObjectiveId: this.getActiveObjective()?.config.id,
      objectives: this.runtimeObjectives.map((runtimeObjective) => ({
        id: runtimeObjective.config.id,
        label: runtimeObjective.config.label,
        state: runtimeObjective.state,
        completedAt: runtimeObjective.completedAt
      }))
    };
  }

  getActiveObjective(): RuntimeObjective | undefined {
    return this.runtimeObjectives[this.activeObjectiveIndex];
  }

  getObjectiveState(objectiveId: string): Level7ObjectiveState | undefined {
    return this.runtimeObjectives.find((objective) => objective.config.id === objectiveId)?.state;
  }

  isCompleted(): boolean {
    return this.runtimeObjectives.every((objective) => objective.state === 'completed');
  }

  processEvent(event: Level7ObjectiveCompletionEvent): Level7ObjectiveConfig[] {
    const completedObjectives: Level7ObjectiveConfig[] = [];

    while (true) {
      const activeObjective = this.getActiveObjective();
      if (!activeObjective || activeObjective.state !== 'active') {
        break;
      }

      if (!this.matchesCompletionRule(activeObjective.config.completion, event)) {
        break;
      }

      const coreResolved = this.coreObjectiveSystem.process({
        type: event.type,
        targetId: event.targetId
      });
      if (!coreResolved) {
        break;
      }

      activeObjective.state = 'completed';
      activeObjective.completedAt = Date.now();
      completedObjectives.push(activeObjective.config);
      this.callbacks.onObjectiveCompleted?.(activeObjective.config, event, this.getSnapshot());

      this.activeObjectiveIndex += 1;
      const nextObjective = this.runtimeObjectives[this.activeObjectiveIndex];
      if (!nextObjective) {
        break;
      }

      nextObjective.state = 'active';
      this.callbacks.onObjectiveActivated?.(nextObjective.config, this.getSnapshot());

      if (event.type !== 'manual') {
        break;
      }
    }

    if (completedObjectives.length > 0) {
      this.emitStateChanged();
    }

    return completedObjectives;
  }

  completeActiveObjectiveManually(): Level7ObjectiveConfig[] {
    return this.processEvent({ type: 'manual' });
  }

  private matchesCompletionRule(rule: Level7ObjectiveCompletionRule, event: Level7ObjectiveCompletionEvent): boolean {
    if (rule.type !== event.type) {
      return false;
    }

    if (!rule.targetId) {
      return true;
    }

    return rule.targetId === event.targetId;
  }

  private validateConfig(config: Level7ObjectiveChainConfig): void {
    if (config.objectives.length === 0) {
      throw new Error('Level7ObjectiveChain: objectives debe tener al menos 1 objetivo.');
    }

    const ids = new Set<string>();

    config.objectives.forEach((objective) => {
      if (objective.id.trim().length === 0) {
        throw new Error('Level7ObjectiveChain: cada objetivo requiere un id no vacío.');
      }

      if (ids.has(objective.id)) {
        throw new Error(`Level7ObjectiveChain: id de objetivo duplicado "${objective.id}".`);
      }

      ids.add(objective.id);

      if (objective.label.trim().length === 0) {
        throw new Error(`Level7ObjectiveChain: el objetivo "${objective.id}" requiere label.`);
      }

      if (objective.completion.type !== 'manual' && !objective.completion.targetId) {
        throw new Error(
          `Level7ObjectiveChain: el objetivo "${objective.id}" requiere completion.targetId cuando type != manual.`
        );
      }
    });
  }

  private emitStateChanged(): void {
    this.callbacks.onStateChanged?.(this.getSnapshot());
  }
}
