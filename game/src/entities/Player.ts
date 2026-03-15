import Phaser from 'phaser';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { PlayerConfig } from '../config/localMultiplayer';
import { StairAnimationKeys } from '../systems/StairSystem';
import { getCharacterVisualById } from '../config/characterVisuals';
import { getAudioManager } from '../audio/AudioManager';

const MOVE_SPEED = 220;
const JUMP_SPEED = 420;
const DEFAULT_MAX_HEALTH = 100;
const DAMAGE_INVULNERABILITY_MS = 900;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly leftKey: Phaser.Input.Keyboard.Key;
  private readonly rightKey: Phaser.Input.Keyboard.Key;
  private readonly jumpKey: Phaser.Input.Keyboard.Key;
  private readonly downKey: Phaser.Input.Keyboard.Key;
  private readonly shootKey: Phaser.Input.Keyboard.Key;
  private lookDirection: 1 | -1 = 1;
  private projectileSystem: ProjectileSystem;
  private healthPoints = DEFAULT_MAX_HEALTH;
  private invulnerableUntil = 0;
  private isDeadState = false;
  private readonly profile: PlayerConfig;
  private readonly characterVisualId: string;
  private readonly nameTag: Phaser.GameObjects.Text;
  private isClimbing = false;
  private climbAnimations: StairAnimationKeys = {};

  constructor(scene: Phaser.Scene, x: number, y: number, projectileSystem: ProjectileSystem, profile: PlayerConfig) {
    const characterVisual = getCharacterVisualById(profile.characterId);
    super(scene, x, y, `${characterVisual.id}-base-0`);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setSize(18, 40);
    this.setOffset(7, 8);

    this.projectileSystem = projectileSystem;
    this.profile = profile;
    this.characterVisualId = characterVisual.id;
    this.setTint(profile.color);

    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available in this scene.');
    }

    this.leftKey = keyboard.addKey(profile.controls.left);
    this.rightKey = keyboard.addKey(profile.controls.right);
    this.jumpKey = keyboard.addKey(profile.controls.jump);
    this.downKey = keyboard.addKey(profile.controls.down);
    this.shootKey = keyboard.addKey(profile.controls.shoot);

    this.play(`${this.characterVisualId}-idle`, true);

    this.nameTag = scene.add.text(this.x, this.y - 42, profile.name, {
      fontSize: '10px',
      color: '#f8fafc',
      stroke: '#0f172a',
      strokeThickness: 3,
      fontStyle: 'bold'
    });
    this.nameTag.setOrigin(0.5, 1);
    this.nameTag.setDepth(30);
  }

  update(): void {
    if (this.isDeadState) {
      this.setVelocity(0, 0);
      return;
    }

    let isMovingHorizontally = false;

    if (this.isClimbing) {
      this.setVelocityX(0);
    } else if (this.leftKey.isDown) {
      this.setVelocityX(-MOVE_SPEED);
      this.lookDirection = -1;
      this.setFlipX(true);
      isMovingHorizontally = true;
    } else if (this.rightKey.isDown) {
      this.setVelocityX(MOVE_SPEED);
      this.lookDirection = 1;
      this.setFlipX(false);
      isMovingHorizontally = true;
    } else {
      this.setVelocityX(0);
    }

    const body = this.body as Phaser.Physics.Arcade.Body | null;

    if (!this.isClimbing && this.jumpKey.isDown && body?.blocked.down) {
      this.setVelocityY(-JUMP_SPEED);
    }

    if (Phaser.Input.Keyboard.JustDown(this.shootKey)) {
      this.play(`${this.characterVisualId}-shoot`, true);
      const hasFired = this.projectileSystem.tryFire({
        originX: this.x + this.lookDirection * 24,
        originY: this.y - 6,
        direction: this.lookDirection
      });

      if (hasFired) {
        getAudioManager(this.scene).play('shot');
      }
    }

    if (!this.isClimbing && (!this.anims.isPlaying || this.anims.currentAnim?.key === `${this.characterVisualId}-idle` || this.anims.currentAnim?.key === `${this.characterVisualId}-run`)) {
      this.play(isMovingHorizontally ? `${this.characterVisualId}-run` : `${this.characterVisualId}-idle`, true);
    }

    this.updateNameTagPosition();
  }


  isClimbUpPressed(): boolean {
    return this.jumpKey.isDown;
  }

  isClimbDownPressed(): boolean {
    return this.downKey.isDown;
  }

  isClimbRequestActive(): boolean {
    return this.isClimbUpPressed() || this.isClimbDownPressed();
  }

  setClimbingState(isClimbing: boolean, animations?: StairAnimationKeys): void {
    this.isClimbing = isClimbing;
    if (animations) {
      this.climbAnimations = animations;
    }

    if (!isClimbing) {
      this.play(this.climbAnimations.idle ?? `${this.characterVisualId}-idle`, true);
    }
  }

  playClimbAnimation(): void {
    this.play(this.climbAnimations.climb ?? `${this.characterVisualId}-run`, true);
  }

  playClimbIdleAnimation(): void {
    this.play(this.climbAnimations.idle ?? `${this.characterVisualId}-idle`, true);
  }

  takeDamage(amount: number, currentTime: number): boolean {
    if (amount <= 0 || !this.active || this.isDeadState || !this.canTakeDamage(currentTime)) {
      return false;
    }

    this.healthPoints = Math.max(0, this.healthPoints - amount);
    this.invulnerableUntil = currentTime + DAMAGE_INVULNERABILITY_MS;
    this.play(`${this.characterVisualId}-hurt`, true);
    getAudioManager(this.scene).play('playerDamage');
    this.setTintFill(0xf87171);
    this.scene.time.delayedCall(120, () => {
      if (this.active) {
        this.clearTint();
        this.setTint(this.profile.color);
      }
    });

    if (this.healthPoints <= 0) {
      this.isDeadState = true;
      this.setVelocity(0, 0);
    }

    return true;
  }

  canTakeDamage(currentTime: number): boolean {
    return currentTime >= this.invulnerableUntil;
  }

  isDead(): boolean {
    return this.isDeadState;
  }

  getHealth(): number {
    return this.healthPoints;
  }

  getProfile(): PlayerConfig {
    return this.profile;
  }

  destroy(fromScene?: boolean): void {
    this.nameTag.destroy();
    super.destroy(fromScene);
  }

  private updateNameTagPosition(): void {
    this.nameTag.setPosition(this.x, this.y - 42);
    this.nameTag.setVisible(this.active);
  }
}
