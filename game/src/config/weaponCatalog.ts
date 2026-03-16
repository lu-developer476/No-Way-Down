export type WeaponSlotType = 'primary' | 'secondary' | 'defense';

export interface WeaponCatalogEntry {
  key: string;
  displayName: string;
  family: string;
  slotType: WeaponSlotType;
  ammoType: string | null;
  usesAmmo: boolean;
  isMelee: boolean;
  isDefensive: boolean;
  magazineSize: number;
  reloadTimeMs: number;
  damage: number;
  fireRateMs: number;
  bulletSpeed: number;
  spread: number;
  maxRange: number;
  projectileStyle: string;
  visualKey: string;
  projectileTint?: number;
  projectileScale: number;
  muzzleOffsetX: number;
  muzzleOffsetY: number;
  headshotChance: number;
}

const DEFAULT_WEAPON_KEY = 'pistol';

const WEAPON_ALIAS_BY_KEY: Record<string, string> = {
  submachine_gun: 'smg'
};

const WEAPON_CATALOG_BY_KEY: Record<string, WeaponCatalogEntry> = {
  pistol: {
    key: 'pistol',
    displayName: 'Pistol',
    family: 'handgun',
    slotType: 'secondary',
    ammoType: '9mm',
    usesAmmo: true,
    isMelee: false,
    isDefensive: false,
    magazineSize: 12,
    reloadTimeMs: 1050,
    damage: 1,
    fireRateMs: 220,
    bulletSpeed: 520,
    spread: 0.01,
    maxRange: 560,
    projectileStyle: 'pistol',
    visualKey: 'projectile-pistol',
    projectileTint: 0xf8fafc,
    projectileScale: 1,
    muzzleOffsetX: 24,
    muzzleOffsetY: -6,
    headshotChance: 0.1
  },
  revolver: {
    key: 'revolver',
    displayName: 'Revolver',
    family: 'handgun',
    slotType: 'secondary',
    ammoType: '.357',
    usesAmmo: true,
    isMelee: false,
    isDefensive: false,
    magazineSize: 6,
    reloadTimeMs: 1400,
    damage: 2,
    fireRateMs: 340,
    bulletSpeed: 560,
    spread: 0.012,
    maxRange: 600,
    projectileStyle: 'revolver',
    visualKey: 'projectile-revolver',
    projectileTint: 0xfbbf24,
    projectileScale: 1.05,
    muzzleOffsetX: 24,
    muzzleOffsetY: -6,
    headshotChance: 0.18
  },
  smg: {
    key: 'smg',
    displayName: 'SMG',
    family: 'smg',
    slotType: 'primary',
    ammoType: '9mm',
    usesAmmo: true,
    isMelee: false,
    isDefensive: false,
    magazineSize: 30,
    reloadTimeMs: 1500,
    damage: 1,
    fireRateMs: 140,
    bulletSpeed: 500,
    spread: 0.04,
    maxRange: 500,
    projectileStyle: 'smg',
    visualKey: 'projectile-smg',
    projectileTint: 0x93c5fd,
    projectileScale: 0.95,
    muzzleOffsetX: 23,
    muzzleOffsetY: -7,
    headshotChance: 0.08
  },
  shotgun: {
    key: 'shotgun',
    displayName: 'Shotgun',
    family: 'shotgun',
    slotType: 'primary',
    ammoType: '12g',
    usesAmmo: true,
    isMelee: false,
    isDefensive: false,
    magazineSize: 8,
    reloadTimeMs: 1750,
    damage: 3,
    fireRateMs: 560,
    bulletSpeed: 460,
    spread: 0.09,
    maxRange: 360,
    projectileStyle: 'shotgun',
    visualKey: 'projectile-shotgun',
    projectileTint: 0xfde68a,
    projectileScale: 1.2,
    muzzleOffsetX: 26,
    muzzleOffsetY: -5,
    headshotChance: 0.16
  },
  carbine: {
    key: 'carbine',
    displayName: 'Carbine',
    family: 'rifle',
    slotType: 'primary',
    ammoType: '5.56',
    usesAmmo: true,
    isMelee: false,
    isDefensive: false,
    magazineSize: 30,
    reloadTimeMs: 1650,
    damage: 2,
    fireRateMs: 260,
    bulletSpeed: 620,
    spread: 0.018,
    maxRange: 700,
    projectileStyle: 'carbine',
    visualKey: 'projectile-carbine',
    projectileTint: 0x86efac,
    projectileScale: 1.1,
    muzzleOffsetX: 27,
    muzzleOffsetY: -7,
    headshotChance: 0.24
  },
  sniper_rifle: {
    key: 'sniper_rifle',
    displayName: 'Sniper Rifle',
    family: 'rifle',
    slotType: 'primary',
    ammoType: '7.62',
    usesAmmo: true,
    isMelee: false,
    isDefensive: false,
    magazineSize: 5,
    reloadTimeMs: 2300,
    damage: 4,
    fireRateMs: 680,
    bulletSpeed: 720,
    spread: 0.004,
    maxRange: 940,
    projectileStyle: 'sniper_rifle',
    visualKey: 'projectile-sniper_rifle',
    projectileTint: 0xe2e8f0,
    projectileScale: 1.2,
    muzzleOffsetX: 29,
    muzzleOffsetY: -9,
    headshotChance: 0.4
  },
  light_machine_gun: {
    key: 'light_machine_gun',
    displayName: 'Light Machine Gun',
    family: 'lmg',
    slotType: 'primary',
    ammoType: '5.56',
    usesAmmo: true,
    isMelee: false,
    isDefensive: false,
    magazineSize: 60,
    reloadTimeMs: 2600,
    damage: 2,
    fireRateMs: 110,
    bulletSpeed: 540,
    spread: 0.05,
    maxRange: 620,
    projectileStyle: 'smg',
    visualKey: 'projectile-smg',
    projectileTint: 0xfca5a5,
    projectileScale: 1,
    muzzleOffsetX: 28,
    muzzleOffsetY: -7,
    headshotChance: 0.12
  },
  knife: {
    key: 'knife',
    displayName: 'Knife',
    family: 'blade',
    slotType: 'secondary',
    ammoType: null,
    usesAmmo: false,
    isMelee: true,
    isDefensive: false,
    magazineSize: 0,
    reloadTimeMs: 0,
    damage: 2,
    fireRateMs: 280,
    bulletSpeed: 280,
    spread: 0,
    maxRange: 70,
    projectileStyle: 'shotgun',
    visualKey: 'projectile-shotgun',
    projectileTint: 0xe5e7eb,
    projectileScale: 0.9,
    muzzleOffsetX: 20,
    muzzleOffsetY: -4,
    headshotChance: 0.05
  },
  machete: {
    key: 'machete',
    displayName: 'Machete',
    family: 'blade',
    slotType: 'primary',
    ammoType: null,
    usesAmmo: false,
    isMelee: true,
    isDefensive: false,
    magazineSize: 0,
    reloadTimeMs: 0,
    damage: 3,
    fireRateMs: 420,
    bulletSpeed: 260,
    spread: 0,
    maxRange: 85,
    projectileStyle: 'carbine',
    visualKey: 'projectile-carbine',
    projectileTint: 0xd1d5db,
    projectileScale: 1,
    muzzleOffsetX: 23,
    muzzleOffsetY: -4,
    headshotChance: 0.06
  },
  sword: {
    key: 'sword',
    displayName: 'Sword',
    family: 'blade',
    slotType: 'primary',
    ammoType: null,
    usesAmmo: false,
    isMelee: true,
    isDefensive: false,
    magazineSize: 0,
    reloadTimeMs: 0,
    damage: 4,
    fireRateMs: 520,
    bulletSpeed: 250,
    spread: 0,
    maxRange: 95,
    projectileStyle: 'sniper_rifle',
    visualKey: 'projectile-sniper_rifle',
    projectileTint: 0xf8fafc,
    projectileScale: 1,
    muzzleOffsetX: 24,
    muzzleOffsetY: -5,
    headshotChance: 0.08
  },
  tray_shield: {
    key: 'tray_shield',
    displayName: 'Tray Shield',
    family: 'shield',
    slotType: 'defense',
    ammoType: null,
    usesAmmo: false,
    isMelee: true,
    isDefensive: true,
    magazineSize: 0,
    reloadTimeMs: 0,
    damage: 1,
    fireRateMs: 650,
    bulletSpeed: 220,
    spread: 0,
    maxRange: 55,
    projectileStyle: 'pistol',
    visualKey: 'projectile-pistol',
    projectileTint: 0x94a3b8,
    projectileScale: 1,
    muzzleOffsetX: 18,
    muzzleOffsetY: -3,
    headshotChance: 0.03
  }
};

const warnedUnknownKeys = new Set<string>();

function warnUnknownWeaponKey(weaponKey: string): void {
  if (warnedUnknownKeys.has(weaponKey)) {
    return;
  }

  warnedUnknownKeys.add(weaponKey);
  console.warn(`[weaponCatalog] Unknown weapon key "${weaponKey}". Using fallback "${DEFAULT_WEAPON_KEY}".`);
}

export function resolveWeaponKey(weaponKey?: string): string {
  if (!weaponKey) {
    return DEFAULT_WEAPON_KEY;
  }

  const normalized = WEAPON_ALIAS_BY_KEY[weaponKey] ?? weaponKey;
  if (!WEAPON_CATALOG_BY_KEY[normalized]) {
    warnUnknownWeaponKey(weaponKey);
    return DEFAULT_WEAPON_KEY;
  }

  return normalized;
}

export function getWeaponCatalogEntry(weaponKey?: string): WeaponCatalogEntry {
  return WEAPON_CATALOG_BY_KEY[resolveWeaponKey(weaponKey)] ?? WEAPON_CATALOG_BY_KEY[DEFAULT_WEAPON_KEY];
}

export function getDefaultWeaponCatalogEntry(): WeaponCatalogEntry {
  return WEAPON_CATALOG_BY_KEY[DEFAULT_WEAPON_KEY];
}

export function getAllWeaponCatalogEntries(): WeaponCatalogEntry[] {
  return Object.values(WEAPON_CATALOG_BY_KEY);
}
