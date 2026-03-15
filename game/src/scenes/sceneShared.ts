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
}

export const MAX_PLAYER_SEPARATION_PX = 320;
export const LOCAL_PROGRESS_STORAGE_KEY = 'nwd.progress.local-player';
export const INITIAL_SETUP_STORAGE_KEY = 'nwd.setup.initial';

export type PlayableProtagonist = 'alan-nahuel' | 'giovanna';
export type GameDifficulty = 'complejo' | 'pesadilla';

export interface InitialRunSetup {
  protagonist: PlayableProtagonist;
  difficulty: GameDifficulty;
  party: {
    required: string[];
    optional: string[];
  };
  startedAt: string;
  version: 1;
}

interface LocalProgressLike {
  current_level?: unknown;
  checkpoint?: unknown;
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

export function saveInitialRunSetup(setup: InitialRunSetup): void {
  localStorage.setItem(INITIAL_SETUP_STORAGE_KEY, JSON.stringify(setup));
}

export function loadInitialRunSetup(): InitialRunSetup | null {
  const raw = localStorage.getItem(INITIAL_SETUP_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<InitialRunSetup>;

    if ((parsed.version ?? 0) !== 1) {
      return null;
    }

    const protagonist = parsed.protagonist;
    const difficulty = parsed.difficulty;
    const required = parsed.party?.required;
    const optional = parsed.party?.optional;

    if (
      (protagonist !== 'alan-nahuel' && protagonist !== 'giovanna') ||
      (difficulty !== 'complejo' && difficulty !== 'pesadilla') ||
      !Array.isArray(required) ||
      !Array.isArray(optional)
    ) {
      return null;
    }

    return {
      protagonist,
      difficulty,
      party: {
        required: required.filter((name): name is string => typeof name === 'string'),
        optional: optional.filter((name): name is string => typeof name === 'string')
      },
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString(),
      version: 1
    };
  } catch {
    return null;
  }
}

export function hasCompatibleLocalProgress(): boolean {
  const raw = localStorage.getItem(LOCAL_PROGRESS_STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw) as LocalProgressLike;
    const hasLevel = typeof parsed.current_level === 'string' && parsed.current_level.trim().length > 0;
    const checkpoint = typeof parsed.checkpoint === 'string' ? parseCheckpoint(parsed.checkpoint) : undefined;
    return hasLevel && Boolean(checkpoint);
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
