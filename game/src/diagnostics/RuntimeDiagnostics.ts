export interface RuntimeDiagnostics {
  nodeId: string | null; nodeType: string | null; canonicalIndex: number;
  runtimeLevelId: string | null; sceneKey: string | null; gameplayReady: boolean;
  physicsEngine: 'arcade'; tiledMapPath: string | null; runtimeConfigPath: string | null;
  playerCount: number; allyCount: number; activeEnemyCount: number;
  dynamicBodyCount: number; staticBodyCount: number; colliderCount: number; overlapCount: number;
  currentObjective: string | null; objectiveProgress: string | number | null;
  objectiveCompleted: boolean; exitReady: boolean; activeExitId: string | null;
  transitionInProgress: boolean; checkpointId: string | null; fatalError: string | null;
}

declare global { interface Window { __NWD_RUNTIME_DIAGNOSTICS__?: Readonly<RuntimeDiagnostics> } }

export function publishDiagnostics(value: RuntimeDiagnostics): void {
  window.__NWD_RUNTIME_DIAGNOSTICS__ = Object.freeze({ ...value, physicsEngine: 'arcade' });
}
export function clearDiagnostics(): void { delete window.__NWD_RUNTIME_DIAGNOSTICS__; }
