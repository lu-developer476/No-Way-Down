export type WeaponType = 'pistol' | 'shotgun' | 'rifle' | 'sniper';

export interface CharacterConfig {
  readonly name: string;
  readonly health: number;
  readonly weapon: WeaponType;
  readonly damage: number;
  readonly fireRate: number;
  readonly speed: number;
  readonly textureKey?: string;
}

export const CHARACTERS = {
  damian: {
    name: 'Damian',
    health: 120,
    weapon: 'pistol',
    damage: 20,
    fireRate: 400,
    speed: 90,
    textureKey: 'damian-sheet'
  },
  nahir: {
    name: 'Nahir',
    health: 90,
    weapon: 'pistol',
    damage: 18,
    fireRate: 350,
    speed: 95,
    textureKey: 'nahir-sheet'
  },
  alan: {
    name: 'Alan Nahuel',
    health: 130,
    weapon: 'shotgun',
    damage: 32,
    fireRate: 750,
    speed: 85,
    textureKey: 'alan-sheet'
  },
  giovanna: {
    name: 'Giovanna',
    health: 105,
    weapon: 'rifle',
    damage: 24,
    fireRate: 280,
    speed: 98,
    textureKey: 'giovanna-sheet'
  },
  hernan: {
    name: 'Hernan',
    health: 125,
    weapon: 'rifle',
    damage: 26,
    fireRate: 300,
    speed: 88,
    textureKey: 'hernan-sheet'
  },
  selene: {
    name: 'Selene',
    health: 95,
    weapon: 'pistol',
    damage: 19,
    fireRate: 320,
    speed: 102,
    textureKey: 'selene-sheet'
  },
  celestino: {
    name: 'Celestino',
    health: 140,
    weapon: 'sniper',
    damage: 42,
    fireRate: 950,
    speed: 80,
    textureKey: 'celestino-sheet'
  },
  lorena: {
    name: 'Lorena',
    health: 110,
    weapon: 'rifle',
    damage: 25,
    fireRate: 290,
    speed: 93,
    textureKey: 'lorena-sheet'
  },
  yamil: {
    name: 'Yamil',
    health: 115,
    weapon: 'shotgun',
    damage: 30,
    fireRate: 700,
    speed: 91,
    textureKey: 'yamil-sheet'
  }
} as const satisfies Record<string, CharacterConfig>;

export type CharacterId = keyof typeof CHARACTERS;
