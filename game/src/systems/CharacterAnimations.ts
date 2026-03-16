import Phaser from 'phaser';

export type CharacterAnimationState = 'idle' | 'walk' | 'shoot' | 'reload' | 'death';

export interface CharacterAnimationFrameRange {
  state: CharacterAnimationState;
  keySuffix: string;
  start: number;
  end: number;
  frameRate: number;
  repeat: number;
  hideOnComplete?: boolean;
}

const DEFAULT_CHARACTER_NAMES = [
  'alan',
  'giovanna',
  'yamil',
  'hernan',
  'lorena',
  'celestino',
  'selene',
  'nahir',
  'damian'
] as const;

const CHARACTER_SPRITESHEET_CONFIG = {
  frameWidth: 64,
  frameHeight: 64
} as const;

const DEFAULT_ANIMATION_RANGES: CharacterAnimationFrameRange[] = [
  { state: 'idle', keySuffix: 'idle', start: 0, end: 3, frameRate: 6, repeat: -1 },
  { state: 'walk', keySuffix: 'walk', start: 4, end: 11, frameRate: 12, repeat: -1 },
  { state: 'shoot', keySuffix: 'shoot', start: 12, end: 15, frameRate: 14, repeat: 0 },
  { state: 'reload', keySuffix: 'reload', start: 16, end: 21, frameRate: 10, repeat: 0 },
  { state: 'death', keySuffix: 'die', start: 22, end: 29, frameRate: 8, repeat: 0, hideOnComplete: true }
];

function buildAnimationKey(characterName: string, suffix: string): string {
  return `${characterName}_${suffix}`;
}

function createCharacterAnimation(
  scene: Phaser.Scene,
  characterName: string,
  range: CharacterAnimationFrameRange
): void {
  const key = buildAnimationKey(characterName, range.keySuffix);

  if (scene.anims.exists(key)) {
    return;
  }

  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(characterName, {
      start: range.start,
      end: range.end
    }),
    frameRate: range.frameRate,
    repeat: range.repeat,
    hideOnComplete: range.hideOnComplete
  });
}

export class CharacterAnimations {
  static preload(
    scene: Phaser.Scene,
    characterNames: readonly string[] = DEFAULT_CHARACTER_NAMES
  ): void {
    characterNames.forEach((characterName) => {
      if (scene.textures.exists(characterName)) {
        return;
      }

      scene.load.spritesheet(
        characterName,
        `assets/characters/${characterName}.png`,
        CHARACTER_SPRITESHEET_CONFIG
      );
    });
  }

  static create(
    scene: Phaser.Scene,
    characterNames: readonly string[] = DEFAULT_CHARACTER_NAMES,
    ranges: readonly CharacterAnimationFrameRange[] = DEFAULT_ANIMATION_RANGES
  ): void {
    characterNames.forEach((characterName) => {
      ranges.forEach((range) => {
        createCharacterAnimation(scene, characterName, range);
      });
    });
  }
}
