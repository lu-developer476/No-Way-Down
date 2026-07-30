export interface FinaleDiagnostics {
  nodeId: string; runtimeLevelId: string; sectorId: string; mapPath: string; objectiveId: string;
  objectiveInstanceId: string; killTarget: number; killCount: number; spawnedCount: number; aliveCount: number;
  remainingSpawnBudget: number; activePhaseId: string; timerRemainingMs: number; spawnPointIds: string[];
  playerIds: string[]; vehicleId: string; radioObserved: boolean; cluesObserved: string[]; requiredClues: number;
  finalExitUnlocked: boolean; campaignCompleted: boolean; nextNodeId: string; visualObjectCount: number;
  activeAtlasIds: string[]; activeAudioLoops: string[]; activeTimers: number; activeListeners: number;
  missingAssets: string[]; fatalError: string | null;
}
declare global { interface Window { __NWD_FINALE_DIAGNOSTICS__?: FinaleDiagnostics } }
export function publishFinaleDiagnostics(value: FinaleDiagnostics, search = window.location.search): void {
  if (import.meta.env.DEV || new URLSearchParams(search).get('qaCampaign') === '1') {
    window.__NWD_FINALE_DIAGNOSTICS__ = JSON.parse(JSON.stringify(value)) as FinaleDiagnostics;
  }
}
export function clearFinaleDiagnostics(): void { delete window.__NWD_FINALE_DIAGNOSTICS__; }
