export interface MissionContext {
  zombiesRemaining: number;
}

export interface MissionObjective {
  id: string;
  description: string;
  completedDescription: string;
  isCompleted: (context: MissionContext) => boolean;
}

export type ObjectiveState = 'pending' | 'active' | 'completed';

interface ObjectiveProgress {
  objective: MissionObjective;
  state: ObjectiveState;
}

export class MissionSystem {
  private readonly objectives: ObjectiveProgress[];
  private activeObjectiveIndex = 0;

  constructor(objectives: MissionObjective[]) {
    if (objectives.length === 0) {
      throw new Error('MissionSystem requires at least one objective.');
    }

    this.objectives = objectives.map((objective, index) => ({
      objective,
      state: index === 0 ? 'active' : 'pending'
    }));
  }

  update(context: MissionContext): MissionObjective | null {
    if (this.isMissionComplete()) {
      return null;
    }

    const activeProgress = this.objectives[this.activeObjectiveIndex];
    if (!activeProgress || activeProgress.state !== 'active') {
      return null;
    }

    if (!activeProgress.objective.isCompleted(context)) {
      return null;
    }

    activeProgress.state = 'completed';
    const completedObjective = activeProgress.objective;
    this.activeObjectiveIndex += 1;

    const nextObjective = this.objectives[this.activeObjectiveIndex];
    if (nextObjective) {
      nextObjective.state = 'active';
    }

    return completedObjective;
  }

  getActiveObjectiveText(): string {
    if (this.isMissionComplete()) {
      return 'Misión completada: encuentra la salida.';
    }

    return this.objectives[this.activeObjectiveIndex].objective.description;
  }

  isMissionComplete(): boolean {
    return this.objectives.every((objective) => objective.state === 'completed');
  }
}
