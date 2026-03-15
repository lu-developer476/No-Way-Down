import characterCatalog from '../../assets/characters/characters.json';
import animationCatalog from '../../assets/characters/animations.json';

export type CharacterFaction = 'protagonist' | 'ally' | 'zombie';
export type CharacterSilhouette = 'slim' | 'standard' | 'broad';
export type CharacterHairStyle = 'short' | 'long' | 'afro';
export type CharacterWeaponStyle = 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'rifle';

export interface CharacterPalette {
  skin: number;
  torso: number;
  pants: number;
  accent: number;
  eye: number;
  hair: number;
  factionBand: number;
  weapon: number;
}

export interface CharacterVisualProfile {
  id: string;
  name: string;
  shortName: string;
  faction: CharacterFaction;
  silhouette: CharacterSilhouette;
  hairStyle: CharacterHairStyle;
  weaponStyle: CharacterWeaponStyle;
  palette: CharacterPalette;
}

const WEAPON_STYLE_BY_KEY: Record<string, CharacterWeaponStyle> = {
  sniper_rifle: 'rifle',
  carbine: 'rifle',
  pistol: 'pistol',
  revolver: 'revolver',
  smg: 'smg',
  shotgun: 'shotgun'
};

const HAIR_STYLE_BY_KEY: Array<{ matcher: RegExp; value: CharacterHairStyle }> = [
  { matcher: /afro/i, value: 'afro' },
  { matcher: /largo|semilargo/i, value: 'long' }
];

interface CharacterNarrativeEntry {
  name: string;
  role: string;
  playable: boolean;
  hair: string;
  weapon_default: string;
}

const NARRATIVE_BY_NAME = new Map(
  (characterCatalog.characters as CharacterNarrativeEntry[]).map((entry) => [entry.name, entry])
);

const animationNames = new Set(Object.keys(animationCatalog.characters));

function toHex(color: string): number {
  return Number.parseInt(color.replace('#', '0x'), 16);
}

function inferHairStyle(hair: string): CharacterHairStyle {
  const found = HAIR_STYLE_BY_KEY.find(({ matcher }) => matcher.test(hair));
  return found?.value ?? 'short';
}

function inferFaction(role: string, playable: boolean): CharacterFaction {
  if (playable || role.includes('protagonist')) {
    return 'protagonist';
  }

  return 'ally';
}

interface CharacterVisualOverride {
  id: string;
  shortName: string;
  silhouette: CharacterSilhouette;
  palette: {
    torso: string;
    pants: string;
    accent: string;
    hair: string;
    skin: string;
    factionBand?: string;
    weapon?: string;
  };
}

const CHARACTER_VISUAL_OVERRIDES: Record<string, CharacterVisualOverride> = {
  'Alan Nahuel': {
    id: 'alan',
    shortName: 'Alan',
    silhouette: 'broad',
    palette: { torso: '#334155', pants: '#0f172a', accent: '#f59e0b', hair: '#e5e7eb', skin: '#d6a27f' }
  },
  Giovanna: {
    id: 'giovanna',
    shortName: 'Giov',
    silhouette: 'slim',
    palette: { torso: '#334155', pants: '#1e293b', accent: '#d946ef', hair: '#111827', skin: '#f8e6d8' }
  },
  Nahir: {
    id: 'nahir',
    shortName: 'Nahir',
    silhouette: 'slim',
    palette: { torso: '#1d4ed8', pants: '#1e293b', accent: '#f472b6', hair: '#dc2626', skin: '#d9b092' }
  },
  Damian: {
    id: 'damian',
    shortName: 'Damian',
    silhouette: 'broad',
    palette: { torso: '#7c2d12', pants: '#292524', accent: '#f59e0b', hair: '#111827', skin: '#edd8c7' }
  },
  Yamil: {
    id: 'yamil',
    shortName: 'Yamil',
    silhouette: 'standard',
    palette: { torso: '#57534e', pants: '#292524', accent: '#fb923c', hair: '#b45309', skin: '#f5d0b5' }
  },
  Hernan: {
    id: 'hernan',
    shortName: 'Hernan',
    silhouette: 'standard',
    palette: { torso: '#1f2937', pants: '#0f172a', accent: '#22c55e', hair: '#111827', skin: '#d8a785' }
  },
  Celestino: {
    id: 'celestino',
    shortName: 'Celes',
    silhouette: 'broad',
    palette: { torso: '#14532d', pants: '#1f2937', accent: '#fde047', hair: '#111827', skin: '#cb9776' }
  },
  Lorena: {
    id: 'lorena',
    shortName: 'Lore',
    silhouette: 'slim',
    palette: { torso: '#7f1d1d', pants: '#1f2937', accent: '#fca5a5', hair: '#111827', skin: '#d2a080' }
  },
  Selene: {
    id: 'selene',
    shortName: 'Sele',
    silhouette: 'slim',
    palette: { torso: '#6d28d9', pants: '#1e293b', accent: '#f9a8d4', hair: '#7c2d12', skin: '#d8b18f' }
  }
};

const DEFAULT_ZOMBIE_PROFILE: CharacterVisualProfile = {
  id: 'zombie-walker',
  name: 'Walker',
  shortName: 'Zombie',
  faction: 'zombie',
  silhouette: 'standard',
  hairStyle: 'short',
  weaponStyle: 'pistol',
  palette: {
    skin: 0x93b773,
    torso: 0x3f5a34,
    pants: 0x3b2a1f,
    accent: 0x9f1239,
    eye: 0xf8fafc,
    hair: 0x475569,
    factionBand: 0x7f1d1d,
    weapon: 0x4b5563
  }
};

const CHARACTER_VISUALS: CharacterVisualProfile[] = Object.entries(CHARACTER_VISUAL_OVERRIDES)
  .map(([name, override]) => {
    const narrative = NARRATIVE_BY_NAME.get(name);
    if (!narrative) {
      throw new Error(`Missing narrative character data for ${name}.`);
    }

    if (!animationNames.has(name)) {
      throw new Error(`Missing animation entry for ${name}.`);
    }

    const weaponStyle = WEAPON_STYLE_BY_KEY[narrative.weapon_default] ?? 'pistol';
    const hairStyle = inferHairStyle(narrative.hair);
    const faction = inferFaction(narrative.role, narrative.playable);
    const factionBand = faction === 'protagonist' ? '#facc15' : '#22d3ee';

    return {
      id: override.id,
      name,
      shortName: override.shortName,
      faction,
      silhouette: override.silhouette,
      hairStyle,
      weaponStyle,
      palette: {
        skin: toHex(override.palette.skin),
        torso: toHex(override.palette.torso),
        pants: toHex(override.palette.pants),
        accent: toHex(override.palette.accent),
        eye: 0xffffff,
        hair: toHex(override.palette.hair),
        factionBand: toHex(override.palette.factionBand ?? factionBand),
        weapon: toHex(override.palette.weapon ?? '#94a3b8')
      }
    } satisfies CharacterVisualProfile;
  })
  .concat(DEFAULT_ZOMBIE_PROFILE);

const VISUAL_BY_ID = new Map(CHARACTER_VISUALS.map((profile) => [profile.id, profile]));

export function getCharacterVisualById(id: string): CharacterVisualProfile {
  const profile = VISUAL_BY_ID.get(id);
  if (!profile) {
    return DEFAULT_ZOMBIE_PROFILE;
  }

  return profile;
}

export function getCharacterVisualsByFaction(faction: CharacterFaction): CharacterVisualProfile[] {
  return CHARACTER_VISUALS.filter((profile) => profile.faction === faction);
}

export { CHARACTER_VISUALS };
