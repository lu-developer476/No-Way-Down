import { CharacterWeaponKey } from './characterRuntime';

export interface WeaponVisualRuntimeConfig {
  key: string;
  projectileTexture: string;
  projectileTint?: number;
  projectileScale: number;
  muzzleOffsetX: number;
  muzzleOffsetY: number;
}

const DEFAULT_WEAPON_VISUAL_RUNTIME: WeaponVisualRuntimeConfig = {
  key: 'pistol',
  projectileTexture: 'projectile-pistol',
  projectileTint: 0xf8fafc,
  projectileScale: 1,
  muzzleOffsetX: 24,
  muzzleOffsetY: -6
};

const WEAPON_VISUAL_RUNTIME_BY_KEY: Record<string, WeaponVisualRuntimeConfig> = {
  pistol: {
    key: 'pistol',
    projectileTexture: 'projectile-pistol',
    projectileTint: 0xf8fafc,
    projectileScale: 1,
    muzzleOffsetX: 24,
    muzzleOffsetY: -6
  },
  revolver: {
    key: 'revolver',
    projectileTexture: 'projectile-revolver',
    projectileTint: 0xfbbf24,
    projectileScale: 1.05,
    muzzleOffsetX: 24,
    muzzleOffsetY: -6
  },
  smg: {
    key: 'smg',
    projectileTexture: 'projectile-smg',
    projectileTint: 0x93c5fd,
    projectileScale: 0.95,
    muzzleOffsetX: 23,
    muzzleOffsetY: -7
  },
  shotgun: {
    key: 'shotgun',
    projectileTexture: 'projectile-shotgun',
    projectileTint: 0xfde68a,
    projectileScale: 1.2,
    muzzleOffsetX: 26,
    muzzleOffsetY: -5
  },
  carbine: {
    key: 'carbine',
    projectileTexture: 'projectile-carbine',
    projectileTint: 0x86efac,
    projectileScale: 1.1,
    muzzleOffsetX: 27,
    muzzleOffsetY: -7
  },
  sniper_rifle: {
    key: 'sniper_rifle',
    projectileTexture: 'projectile-sniper_rifle',
    projectileTint: 0xe2e8f0,
    projectileScale: 1.2,
    muzzleOffsetX: 29,
    muzzleOffsetY: -9
  }
};

export function getWeaponVisualRuntimeConfig(weaponKey?: CharacterWeaponKey): WeaponVisualRuntimeConfig {
  if (!weaponKey) {
    return DEFAULT_WEAPON_VISUAL_RUNTIME;
  }

  return WEAPON_VISUAL_RUNTIME_BY_KEY[weaponKey] ?? {
    ...DEFAULT_WEAPON_VISUAL_RUNTIME,
    key: weaponKey
  };
}
