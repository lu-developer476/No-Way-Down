import { ObjectiveSystem } from './core/ObjectiveSystem';

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

export class MissionSystem {
  private readonly missionObjectives: MissionObjective[];
  private readonly objectiveSystem: ObjectiveSystem;

  constructor(objectives: MissionObjective[]) {
    if (objectives.length === 0) {
      throw new Error('MissionSystem requires at least one objective.');
    }

    this.missionObjectives = objectives;
    this.objectiveSystem = new ObjectiveSystem(
      objectives.map((objective) => ({
        id: objective.id,
        label: objective.description,
        completion: [{ type: 'mission-condition-met', targetId: objective.id }]
      }))
    );
  }

  update(context: MissionContext): MissionObjective | null {
    const active = this.objectiveSystem.getActiveObjective();
    if (!active) {
      return null;
    }

    const activeMissionObjective = this.missionObjectives.find((objective) => objective.id === active.id);
    if (!activeMissionObjective || !activeMissionObjective.isCompleted(context)) {
      return null;
    }

    const completed = this.objectiveSystem.process({ type: 'mission-condition-met', targetId: active.id });
    if (!completed || completed.status !== 'completed') {
      return null;
    }

    return activeMissionObjective;
  }

  getActiveObjectiveText(): string {
    if (this.isMissionComplete()) {
      return 'Misión completada: encuentra la salida.';
    }

    const active = this.objectiveSystem.getActiveObjective();
    const activeMissionObjective = this.missionObjectives.find((objective) => objective.id === active?.id);
    return activeMissionObjective?.description ?? this.missionObjectives[0].description;
  }

  isMissionComplete(): boolean {
    return this.objectiveSystem.isCompleted();
  }
}
