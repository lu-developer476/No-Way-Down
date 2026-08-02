import type { GameDifficulty, PlayableProtagonist } from './InitialRunSetup';

export const ACTIVE_RUN_SCHEMA_VERSION = 2 as const;
export interface ActiveRunSnapshot {
  schemaVersion: typeof ACTIVE_RUN_SCHEMA_VERSION; campaignFlowId: 'main_campaign'; campaignCursor: number;
  nodeId: string; checkpointId: string | null;
  setup: { protagonist: PlayableProtagonist; difficulty: GameDifficulty; selectedParty: string[] };
  protagonist: PlayableProtagonist; difficulty: GameDifficulty; selectedParty: string[]; activeParty: string[];
  health?: Record<string, number>; inventory?: Record<string, number>; objectiveState?: Record<string, string | number | boolean>;
  searchState?: string[]; completionMetadata?: null; updatedAt: string;
}

export function isActiveRunSnapshot(value: unknown, canonicalNodeIds: ReadonlySet<string>): value is ActiveRunSnapshot {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<ActiveRunSnapshot>;
  return run.schemaVersion === ACTIVE_RUN_SCHEMA_VERSION && run.campaignFlowId === 'main_campaign'
    && Number.isInteger(run.campaignCursor) && (run.campaignCursor ?? -1) >= 0
    && typeof run.nodeId === 'string' && canonicalNodeIds.has(run.nodeId)
    && (run.protagonist === 'alan' || run.protagonist === 'giovanna')
    && (run.difficulty === 'complejo' || run.difficulty === 'pesadilla')
    && Array.isArray(run.selectedParty) && Array.isArray(run.activeParty) && typeof run.updatedAt === 'string';
}
