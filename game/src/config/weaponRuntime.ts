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
  meleeHitboxDurationMs: number;
  meleeHitboxHeight: number;
  meleeContactDamage: number;
  defenseMitigationRatio: number;
  defenseFrontalOnly: boolean;
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
    maxRange: weapon.maxRange,
    meleeHitboxDurationMs: weapon.isMelee ? Math.max(90, Math.round(weapon.fireRateMs * 0.42)) : 0,
    meleeHitboxHeight: weapon.isMelee ? (weapon.key === 'knife' ? 44 : weapon.key === 'tray_shield' ? 52 : 58) : 0,
    meleeContactDamage: weapon.isMelee ? weapon.damage : 0,
    defenseMitigationRatio: weapon.isDefensive ? 0.45 : 0,
    defenseFrontalOnly: weapon.isDefensive
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
