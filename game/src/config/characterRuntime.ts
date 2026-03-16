import characterCatalog from '../../assets/characters/characters.json';
import { getWeaponRuntimeConfig, WeaponRuntimeConfig } from './weaponRuntime';
import { resolveWeaponKey } from './weaponCatalog';

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

export interface CharacterRuntimeConfig {
  characterId: RuntimeCharacterId;
  name: string;
  role: CharacterRole;
  playable: boolean;
  aiPossible: boolean;
  maxHealth: number;
  baseWeapon: CharacterWeaponKey;
  weaponRuntime: WeaponRuntimeConfig;
}

interface CharacterStats {
  health?: number;
}

interface CharacterCatalogEntry {
  name: string;
  role: CharacterRole;
  playable: boolean;
  ai_possible: boolean;
  weapon_default: CharacterWeaponKey;
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
  weaponRuntime: getWeaponRuntimeConfig('pistol')
};

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

    const weaponKey = resolveWeaponKey(entry.weapon_default ?? DEFAULT_RUNTIME_CHARACTER.baseWeapon);

    return [
      characterId,
      {
        characterId,
        name: entry.name,
        role: entry.role,
        playable: entry.playable,
        aiPossible: entry.ai_possible,
        maxHealth: entry.stats?.health ?? DEFAULT_RUNTIME_CHARACTER.maxHealth,
        baseWeapon: weaponKey,
        weaponRuntime: getWeaponRuntimeConfig(weaponKey)
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
