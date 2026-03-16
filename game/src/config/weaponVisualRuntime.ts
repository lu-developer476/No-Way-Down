import { CharacterWeaponKey } from './characterRuntime';
import { getWeaponCatalogEntry } from './weaponCatalog';

export interface WeaponVisualRuntimeConfig {
  key: string;
  projectileTexture: string;
  projectileTint?: number;
  projectileScale: number;
  muzzleOffsetX: number;
  muzzleOffsetY: number;
}

export function getWeaponVisualRuntimeConfig(weaponKey?: CharacterWeaponKey): WeaponVisualRuntimeConfig {
  const weapon = getWeaponCatalogEntry(weaponKey);

  return {
    key: weapon.key,
    projectileTexture: weapon.visualKey,
    projectileTint: weapon.projectileTint,
    projectileScale: weapon.projectileScale,
    muzzleOffsetX: weapon.muzzleOffsetX,
    muzzleOffsetY: weapon.muzzleOffsetY
  };
}
