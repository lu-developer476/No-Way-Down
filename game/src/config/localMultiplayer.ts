import Phaser from 'phaser';
import { InitialRunSetup } from '../scenes/sceneShared';
import { getCharacterRuntimeConfig } from './characterRuntime';
import { controlManager } from '../input/ControlManager';

export type PlayerSlot = 1 | 2 | 3 | 4;
export type PlayableCharacterId = 'alan' | 'giovanna' | 'nahir' | 'damian';
export type PartyCharacterId = PlayableCharacterId | 'lorena' | 'selene' | 'celestino' | 'hernan' | 'yamil';

export interface PlayerControlScheme {
  left: number;
  right: number;
  down: number;
  jump: number;
  shoot: number;
  reload: number;
  switchWeapon: number;
  interact: number;
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
  left: controlManager.getKeyCode('move_left'),
  right: controlManager.getKeyCode('move_right'),
  down: controlManager.getKeyCode('move_down'),
  jump: controlManager.getKeyCode('jump'),
  shoot: controlManager.getKeyCode('shoot'),
  reload: controlManager.getKeyCode('reload'),
  switchWeapon: controlManager.getKeyCode('switch_weapon'),
  interact: controlManager.getKeyCode('interact')
};

const PARTY_MEMBER_TINT: Record<PartyCharacterId, number> = {
  alan: 0xfacc15,
  giovanna: 0xf472b6,
  nahir: 0x38bdf8,
  damian: 0x34d399,
  lorena: 0xfb7185,
  selene: 0xc084fc,
  celestino: 0xfde047,
  hernan: 0xa7f3d0,
  yamil: 0x93c5fd
};

const OPTIONAL_SETUP_TO_CHARACTER: Record<string, Extract<PartyCharacterId, 'celestino' | 'hernan' | 'yamil'>> = {
  Celestino: 'celestino',
  Hernán: 'hernan',
  Yamil: 'yamil'
};

function createMainPlayerConfig(characterId: Extract<PartyCharacterId, 'alan' | 'giovanna'>): PlayerConfig {
  const runtime = getCharacterRuntimeConfig(characterId);
  return {
    slot: 1,
    name: runtime.name,
    characterId,
    color: PARTY_MEMBER_TINT[characterId],
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
      name: getCharacterRuntimeConfig(characterId).name,
      characterId,
      tint: PARTY_MEMBER_TINT[characterId]
    }));

  return {
    activePlayers,
    allies
  };
}

export function getActivePlayerConfigs(setup?: InitialRunSetup | null): PlayerConfig[] {
  return getInitialPartySeed(setup).activePlayers;
}
