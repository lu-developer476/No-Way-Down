import Phaser from 'phaser';
import { CharacterWeaponKey } from './characterRuntime';
import { getWeaponCatalogEntry } from './weaponCatalog';
import { getWeaponAlignment } from './visualAlignment';

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
  const alignment = getWeaponAlignment(weapon.key);

  return {
    key: weapon.key,
    projectileTexture,
    projectileTint: weapon.projectileTint,
    projectileScale: weapon.projectileScale,
    muzzleOffsetX: alignment.muzzleOffset.x,
    muzzleOffsetY: alignment.muzzleOffset.y,
    heldTexture,
    hudTexture,
    heldScale: alignment.heldScale,
    hudScale: alignment.hudScale,
    carryOffsetX: alignment.carryOffset.x,
    carryOffsetY: alignment.carryOffset.y
  };
}
