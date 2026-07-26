export type VisualGeneration = 'legacy' | 'v2';

export const VISUAL_V2_LEVEL_ID = 'level_1_pasillos_escaleras_pb';

export const visualV2Style = Object.freeze({
  logicalSize: { width: 960, height: 540 },
  characterHeight: 96,
  palette: { ambient: 0x17232b, cold: 0x263943, warm: 0xf2a63b, emergency: 0xc83d45 },
  budgets: { shells: 18, impacts: 24, stains: 18, particles: 48, temporaryLights: 8, bodies: 8, decals: 24 },
  accessibility: { reduceShake: false, reduceFlashes: false, reduceParticles: false }
});

export function resolveVisualGeneration(levelId: string, configured?: unknown): VisualGeneration {
  if (configured === 'v2' && levelId === VISUAL_V2_LEVEL_ID) return 'v2';
  return 'legacy';
}
