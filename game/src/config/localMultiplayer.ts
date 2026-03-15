import Phaser from 'phaser';
import { InitialRunSetup } from '../scenes/sceneShared';

export type PlayerSlot = 1 | 2 | 3 | 4;
export type PlayableCharacterId = 'alan' | 'giovanna' | 'nahir' | 'damian';
export type PartyCharacterId = PlayableCharacterId | 'lorena' | 'selene' | 'celestino' | 'hernan' | 'yamil';

export interface PlayerControlScheme {
  left: number;
  right: number;
  down: number;
  jump: number;
  shoot: number;
}

export interface PlayerConfig {
  slot: PlayerSlot;
  name: string;
  characterId: PlayableCharacterId;
  color: number;
  controls: PlayerControlScheme;
}

export interface AllySeedConfig {
  id: string;
  name: string;
  characterId: PartyCharacterId;
  tint: number;
}

export interface PartySeedConfig {
  activePlayers: PlayerConfig[];
  allies: AllySeedConfig[];
}

const CONTROLS_P1: PlayerControlScheme = {
  left: Phaser.Input.Keyboard.KeyCodes.A,
  right: Phaser.Input.Keyboard.KeyCodes.D,
  down: Phaser.Input.Keyboard.KeyCodes.S,
  jump: Phaser.Input.Keyboard.KeyCodes.W,
  shoot: Phaser.Input.Keyboard.KeyCodes.F
};

const PARTY_MEMBER_DATA: Record<PartyCharacterId, { name: string; tint: number }> = {
  alan: { name: 'Alan', tint: 0xfacc15 },
  giovanna: { name: 'Giovanna', tint: 0xf472b6 },
  nahir: { name: 'Nahir', tint: 0x38bdf8 },
  damian: { name: 'Damián', tint: 0x34d399 },
  lorena: { name: 'Lorena', tint: 0xfb7185 },
  selene: { name: 'Selene', tint: 0xc084fc },
  celestino: { name: 'Celestino', tint: 0xfde047 },
  hernan: { name: 'Hernán', tint: 0xa7f3d0 },
  yamil: { name: 'Yamil', tint: 0x93c5fd }
};

const OPTIONAL_SETUP_TO_CHARACTER: Record<string, Extract<PartyCharacterId, 'celestino' | 'hernan' | 'yamil'>> = {
  Celestino: 'celestino',
  Hernán: 'hernan',
  Yamil: 'yamil'
};

function createMainPlayerConfig(characterId: Extract<PartyCharacterId, 'alan' | 'giovanna'>): PlayerConfig {
  const profile = PARTY_MEMBER_DATA[characterId];
  return {
    slot: 1,
    name: profile.name,
    characterId,
    color: profile.tint,
    controls: CONTROLS_P1
  };
}

export function getInitialPartySeed(setup?: InitialRunSetup | null): PartySeedConfig {
  const protagonist: Extract<PartyCharacterId, 'alan' | 'giovanna'> = setup?.protagonist === 'giovanna'
    ? 'giovanna'
    : 'alan';

  const selectedMembers = new Set<PartyCharacterId>([
    'alan',
    'giovanna',
    'damian',
    'nahir'
  ]);

  (setup?.party.optional ?? []).forEach((optionalName) => {
    const optionalId = OPTIONAL_SETUP_TO_CHARACTER[optionalName];
    if (optionalId) {
      selectedMembers.add(optionalId);
    }
  });

  const activePlayers = [createMainPlayerConfig(protagonist)];

  const allies = [...selectedMembers]
    .filter((characterId) => characterId !== protagonist)
    .map((characterId) => ({
      id: `ally-${characterId}`,
      name: PARTY_MEMBER_DATA[characterId].name,
      characterId,
      tint: PARTY_MEMBER_DATA[characterId].tint
    }));

  return {
    activePlayers,
    allies
  };
}

export function getActivePlayerConfigs(setup?: InitialRunSetup | null): PlayerConfig[] {
  return getInitialPartySeed(setup).activePlayers;
}
