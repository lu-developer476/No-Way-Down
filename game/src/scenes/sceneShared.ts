import Phaser from 'phaser';
import { Player } from '../entities/Player';

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
export const CAMPAIGN_COMPLETION_STORAGE_KEY = 'nwd.campaign.completed';

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
}

export interface CampaignCompletion {
  version: 1; completed: true; finalNodeId: 'campaign-end'; completedAt: string;
}

export function persistCampaignCompleted(now = new Date()): CampaignCompletion {
  const completion: CampaignCompletion = { version: 1, completed: true, finalNodeId: 'campaign-end', completedAt: now.toISOString() };
  localStorage.setItem(CAMPAIGN_COMPLETION_STORAGE_KEY, JSON.stringify(completion));
  localStorage.removeItem(LOCAL_PROGRESS_STORAGE_KEY);
  return completion;
}

/** Clears only campaign/run data; audio, controls and other general settings remain untouched. */
export function clearRunForNewGame(): void {
  localStorage.removeItem(LOCAL_PROGRESS_STORAGE_KEY);
  localStorage.removeItem(CAMPAIGN_COMPLETION_STORAGE_KEY);
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
    const sceneKey = normalizeProgressSceneKey(parsed.current_level);
    const checkpoint = typeof parsed.checkpoint === 'string' ? parseCheckpoint(parsed.checkpoint) : undefined;
    return Boolean(sceneKey && checkpoint);
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
