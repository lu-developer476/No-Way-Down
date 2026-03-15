import { ObjectiveSystem } from './core/ObjectiveSystem';

export type Level10ObjectiveState = 'locked' | 'active' | 'completed' | 'failed';

export type Level10ObjectiveEventType =
  | 'zone-reached'
  | 'cinematic-played'
  | 'parking-explored'
  | 'vehicle-inspected'
  | 'resources-collected'
  | 'parking-exit-detected'
  | 'bite-event-triggered'
  | 'usable-vehicle-located'
  | 'timer-completed'
  | 'vehicle-escaped'
  | 'ambush-survived'
  | 'game-flag-updated'
  | 'manual-complete'
  | 'manual-fail';

export interface Level10ObjectiveCondition {
  type: Level10ObjectiveEventType;
  targetId?: string;
  minDurationMs?: number;
  minValue?: number;
  boolValue?: boolean;
}

export interface Level10ObjectiveRule {
  mode?: 'all' | 'any';
  conditions: Level10ObjectiveCondition[];
}

export interface Level10ObjectiveConfig {
  id: string;
  label: string;
  description?: string;
  completion: Level10ObjectiveRule;
  failure?: Level10ObjectiveRule;
}

export interface Level10ObjectiveChainConfig {
  levelId: string;
  registryKey?: string;
  failChainOnObjectiveFailure?: boolean;
  objectives: Level10ObjectiveConfig[];
}

export interface Level10ObjectiveEvent {
  type: Level10ObjectiveEventType;
  targetId?: string;
  durationMs?: number;
  value?: number;
  boolValue?: boolean;
}

export interface Level10ObjectiveSnapshot {
  levelId: string;
  activeObjectiveId?: string;
  chainState: 'running' | 'completed' | 'failed';
  objectives: Array<{
    id: string;
    label: string;
    state: Level10ObjectiveState;
    completedAt?: number;
    failedAt?: number;
  }>;
}

export interface Level10ObjectiveChainCallbacks {
  onObjectiveActivated?: (objective: Level10ObjectiveConfig, snapshot: Level10ObjectiveSnapshot) => void;
  onObjectiveCompleted?: (
    objective: Level10ObjectiveConfig,
    trigger: Level10ObjectiveEvent,
    snapshot: Level10ObjectiveSnapshot
  ) => void;
  onObjectiveFailed?: (
    objective: Level10ObjectiveConfig,
    trigger: Level10ObjectiveEvent,
    snapshot: Level10ObjectiveSnapshot
  ) => void;
  onChainCompleted?: (snapshot: Level10ObjectiveSnapshot) => void;
  onChainFailed?: (snapshot: Level10ObjectiveSnapshot) => void;
  onStateChanged?: (snapshot: Level10ObjectiveSnapshot) => void;
}

interface RuntimeObjective {
  config: Level10ObjectiveConfig;
  state: Level10ObjectiveState;
  completedAt?: number;
  failedAt?: number;
  matchedCompletionConditions: Set<number>;
}

/**
 * Cadena de objetivos configurable por JSON para Nivel 10.
 *
 * - Estados soportados: locked / active / completed / failed.
 * - Permite objetivos con múltiples condiciones (mode all/any).
 * - Diseñada para integrarse con cinemáticas, timers, vehículos y combate
 *   por medio de eventos desacoplados.
 */
export class Level10ObjectiveChain {
  private readonly config: Level10ObjectiveChainConfig;
  private readonly callbacks: Level10ObjectiveChainCallbacks;
  private readonly runtimeObjectives: RuntimeObjective[];
  private readonly coreObjectiveSystem: ObjectiveSystem;
  private readonly failChainOnObjectiveFailure: boolean;
  private activeObjectiveIndex: number;

  static fromJson(
    config: Level10ObjectiveChainConfig,
    callbacks: Level10ObjectiveChainCallbacks = {}
  ): Level10ObjectiveChain {
    return new Level10ObjectiveChain(config, callbacks);
  }

  constructor(config: Level10ObjectiveChainConfig, callbacks: Level10ObjectiveChainCallbacks = {}) {
    this.validateConfig(config);

    this.config = config;
    this.callbacks = callbacks;
    this.failChainOnObjectiveFailure = config.failChainOnObjectiveFailure ?? true;
    this.runtimeObjectives = config.objectives.map((objective, index) => ({
      config: objective,
      state: index === 0 ? 'active' : 'locked',
      matchedCompletionConditions: new Set<number>()
    }));

    this.coreObjectiveSystem = new ObjectiveSystem(
      config.objectives.map((objective) => ({
        id: objective.id,
        label: objective.label,
        completion: objective.completion.conditions.map((condition) => ({ type: condition.type, targetId: condition.targetId })),
        completionMode: objective.completion.mode ?? 'all'
      }))
    );

    this.activeObjectiveIndex = this.runtimeObjectives.findIndex((objective) => objective.state === 'active');

    this.emitStateChanged();
    const activeObjective = this.getActiveObjective();
    if (activeObjective) {
      this.callbacks.onObjectiveActivated?.(activeObjective.config, this.getSnapshot());
    }
  }

  getSnapshot(): Level10ObjectiveSnapshot {
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

  getObjectiveState(objectiveId: string): Level10ObjectiveState | undefined {
    return this.runtimeObjectives.find((objective) => objective.config.id === objectiveId)?.state;
  }

  processEvent(event: Level10ObjectiveEvent): Level10ObjectiveConfig[] {
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

    this.trackCompletionProgress(activeObjective, event);
    this.coreObjectiveSystem.process({ type: event.type, targetId: event.targetId });

    if (!this.isCompletionRuleSatisfied(activeObjective)) {
      return [];
    }

    return this.completeObjective(activeObjective, event);
  }

  completeActiveObjectiveManually(): Level10ObjectiveConfig[] {
    return this.processEvent({ type: 'manual-complete' });
  }

  failActiveObjectiveManually(): void {
    this.processEvent({ type: 'manual-fail' });
  }

  private completeObjective(activeObjective: RuntimeObjective, event: Level10ObjectiveEvent): Level10ObjectiveConfig[] {
    activeObjective.state = 'completed';
    activeObjective.completedAt = Date.now();

    this.activeObjectiveIndex += 1;
    const nextObjective = this.runtimeObjectives[this.activeObjectiveIndex];
    if (nextObjective) {
      nextObjective.state = 'active';
      nextObjective.matchedCompletionConditions.clear();
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

  private failObjective(activeObjective: RuntimeObjective, event: Level10ObjectiveEvent): void {
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
      nextObjective.matchedCompletionConditions.clear();
      this.callbacks.onObjectiveActivated?.(nextObjective.config, this.getSnapshot());
    }

    this.emitStateChanged();
  }

  private isCompletionRuleSatisfied(objective: RuntimeObjective): boolean {
    const conditions = objective.config.completion.conditions;
    const mode = objective.config.completion.mode ?? 'all';

    if (mode === 'any') {
      return objective.matchedCompletionConditions.size > 0;
    }

    return objective.matchedCompletionConditions.size === conditions.length;
  }

  private trackCompletionProgress(objective: RuntimeObjective, event: Level10ObjectiveEvent): void {
    objective.config.completion.conditions.forEach((condition, index) => {
      if (this.matchesCondition(condition, event)) {
        objective.matchedCompletionConditions.add(index);
      }
    });
  }

  private matchesRule(rule: Level10ObjectiveRule, event: Level10ObjectiveEvent): boolean {
    const mode = rule.mode ?? 'all';
    const matches = rule.conditions.map((condition) => this.matchesCondition(condition, event));

    if (mode === 'any') {
      return matches.some(Boolean);
    }

    return matches.every(Boolean);
  }

  private matchesCondition(condition: Level10ObjectiveCondition, event: Level10ObjectiveEvent): boolean {
    if (condition.type !== event.type) {
      return false;
    }

    if (condition.targetId && condition.targetId !== event.targetId) {
      return false;
    }

    if (typeof condition.minDurationMs === 'number' && (event.durationMs ?? 0) < condition.minDurationMs) {
      return false;
    }

    if (typeof condition.minValue === 'number' && (event.value ?? 0) < condition.minValue) {
      return false;
    }

    if (typeof condition.boolValue === 'boolean' && event.boolValue !== condition.boolValue) {
      return false;
    }

    return true;
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

  private validateConfig(config: Level10ObjectiveChainConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level10ObjectiveChain: levelId es obligatorio.');
    }

    if (!Array.isArray(config.objectives) || config.objectives.length === 0) {
      throw new Error('Level10ObjectiveChain: objectives debe tener al menos 1 objetivo.');
    }

    const ids = new Set<string>();

    config.objectives.forEach((objective) => {
      if (objective.id.trim().length === 0) {
        throw new Error('Level10ObjectiveChain: cada objetivo requiere id no vacío.');
      }

      if (ids.has(objective.id)) {
        throw new Error(`Level10ObjectiveChain: id de objetivo duplicado "${objective.id}".`);
      }
      ids.add(objective.id);

      if (objective.label.trim().length === 0) {
        throw new Error(`Level10ObjectiveChain: el objetivo "${objective.id}" requiere label.`);
      }

      this.validateRule(objective.completion, objective.id, 'completion');
      if (objective.failure) {
        this.validateRule(objective.failure, objective.id, 'failure');
      }
    });
  }

  private validateRule(rule: Level10ObjectiveRule, objectiveId: string, ruleName: 'completion' | 'failure'): void {
    if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
      throw new Error(`Level10ObjectiveChain: el objetivo "${objectiveId}" requiere ${ruleName}.conditions.`);
    }

    rule.conditions.forEach((condition, index) => {
      if (!condition.type) {
        throw new Error(
          `Level10ObjectiveChain: el objetivo "${objectiveId}" requiere ${ruleName}.conditions[${index}].type.`
        );
      }

      if (condition.type !== 'manual-complete' && condition.type !== 'manual-fail' && !condition.targetId) {
        throw new Error(
          `Level10ObjectiveChain: el objetivo "${objectiveId}" requiere targetId en ${ruleName}.conditions[${index}] cuando type no es manual.`
        );
      }
    });
  }

  private emitStateChanged(): void {
    this.callbacks.onStateChanged?.(this.getSnapshot());
  }
}

/**
 * Ejemplo de integración (adaptador) para no hardcodear la secuencia en GameScene.
 *
 * Cada sistema especializado emite eventos del dominio de objetivos y esta función
 * los traduce directamente a la cadena.
 */
export function integrateLevel10ObjectiveChainExample(
  chain: Level10ObjectiveChain,
  deps: {
    cinematicSystem: {
      onPlayed: (handler: (cinematicId: string) => void) => void;
    };
    timerSystem: {
      onCompleted: (handler: (timerId: string, elapsedMs: number) => void) => void;
    };
    vehicleSystem: {
      onVehicleInspected: (handler: (vehicleId: string) => void) => void;
      onUsableVehicleLocated: (handler: (vehicleId: string) => void) => void;
      onVehicleEscaped: (handler: (vehicleId: string, survivors: number) => void) => void;
      onParkingExitDetected: (handler: (exitId: string) => void) => void;
    };
    combatSystem: {
      onAmbushSurvived: (handler: (encounterId: string, elapsedMs: number) => void) => void;
    };
  }
): void {
  deps.cinematicSystem.onPlayed((cinematicId) => {
    chain.processEvent({ type: 'cinematic-played', targetId: cinematicId });
  });

  deps.timerSystem.onCompleted((timerId, elapsedMs) => {
    chain.processEvent({ type: 'timer-completed', targetId: timerId, durationMs: elapsedMs });
  });

  deps.vehicleSystem.onVehicleInspected((vehicleId) => {
    chain.processEvent({ type: 'vehicle-inspected', targetId: vehicleId });
  });

  deps.vehicleSystem.onUsableVehicleLocated((vehicleId) => {
    chain.processEvent({ type: 'usable-vehicle-located', targetId: vehicleId });
  });

  deps.vehicleSystem.onVehicleEscaped((vehicleId, survivors) => {
    chain.processEvent({ type: 'vehicle-escaped', targetId: vehicleId, value: survivors });
  });

  deps.vehicleSystem.onParkingExitDetected((exitId) => {
    chain.processEvent({ type: 'parking-exit-detected', targetId: exitId });
  });

  deps.combatSystem.onAmbushSurvived((encounterId, elapsedMs) => {
    chain.processEvent({ type: 'ambush-survived', targetId: encounterId, durationMs: elapsedMs });
  });
}
