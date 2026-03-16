import { getWeaponCatalogEntry } from './weaponCatalog';

export interface WeaponRuntimeConfig {
  key: string;
  damage: number;
  projectileSpeed: number;
  spread: number;
  cadenceMs: number;
  penetration: number;
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
  const cadenceMs = isPistol ? legacyPistolOverrides.fireCooldownMs ?? weapon.fireRateMs : weapon.fireRateMs;

  return {
    key: weapon.key,
    damage: weapon.damage,
    projectileSpeed: isPistol ? legacyPistolOverrides.projectileSpeed ?? weapon.bulletSpeed : weapon.bulletSpeed,
    spread: weapon.spread,
    cadenceMs,
    penetration: weapon.key === 'sniper_rifle' || weapon.key === 'carbine' ? 1 : 0,
    fireCooldownMs: cadenceMs,
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
