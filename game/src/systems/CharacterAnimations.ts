import Phaser from 'phaser';

export type CharacterAnimationState = 'idle' | 'run' | 'shoot' | 'hurt';

export interface CharacterAnimationFrameRange {
  state: CharacterAnimationState;
  start: number;
  end: number;
  frameRate: number;
  repeat: number;
  hideOnComplete?: boolean;
}

export const DEFAULT_CHARACTER_VISUAL_IDS = [
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

const CHARACTER_SPRITESHEET_SUFFIX = '-sheet';

const DEFAULT_ANIMATION_RANGES: CharacterAnimationFrameRange[] = [
  { state: 'idle', start: 0, end: 1, frameRate: 4, repeat: -1 },
  { state: 'run', start: 2, end: 5, frameRate: 9, repeat: -1 },
  { state: 'shoot', start: 6, end: 6, frameRate: 1, repeat: 0 },
  { state: 'hurt', start: 7, end: 7, frameRate: 1, repeat: 0 }
];

function buildAnimationKey(characterVisualId: string, state: CharacterAnimationState): string {
  return `${characterVisualId}-${state}`;
}

function createCharacterAnimation(
  scene: Phaser.Scene,
  characterVisualId: string,
  range: CharacterAnimationFrameRange
): void {
  const key = buildAnimationKey(characterVisualId, range.state);

  if (scene.anims.exists(key)) {
    return;
  }

  const textureKey = `${characterVisualId}${CHARACTER_SPRITESHEET_SUFFIX}`;
  if (!scene.textures.exists(textureKey)) {
    return;
  }

  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(textureKey, {
      start: range.start,
      end: range.end
    }),
    frameRate: range.frameRate,
    repeat: range.repeat,
    hideOnComplete: range.hideOnComplete
  });
}

export class CharacterAnimations {
  static create(
    scene: Phaser.Scene,
    characterVisualIds: readonly string[] = DEFAULT_CHARACTER_VISUAL_IDS,
    ranges: readonly CharacterAnimationFrameRange[] = DEFAULT_ANIMATION_RANGES
  ): void {
    characterVisualIds.forEach((characterVisualId) => {
      ranges.forEach((range) => {
        createCharacterAnimation(scene, characterVisualId, range);
      });
    });
  }
}
