export interface WeaponRuntimeConfig {
  key: string;
  damage: number;
  projectileSpeed: number;
  fireCooldownMs: number;
  maxRange: number;
}

const DEFAULT_WEAPON_RUNTIME_CONFIG: WeaponRuntimeConfig = {
  key: 'pistol',
  damage: 1,
  projectileSpeed: 520,
  fireCooldownMs: 220,
  maxRange: 560
};

const WEAPON_RUNTIME_CONFIG_BY_KEY: Record<string, WeaponRuntimeConfig> = {
  pistol: {
    key: 'pistol',
    damage: 1,
    projectileSpeed: 520,
    fireCooldownMs: 220,
    maxRange: 560
  },
  revolver: {
    key: 'revolver',
    damage: 2,
    projectileSpeed: 560,
    fireCooldownMs: 340,
    maxRange: 600
  },
  smg: {
    key: 'smg',
    damage: 1,
    projectileSpeed: 500,
    fireCooldownMs: 140,
    maxRange: 500
  },
  shotgun: {
    key: 'shotgun',
    damage: 3,
    projectileSpeed: 460,
    fireCooldownMs: 560,
    maxRange: 360
  },
  carbine: {
    key: 'carbine',
    damage: 2,
    projectileSpeed: 620,
    fireCooldownMs: 260,
    maxRange: 700
  },
  sniper_rifle: {
    key: 'sniper_rifle',
    damage: 4,
    projectileSpeed: 720,
    fireCooldownMs: 680,
    maxRange: 940
  }
};

export function getWeaponRuntimeConfig(weaponKey?: string): WeaponRuntimeConfig {
  if (!weaponKey) {
    return DEFAULT_WEAPON_RUNTIME_CONFIG;
  }

  return WEAPON_RUNTIME_CONFIG_BY_KEY[weaponKey] ?? {
    ...DEFAULT_WEAPON_RUNTIME_CONFIG,
    key: weaponKey
  };
}

export function applyLegacyWeaponOverrides(overrides: {
  fireCooldownMs?: number;
  projectileSpeed?: number;
}): void {
  if (!overrides.fireCooldownMs && !overrides.projectileSpeed) {
    return;
  }

  const pistol = WEAPON_RUNTIME_CONFIG_BY_KEY.pistol;
  WEAPON_RUNTIME_CONFIG_BY_KEY.pistol = {
    ...pistol,
    fireCooldownMs: overrides.fireCooldownMs ?? pistol.fireCooldownMs,
    projectileSpeed: overrides.projectileSpeed ?? pistol.projectileSpeed
  };
}
