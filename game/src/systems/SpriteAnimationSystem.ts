import Phaser from 'phaser';

export type SpriteAnimationState = 'idle' | 'run' | 'shoot' | 'hurt';

export class SpriteAnimationSystem {
  private readonly scene: Phaser.Scene;
  private readonly defaultTintBySprite = new WeakMap<Phaser.GameObjects.Sprite, number>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  rememberDefaultTint(sprite: Phaser.GameObjects.Sprite, tint?: number): void {
    if (typeof tint === 'number') {
      this.defaultTintBySprite.set(sprite, tint);
    }
  }

  playState(sprite: Phaser.GameObjects.Sprite, characterVisualId: string, state: SpriteAnimationState, force = false): void {
    const key = `${characterVisualId}-${state}`;
    if (!force && sprite.anims.currentAnim?.key === key && sprite.anims.isPlaying) {
      return;
    }

    sprite.play(key, true);
  }

  playMovement(sprite: Phaser.GameObjects.Sprite, characterVisualId: string, moving: boolean): void {
    this.playState(sprite, characterVisualId, moving ? 'run' : 'idle');
  }

  playShootEffect(sprite: Phaser.GameObjects.Sprite, characterVisualId: string, direction: 1 | -1, muzzleOffset: { x: number; y: number }): void {
    this.playState(sprite, characterVisualId, 'shoot', true);

    const flashTexture = 'fx-muzzle-flash';
    const muzzleX = sprite.x + direction * muzzleOffset.x;
    const muzzleY = sprite.y + muzzleOffset.y;

    const flash = this.scene.add
      .image(muzzleX, muzzleY, flashTexture)
      .setDepth(sprite.depth + 0.6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(direction < 0 ? -1 : 1, 1)
      .setAlpha(0.9);

    const lightBloom = this.scene.add
      .circle(muzzleX, muzzleY, 20, 0xffc24b, 0.34)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(sprite.depth + 0.5);

    this.scene.tweens.add({
      targets: [flash, lightBloom],
      alpha: 0,
      scaleX: flash.scaleX * 1.4,
      scaleY: 1.3,
      duration: 80,
      ease: 'Quad.Out',
      onComplete: () => {
        flash.destroy();
        lightBloom.destroy();
      }
    });

    sprite.setTintFill(0xfef3c7);
    this.scene.time.delayedCall(70, () => {
      if (!sprite.active) {
        return;
      }

      const defaultTint = this.defaultTintBySprite.get(sprite);
      if (typeof defaultTint === 'number') {
        sprite.setTint(defaultTint);
      } else {
        sprite.clearTint();
      }
    });
  }

  playHurt(sprite: Phaser.GameObjects.Sprite, characterVisualId: string): void {
    this.playState(sprite, characterVisualId, 'hurt', true);
  }
}
