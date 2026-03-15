import { GameDifficulty } from '../scenes/sceneShared';

export interface DifficultyRuntimeConfig {
  key: GameDifficulty;
  label: string;
  zombieHealthMultiplier: number;
  zombieContactDamage: number;
  spawnPressureMultiplier: number;
  playerFireCooldownMultiplier: number;
}

const DIFFICULTY_RUNTIME_CONFIG_BY_KEY: Record<GameDifficulty, DifficultyRuntimeConfig> = {
  complejo: {
    key: 'complejo',
    label: 'Complejo',
    zombieHealthMultiplier: 1,
    zombieContactDamage: 10,
    spawnPressureMultiplier: 1,
    playerFireCooldownMultiplier: 1
  },
  pesadilla: {
    key: 'pesadilla',
    label: 'Pesadilla',
    zombieHealthMultiplier: 1.7,
    zombieContactDamage: 16,
    spawnPressureMultiplier: 1.45,
    playerFireCooldownMultiplier: 1.2
  }
};

export function getDifficultyRuntimeConfig(difficulty?: GameDifficulty): DifficultyRuntimeConfig {
  if (!difficulty) {
    return DIFFICULTY_RUNTIME_CONFIG_BY_KEY.complejo;
  }

  return DIFFICULTY_RUNTIME_CONFIG_BY_KEY[difficulty] ?? DIFFICULTY_RUNTIME_CONFIG_BY_KEY.complejo;
}

export function scaleSpawnCount(baseCount: number, multiplier: number): number {
  return Math.max(1, Math.ceil(baseCount * multiplier));
}

export function scaleSpawnCooldownMs(baseCooldownMs: number, multiplier: number): number {
  return Math.max(120, Math.round(baseCooldownMs / multiplier));
}
