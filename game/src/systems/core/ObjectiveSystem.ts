export type ObjectiveStatus = 'locked' | 'active' | 'completed' | 'failed';

export interface ObjectiveEvent {
  type: string;
  targetId?: string;
}

export interface ObjectiveCondition {
  type: string;
  targetId?: string;
}

export interface ObjectiveDefinition {
  id: string;
  label: string;
  completion: ObjectiveCondition[];
  completionMode?: 'all' | 'any';
  failure?: ObjectiveCondition;
}

export interface ObjectiveRuntime {
  id: string;
  label: string;
  status: ObjectiveStatus;
  completedAt?: number;
  failedAt?: number;
}

export class ObjectiveSystem {
  private readonly objectives: ObjectiveDefinition[];
  private readonly runtime: ObjectiveRuntime[];
  private readonly matched = new Map<string, Set<number>>();
  private activeIndex = 0;

  constructor(objectives: ObjectiveDefinition[]) {
    if (objectives.length === 0) {
      throw new Error('ObjectiveSystem requires at least one objective.');
    }

    this.objectives = objectives;
    this.runtime = objectives.map((objective, index) => ({
      id: objective.id,
      label: objective.label,
      status: index === 0 ? 'active' : 'locked'
    }));
  }

  process(event: ObjectiveEvent): ObjectiveRuntime | undefined {
    const definition = this.objectives[this.activeIndex];
    const runtime = this.runtime[this.activeIndex];
    if (!definition || !runtime || runtime.status !== 'active') {
      return undefined;
    }

    if (definition.failure && this.matches(definition.failure, event)) {
      runtime.status = 'failed';
      runtime.failedAt = Date.now();
      return runtime;
    }

    definition.completion.forEach((condition, index) => {
      if (this.matches(condition, event)) {
        const matchedConditions = this.matched.get(definition.id) ?? new Set<number>();
        matchedConditions.add(index);
        this.matched.set(definition.id, matchedConditions);
      }
    });

    const matchedConditions = this.matched.get(definition.id) ?? new Set<number>();
    const completionMode = definition.completionMode ?? 'all';
    const isCompleted = completionMode === 'any'
      ? matchedConditions.size > 0
      : matchedConditions.size === definition.completion.length;

    if (!isCompleted) {
      return undefined;
    }

    runtime.status = 'completed';
    runtime.completedAt = Date.now();
    this.activeIndex += 1;

    const nextObjective = this.runtime[this.activeIndex];
    if (nextObjective) {
      nextObjective.status = 'active';
    }

    return runtime;
  }

  failActiveObjective(): ObjectiveRuntime | undefined {
    const runtime = this.runtime[this.activeIndex];
    if (!runtime || runtime.status !== 'active') {
      return undefined;
    }

    runtime.status = 'failed';
    runtime.failedAt = Date.now();
    return runtime;
  }

  getActiveObjective(): ObjectiveRuntime | undefined {
    return this.runtime[this.activeIndex];
  }

  getSnapshot(): ObjectiveRuntime[] {
    return this.runtime.map((entry) => ({ ...entry }));
  }

  isCompleted(): boolean {
    return this.runtime.every((entry) => entry.status === 'completed');
  }

  reset(): void {
    this.matched.clear();
    this.activeIndex = 0;

    this.runtime.forEach((runtime, index) => {
      runtime.status = index === 0 ? 'active' : 'locked';
      runtime.completedAt = undefined;
      runtime.failedAt = undefined;
    });
  }

  private matches(condition: ObjectiveCondition, event: ObjectiveEvent): boolean {
    if (condition.type !== event.type) {
      return false;
    }

    if (condition.targetId && condition.targetId !== event.targetId) {
      return false;
    }

    return true;
  }
}
