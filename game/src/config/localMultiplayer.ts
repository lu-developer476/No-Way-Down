import Phaser from 'phaser';

export type PlayerSlot = 1 | 2 | 3 | 4;

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
  color: number;
  controls: PlayerControlScheme;
}

const PLAYER_CONFIGS: Record<PlayerSlot, PlayerConfig> = {
  1: {
    slot: 1,
    name: 'Player 1',
    color: 0xfacc15,
    controls: {
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      jump: Phaser.Input.Keyboard.KeyCodes.UP,
      shoot: Phaser.Input.Keyboard.KeyCodes.SPACE
    }
  },
  2: {
    slot: 2,
    name: 'Player 2',
    color: 0x38bdf8,
    controls: {
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      jump: Phaser.Input.Keyboard.KeyCodes.W,
      shoot: Phaser.Input.Keyboard.KeyCodes.F
    }
  },
  3: {
    slot: 3,
    name: 'Player 3',
    color: 0x34d399,
    controls: {
      left: Phaser.Input.Keyboard.KeyCodes.J,
      right: Phaser.Input.Keyboard.KeyCodes.L,
      down: Phaser.Input.Keyboard.KeyCodes.K,
      jump: Phaser.Input.Keyboard.KeyCodes.I,
      shoot: Phaser.Input.Keyboard.KeyCodes.H
    }
  },
  4: {
    slot: 4,
    name: 'Player 4',
    color: 0xf472b6,
    controls: {
      left: Phaser.Input.Keyboard.KeyCodes.NUMPAD_FOUR,
      right: Phaser.Input.Keyboard.KeyCodes.NUMPAD_SIX,
      down: Phaser.Input.Keyboard.KeyCodes.NUMPAD_FIVE,
      jump: Phaser.Input.Keyboard.KeyCodes.NUMPAD_EIGHT,
      shoot: Phaser.Input.Keyboard.KeyCodes.NUMPAD_ZERO
    }
  }
};

// Etapa 11: activamos 2 jugadores humanos locales.
// Para subir a 3 o 4, cambiar este valor a 3/4.
export const ACTIVE_LOCAL_PLAYER_COUNT = 2;

export function getActivePlayerConfigs(): PlayerConfig[] {
  return (Object.values(PLAYER_CONFIGS) as PlayerConfig[])
    .filter((config) => config.slot <= ACTIVE_LOCAL_PLAYER_COUNT)
    .sort((a, b) => a.slot - b.slot);
}
