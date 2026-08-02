import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { loadInitialRunSetup } from '../run/InitialRunSetup';

export interface Checkpoint {
  x: number;
  y: number;
}

export const DEFAULT_PLAYER_ID = 'local-player';


export interface PartyHudMember {
  id: string;
  name: string;
  role: 'protagonist' | 'ally';
  health: number;
  maxHealth: number;
  activeSlot?: 'primary' | 'secondary';
  activeWeapon?: string;
  primaryWeapon?: string;
  secondaryWeapon?: string;
  usesAmmo?: boolean;
  ammoType?: string;
  ammoCurrent?: number;
  ammoMax?: number;
  ammoReserve?: number;
  isReloading?: boolean;
}

export interface PauseMenuView {
  visible: boolean;
  state: 'root' | 'options';
  title: string;
  options: string[];
  selectedIndex: number;
  details: string;
  hint: string;
}

export interface TransitionView {
  visible: boolean;
  message: string;
  tone: 'normal' | 'danger';
}

export const MAX_PLAYER_SEPARATION_PX = 320;
export const LOCAL_PROGRESS_STORAGE_KEY = 'nwd.progress.local-player';
export const CAMPAIGN_COMPLETION_STORAGE_KEY = 'nwd.campaign.completion';

export type ProgressSceneKey = 'LevelScene' | 'UpperFloorScene';
export function normalizeProgressSceneKey(value: unknown): ProgressSceneKey | null {
  if (value === 'GameScene' || value === 'LevelScene') return 'LevelScene';
  return value === 'UpperFloorScene' ? 'UpperFloorScene' : null;
}

export type { GameDifficulty, InitialRunSetup, PlayableProtagonist } from '../run/InitialRunSetup';
export { loadInitialRunSetup, saveInitialRunSetup } from '../run/InitialRunSetup';

interface LocalProgressLike {
  current_level?: unknown;
  checkpoint?: unknown;
  campaign_completed?: unknown;
  save_version?: unknown;
  campaign_snapshot?: { progress?: { flow_node_id?: unknown } };
}

export interface CampaignCompletion {
  schemaVersion: 1; campaignId: 'no_way_down'; completed: true; completedAt: string;
  protagonistId: 'alan' | 'giovanna'; difficultyId: 'complejo' | 'pesadilla';
  finalNodeId: 'campaign-end'; canonicalNodeCount: 35; buildSha: string;
}

export function persistCampaignCompleted(now = new Date()): CampaignCompletion {
  const existing = loadCampaignCompletion();
  if (existing) return existing;
  const setup = loadInitialRunSetup();
  const completion: CampaignCompletion = {
    schemaVersion: 1, campaignId: 'no_way_down', completed: true,
    completedAt: now.toISOString(), protagonistId: setup?.protagonist ?? 'alan',
    difficultyId: setup?.difficulty ?? 'complejo', finalNodeId: 'campaign-end',
    canonicalNodeCount: 35, buildSha: window.__NWD_BUILD__?.sha ?? 'development'
  };
  localStorage.setItem(CAMPAIGN_COMPLETION_STORAGE_KEY, JSON.stringify(completion));
  localStorage.removeItem(LOCAL_PROGRESS_STORAGE_KEY);
  return completion;
}

export function loadCampaignCompletion(): CampaignCompletion | null {
  const raw = localStorage.getItem(CAMPAIGN_COMPLETION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CampaignCompletion;
    return parsed.schemaVersion === 1 && parsed.completed === true && parsed.finalNodeId === 'campaign-end' ? parsed : null;
  } catch { return null; }
}

/** Clears only campaign/run data; audio, controls and other general settings remain untouched. */
export function clearRunForNewGame(): void {
  localStorage.removeItem(LOCAL_PROGRESS_STORAGE_KEY);
  // Completion is historical. A new game clears only the active run.
}

export function getScenePlayerId(): string {
  return import.meta.env.VITE_PLAYER_ID ?? DEFAULT_PLAYER_ID;
}

export function parseCheckpoint(value: string): Checkpoint | undefined {
  const [xPart, yPart] = value.split(',');
  const x = Number(xPart);
  const y = Number(yPart);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }

  return { x, y };
}

export function getAveragePlayerPosition(players: Player[]): Phaser.Math.Vector2 {
  if (players.length === 0) {
    return new Phaser.Math.Vector2(0, 0);
  }

  const totals = players.reduce(
    (acc, player) => ({ x: acc.x + player.x, y: acc.y + player.y }),
    { x: 0, y: 0 }
  );

  return new Phaser.Math.Vector2(totals.x / players.length, totals.y / players.length);
}

export function hasCompatibleLocalProgress(): boolean {
  const raw = localStorage.getItem(LOCAL_PROGRESS_STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw) as LocalProgressLike;
    if (parsed.campaign_completed === true) return false;
    if (parsed.save_version !== 2) return false;
    const sceneKey = normalizeProgressSceneKey(parsed.current_level);
    const checkpoint = typeof parsed.checkpoint === 'string' ? parseCheckpoint(parsed.checkpoint) : undefined;
    const nodeId = parsed.campaign_snapshot?.progress?.flow_node_id;
    return Boolean(sceneKey && checkpoint && typeof nodeId === 'string' && nodeId.length > 0);
  } catch {
    return false;
  }
}

export function enforceMaxPlayerSeparation(players: Player[], maxDistance = MAX_PLAYER_SEPARATION_PX): void {
  if (players.length <= 1) {
    return;
  }

  const p1 = players[0];
  const p2 = players[1];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= maxDistance || distance === 0) {
    return;
  }

  const midpointX = (p1.x + p2.x) / 2;
  const midpointY = (p1.y + p2.y) / 2;
  const normalizedX = dx / distance;
  const normalizedY = dy / distance;
  const allowedHalfDistance = maxDistance / 2;

  p1.setPosition(midpointX - normalizedX * allowedHalfDistance, midpointY - normalizedY * allowedHalfDistance);
  p2.setPosition(midpointX + normalizedX * allowedHalfDistance, midpointY + normalizedY * allowedHalfDistance);
}
