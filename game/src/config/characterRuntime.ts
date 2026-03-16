import characterCatalog from '../../assets/characters/characters.json';
import { resolveWeaponKey } from './weaponCatalog';
import { getWeaponRuntimeConfig, WeaponRuntimeConfig } from './weaponRuntime';

export type RuntimeCharacterId =
  | 'alan'
  | 'giovanna'
  | 'yamil'
  | 'hernan'
  | 'lorena'
  | 'celestino'
  | 'selene'
  | 'nahir'
  | 'damian';

export type CharacterRole =
  | 'main_protagonist'
  | 'optional_protagonist'
  | 'secondary'
  | 'rescue_character'
  | string;

export type CharacterWeaponKey =
  | 'sniper_rifle'
  | 'carbine'
  | 'pistol'
  | 'revolver'
  | 'smg'
  | 'shotgun'
  | 'light_machine_gun'
  | 'knife'
  | 'machete'
  | 'sword'
  | 'tray_shield'
  | 'submachine_gun'
  | string;

export type CharacterWeaponSlot = 'primary' | 'secondary';

export interface CharacterInventoryLoadout {
  primaryWeapon: CharacterWeaponKey;
  secondaryWeapon?: CharacterWeaponKey;
  activeSlot: CharacterWeaponSlot;
  inventory: CharacterWeaponKey[];
}

export interface CharacterRuntimeConfig {
  characterId: RuntimeCharacterId;
  name: string;
  role: CharacterRole;
  playable: boolean;
  aiPossible: boolean;
  maxHealth: number;
  baseWeapon: CharacterWeaponKey;
  weaponRuntime: WeaponRuntimeConfig;
  loadout: CharacterInventoryLoadout;
  weaponRuntimeBySlot: Record<CharacterWeaponSlot, WeaponRuntimeConfig | undefined>;
}

interface CharacterStats {
  health?: number;
}

interface CharacterCatalogLoadout {
  primary_weapon?: CharacterWeaponKey;
  secondary_weapon?: CharacterWeaponKey;
  active_slot?: CharacterWeaponSlot;
}

interface CharacterCatalogEntry {
  name: string;
  role: CharacterRole;
  playable: boolean;
  ai_possible: boolean;
  weapon_default: CharacterWeaponKey;
  loadout?: CharacterCatalogLoadout;
  stats?: CharacterStats;
}

const CATALOG_NAME_BY_ID: Record<RuntimeCharacterId, string> = {
  alan: 'Alan Nahuel',
  giovanna: 'Giovanna',
  yamil: 'Yamil',
  hernan: 'Hernan',
  lorena: 'Lorena',
  celestino: 'Celestino',
  selene: 'Selene',
  nahir: 'Nahir',
  damian: 'Damian'
};

const DEFAULT_RUNTIME_CHARACTER: Omit<CharacterRuntimeConfig, 'characterId'> = {
  name: 'Unknown',
  role: 'secondary',
  playable: false,
  aiPossible: true,
  maxHealth: 100,
  baseWeapon: 'pistol',
  weaponRuntime: getWeaponRuntimeConfig('pistol'),
  loadout: {
    primaryWeapon: 'pistol',
    activeSlot: 'primary',
    inventory: ['pistol']
  },
  weaponRuntimeBySlot: {
    primary: getWeaponRuntimeConfig('pistol'),
    secondary: undefined
  }
};

function buildLoadoutFromCatalog(entry: CharacterCatalogEntry): CharacterInventoryLoadout {
  const weaponDefault = resolveWeaponKey(entry.weapon_default ?? DEFAULT_RUNTIME_CHARACTER.baseWeapon);
  const catalogLoadout = entry.loadout;

  const primaryWeapon = resolveWeaponKey(catalogLoadout?.primary_weapon ?? weaponDefault);
  const secondaryWeapon = catalogLoadout?.secondary_weapon
    ? resolveWeaponKey(catalogLoadout.secondary_weapon)
    : undefined;

  const requestedSlot = catalogLoadout?.active_slot;
  const activeSlot: CharacterWeaponSlot = requestedSlot === 'secondary' && secondaryWeapon
    ? 'secondary'
    : 'primary';

  const inventory = [primaryWeapon, secondaryWeapon].filter((weapon): weapon is CharacterWeaponKey => Boolean(weapon));

  if (inventory.length === 0) {
    return {
      primaryWeapon: weaponDefault,
      activeSlot: 'primary',
      inventory: [weaponDefault]
    };
  }

  return {
    primaryWeapon,
    secondaryWeapon,
    activeSlot,
    inventory
  };
}

function buildWeaponRuntimeBySlot(loadout: CharacterInventoryLoadout): Record<CharacterWeaponSlot, WeaponRuntimeConfig | undefined> {
  return {
    primary: getWeaponRuntimeConfig(loadout.primaryWeapon),
    secondary: loadout.secondaryWeapon ? getWeaponRuntimeConfig(loadout.secondaryWeapon) : undefined
  };
}

function resolveBaseWeapon(loadout: CharacterInventoryLoadout): CharacterWeaponKey {
  return loadout.activeSlot === 'secondary' && loadout.secondaryWeapon
    ? loadout.secondaryWeapon
    : loadout.primaryWeapon;
}

const catalogEntries = characterCatalog.characters as CharacterCatalogEntry[];
const catalogByName = new Map(catalogEntries.map((entry) => [entry.name, entry]));

const RUNTIME_CONFIG_BY_ID = new Map<RuntimeCharacterId, CharacterRuntimeConfig>(
  (Object.entries(CATALOG_NAME_BY_ID) as Array<[RuntimeCharacterId, string]>).map(([characterId, catalogName]) => {
    const entry = catalogByName.get(catalogName);

    if (!entry) {
      return [
        characterId,
        {
          characterId,
          ...DEFAULT_RUNTIME_CHARACTER,
          name: catalogName
        }
      ];
    }

    const loadout = buildLoadoutFromCatalog(entry);
    const weaponRuntimeBySlot = buildWeaponRuntimeBySlot(loadout);
    const baseWeapon = resolveBaseWeapon(loadout);

    return [
      characterId,
      {
        characterId,
        name: entry.name,
        role: entry.role,
        playable: entry.playable,
        aiPossible: entry.ai_possible,
        maxHealth: entry.stats?.health ?? DEFAULT_RUNTIME_CHARACTER.maxHealth,
        baseWeapon,
        weaponRuntime: getWeaponRuntimeConfig(baseWeapon),
        loadout,
        weaponRuntimeBySlot
      }
    ];
  })
);

export function getCharacterRuntimeConfig(characterId: string): CharacterRuntimeConfig {
  const runtimeConfig = RUNTIME_CONFIG_BY_ID.get(characterId as RuntimeCharacterId);
  if (runtimeConfig) {
    return runtimeConfig;
  }

  return {
    characterId: 'alan',
    ...DEFAULT_RUNTIME_CHARACTER
  };
}
