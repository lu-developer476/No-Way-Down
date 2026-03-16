import Phaser from 'phaser';
import configuredControls from '../../config/controls.json';

export type ControlAction =
  | 'move_left'
  | 'move_right'
  | 'move_down'
  | 'jump'
  | 'shoot'
  | 'reload'
  | 'interact'
  | 'next_level'
  | 'pause'
  | 'quit';

export type ControlsConfig = Record<ControlAction, string>;

const DEFAULT_CONTROLS: ControlsConfig = {
  move_left: 'ArrowLeft',
  move_right: 'ArrowRight',
  move_down: 'ArrowDown',
  jump: 'Space',
  shoot: 'KeyS',
  reload: 'KeyR',
  interact: 'KeyE',
  next_level: 'Enter',
  pause: 'KeyP',
  quit: 'Escape'
};

const KEY_CODE_BY_EVENT_CODE: Record<string, number> = {
  ArrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
  ArrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
  ArrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
  ArrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
  Space: Phaser.Input.Keyboard.KeyCodes.SPACE,
  Enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
  Escape: Phaser.Input.Keyboard.KeyCodes.ESC,
  KeyE: Phaser.Input.Keyboard.KeyCodes.E,
  KeyP: Phaser.Input.Keyboard.KeyCodes.P,
  KeyR: Phaser.Input.Keyboard.KeyCodes.R,
  KeyS: Phaser.Input.Keyboard.KeyCodes.S
};

const DISPLAY_LABEL_BY_EVENT_CODE: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Space: 'SPACE',
  Enter: 'ENTER',
  Escape: 'ESC',
  KeyE: 'E',
  KeyP: 'P',
  KeyR: 'R',
  KeyS: 'S'
};

const PHASER_EVENT_KEY_BY_EVENT_CODE: Record<string, string> = {
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  Space: 'SPACE',
  Enter: 'ENTER',
  Escape: 'ESC',
  KeyE: 'E',
  KeyP: 'P',
  KeyR: 'R',
  KeyS: 'S'
};

class ControlManager {
  private readonly controls: ControlsConfig;

  constructor(config: Partial<ControlsConfig>) {
    this.controls = {
      ...DEFAULT_CONTROLS,
      ...config
    };
  }

  getCode(action: ControlAction): string {
    return this.controls[action];
  }

  getKeyCode(action: ControlAction): number {
    const code = this.controls[action];
    return KEY_CODE_BY_EVENT_CODE[code] ?? KEY_CODE_BY_EVENT_CODE[DEFAULT_CONTROLS[action]];
  }

  getPhaserEventName(action: ControlAction): string {
    const code = this.controls[action];
    const eventKey = PHASER_EVENT_KEY_BY_EVENT_CODE[code] ?? PHASER_EVENT_KEY_BY_EVENT_CODE[DEFAULT_CONTROLS[action]];
    return `keydown-${eventKey}`;
  }

  getDisplayLabel(action: ControlAction): string {
    const code = this.controls[action];
    return DISPLAY_LABEL_BY_EVENT_CODE[code] ?? DISPLAY_LABEL_BY_EVENT_CODE[DEFAULT_CONTROLS[action]];
  }

  getMovementDisplayLabel(): string {
    return 'Flechas';
  }
}

export const controlManager = new ControlManager(configuredControls as Partial<ControlsConfig>);
