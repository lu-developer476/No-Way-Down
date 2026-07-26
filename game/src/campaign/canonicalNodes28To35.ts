export const FINAL_COMBAT_NODE_ID = 'lvl10-esc01-combate-50-bajas-en-via-publica';
export const FINAL_KILL_TARGET = 50;

export interface FinalCombatSnapshot {
  version: 1;
  nodeId: typeof FINAL_COMBAT_NODE_ID;
  objectiveInstanceId: string;
  countedEnemyIds: string[];
  kills: number;
  completed: boolean;
}

/** Serializable counter scoped to one objective instance. It never accepts ambient or stale kills. */
export class CanonicalFinalCombatRuntime {
  private readonly counted = new Set<string>();
  private completed = false;
  readonly objectiveInstanceId: string;

  constructor(objectiveInstanceId: string, snapshot?: FinalCombatSnapshot) {
    if (!objectiveInstanceId.trim()) throw new Error('objectiveInstanceId es obligatorio.');
    this.objectiveInstanceId = objectiveInstanceId;
    if (snapshot) {
      if (snapshot.version !== 1 || snapshot.nodeId !== FINAL_COMBAT_NODE_ID || snapshot.objectiveInstanceId !== objectiveInstanceId) {
        throw new Error('Snapshot del combate final incompatible.');
      }
      snapshot.countedEnemyIds.forEach((id) => this.counted.add(id));
      this.completed = snapshot.completed;
    }
  }

  registerKill(event: { enemyId: string; nodeId: string; objectiveInstanceId: string; spawnedForObjective: boolean }): boolean {
    if (this.completed || event.nodeId !== FINAL_COMBAT_NODE_ID || event.objectiveInstanceId !== this.objectiveInstanceId
      || !event.spawnedForObjective || !event.enemyId.trim() || this.counted.has(event.enemyId)) return false;
    this.counted.add(event.enemyId);
    this.completed = this.counted.size === FINAL_KILL_TARGET;
    return true;
  }

  getSnapshot(): FinalCombatSnapshot {
    return { version: 1, nodeId: FINAL_COMBAT_NODE_ID, objectiveInstanceId: this.objectiveInstanceId,
      countedEnemyIds: [...this.counted], kills: this.counted.size, completed: this.completed };
  }
}
