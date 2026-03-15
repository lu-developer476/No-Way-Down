import Phaser from 'phaser';
import { Player } from '../entities/Player';

export interface Checkpoint {
  x: number;
  y: number;
}

export const DEFAULT_PLAYER_ID = 'local-player';
export const MAX_PLAYER_SEPARATION_PX = 320;
export const LOCAL_PROGRESS_STORAGE_KEY = 'nwd.progress.local-player';

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
