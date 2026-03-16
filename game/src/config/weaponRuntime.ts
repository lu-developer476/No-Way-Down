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
  zombieHeadshotChance: number;
  zombieHeadshotInstantKill: boolean;
  zombieHeadshotDamageMultiplier: number;
  zombieHeadshotSpeedBonusReference: number;
  zombieHeadshotSpeedBonusScale: number;
  zombieHeadshotSpeedBonusMin: number;
  zombieHeadshotSpeedBonusMax: number;
  zombieHeadshotChanceMin: number;
  zombieHeadshotChanceMax: number;
}

export interface WeaponRuntimeModifiers {
  spreadMultiplier?: number;
  meleeDamageMultiplier?: number;
}

let legacyPistolOverrides: {
  fireCooldownMs?: number;
  projectileSpeed?: number;
} = {};

export function getWeaponRuntimeConfig(weaponKey?: string, modifiers: WeaponRuntimeModifiers = {}): WeaponRuntimeConfig {
  const weapon = getWeaponCatalogEntry(weaponKey);
  const isPistol = weapon.key === 'pistol';
  const cadenceMs = isPistol ? legacyPistolOverrides.fireCooldownMs ?? weapon.fireRateMs : weapon.fireRateMs;
  const spreadMultiplier = Math.max(0.05, modifiers.spreadMultiplier ?? 1);
  const meleeDamageMultiplier = Math.max(0.2, modifiers.meleeDamageMultiplier ?? 1);

  return {
    key: weapon.key,
    damage: weapon.damage,
    projectileSpeed: isPistol ? legacyPistolOverrides.projectileSpeed ?? weapon.bulletSpeed : weapon.bulletSpeed,
    spread: weapon.spread * spreadMultiplier,
    cadenceMs,
    penetration: weapon.key === 'sniper_rifle' || weapon.key === 'carbine' ? 1 : 0,
    fireCooldownMs: cadenceMs,
    maxRange: weapon.maxRange,
    meleeHitboxDurationMs: weapon.isMelee ? Math.max(90, Math.round(weapon.fireRateMs * 0.42)) : 0,
    meleeHitboxHeight: weapon.isMelee ? (weapon.key === 'knife' ? 44 : weapon.key === 'tray_shield' ? 52 : 58) : 0,
    meleeContactDamage: weapon.isMelee ? Math.max(1, Math.round(weapon.damage * meleeDamageMultiplier)) : 0,
    defenseMitigationRatio: weapon.isDefensive ? 0.45 : 0,
    defenseFrontalOnly: weapon.isDefensive,
    zombieHeadshotChance: weapon.headshotChance,
    zombieHeadshotInstantKill: !weapon.isMelee,
    zombieHeadshotDamageMultiplier: weapon.isMelee ? 1 : 0,
    zombieHeadshotSpeedBonusReference: 520,
    zombieHeadshotSpeedBonusScale: 2000,
    zombieHeadshotSpeedBonusMin: -0.03,
    zombieHeadshotSpeedBonusMax: 0.07,
    zombieHeadshotChanceMin: 0.03,
    zombieHeadshotChanceMax: 0.65
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
