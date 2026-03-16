import { getWeaponCatalogEntry } from './weaponCatalog';

export interface WeaponRuntimeConfig {
  key: string;
  damage: number;
  projectileSpeed: number;
  fireCooldownMs: number;
  maxRange: number;
}

let legacyPistolOverrides: {
  fireCooldownMs?: number;
  projectileSpeed?: number;
} = {};

export function getWeaponRuntimeConfig(weaponKey?: string): WeaponRuntimeConfig {
  const weapon = getWeaponCatalogEntry(weaponKey);
  const isPistol = weapon.key === 'pistol';

  return {
    key: weapon.key,
    damage: weapon.damage,
    projectileSpeed: isPistol ? legacyPistolOverrides.projectileSpeed ?? weapon.bulletSpeed : weapon.bulletSpeed,
    fireCooldownMs: isPistol ? legacyPistolOverrides.fireCooldownMs ?? weapon.fireRateMs : weapon.fireRateMs,
    maxRange: weapon.maxRange
  };
}

export function applyLegacyWeaponOverrides(overrides: {
  fireCooldownMs?: number;
  projectileSpeed?: number;
}): void {
  if (!overrides.fireCooldownMs && !overrides.projectileSpeed) {
    return;
  }

  legacyPistolOverrides = {
    fireCooldownMs: overrides.fireCooldownMs ?? legacyPistolOverrides.fireCooldownMs,
    projectileSpeed: overrides.projectileSpeed ?? legacyPistolOverrides.projectileSpeed
  };
}
