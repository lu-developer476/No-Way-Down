import Phaser from 'phaser';
import { CharacterWeaponKey } from './characterRuntime';
import { getWeaponCatalogEntry } from './weaponCatalog';

export interface WeaponVisualRuntimeConfig {
  key: string;
  projectileTexture: string;
  projectileTint?: number;
  projectileScale: number;
  muzzleOffsetX: number;
  muzzleOffsetY: number;
  heldTexture: string;
  hudTexture: string;
  heldScale: number;
  hudScale: number;
  carryOffsetX: number;
  carryOffsetY: number;
}

const warnedMissingTextures = new Set<string>();

const HELD_SCALE_MULTIPLIER_BY_KEY: Record<string, number> = {
  pistol: 1.48, revolver: 1.42, smg: 1.28, shotgun: 0.82, carbine: 0.98,
  sniper_rifle: 0.76, light_machine_gun: 0.8, knife: 1.55, machete: 1.42,
  sword: 1, tray_shield: 1.35
};

const HUD_SCALE_MULTIPLIER_BY_KEY: Record<string, number> = {
  pistol: 1.45, revolver: 1.4, smg: 1.2, shotgun: 0.85, carbine: 1,
  sniper_rifle: 0.82, light_machine_gun: 0.85, knife: 1.4, machete: 1.35,
  sword: 1, tray_shield: 1.25
};

const CARRY_OFFSET_ADJUSTMENT_BY_KEY: Record<string, { x: number; y: number }> = {
  pistol: { x: -2, y: 0 }, revolver: { x: -1, y: 0 }, smg: { x: 0, y: 0 },
  shotgun: { x: 2, y: -1 }, carbine: { x: 1, y: -1 }, sniper_rifle: { x: 3, y: -2 },
  light_machine_gun: { x: 2, y: -1 }, knife: { x: -4, y: 2 }, machete: { x: -1, y: 1 },
  sword: { x: 0, y: 0 }, tray_shield: { x: -7, y: 5 }
};

function resolveTextureKey(scene: Phaser.Scene | undefined, requestedKey: string, fallbackKey: string, context: string): string {
  if (!scene || scene.textures.exists(requestedKey)) {
    return requestedKey;
  }

  const warningKey = `${context}:${requestedKey}`;
  if (!warnedMissingTextures.has(warningKey)) {
    warnedMissingTextures.add(warningKey);
    console.error(`[weaponVisualRuntime] Missing texture "${requestedKey}" for ${context}. Using explicit fallback "${fallbackKey}".`);
  }

  return fallbackKey;
}

export function getWeaponVisualRuntimeConfig(weaponKey?: CharacterWeaponKey, scene?: Phaser.Scene): WeaponVisualRuntimeConfig {
  const weapon = getWeaponCatalogEntry(weaponKey);
  const heldTexture = resolveTextureKey(scene, `weapon-${weapon.key}`, 'weapon-missing', `weapon ${weapon.key}`);
  const hudTexture = resolveTextureKey(scene, `weapon-hud-${weapon.key}`, 'weapon-hud-missing', `HUD weapon ${weapon.key}`);
  const projectileTexture = resolveTextureKey(scene, weapon.visualKey, 'projectile-missing', `projectile ${weapon.key}`);
  const heldScaleMultiplier = HELD_SCALE_MULTIPLIER_BY_KEY[weapon.key] ?? 1;
  const hudScaleMultiplier = HUD_SCALE_MULTIPLIER_BY_KEY[weapon.key] ?? 1;
  const carryAdjustment = CARRY_OFFSET_ADJUSTMENT_BY_KEY[weapon.key] ?? { x: 0, y: 0 };

  return {
    key: weapon.key,
    projectileTexture,
    projectileTint: weapon.projectileTint,
    projectileScale: weapon.projectileScale,
    muzzleOffsetX: weapon.muzzleOffsetX,
    muzzleOffsetY: weapon.muzzleOffsetY,
    heldTexture,
    hudTexture,
    heldScale: Phaser.Math.Clamp(weapon.realLengthCm / 84, 0.55, 1.38) * heldScaleMultiplier,
    hudScale: Phaser.Math.Clamp(weapon.realLengthCm / 84, 0.7, 1.28) * hudScaleMultiplier,
    carryOffsetX: Math.max(10, Math.round(weapon.muzzleOffsetX - 10 + Math.max(0, weapon.realLengthCm - 60) / 10)) + carryAdjustment.x,
    carryOffsetY: Math.min(-2, Math.round(weapon.muzzleOffsetY + 4)) + carryAdjustment.y
  };
}
