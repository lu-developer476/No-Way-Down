import Phaser from 'phaser';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { PlayerConfig } from '../config/localMultiplayer';

const MOVE_SPEED = 220;
const JUMP_SPEED = 420;
const DEFAULT_MAX_HEALTH = 100;
const DAMAGE_INVULNERABILITY_MS = 900;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly leftKey: Phaser.Input.Keyboard.Key;
  private readonly rightKey: Phaser.Input.Keyboard.Key;
  private readonly jumpKey: Phaser.Input.Keyboard.Key;
  private readonly shootKey: Phaser.Input.Keyboard.Key;
  private lookDirection: 1 | -1 = 1;
  private projectileSystem: ProjectileSystem;
  private healthPoints = DEFAULT_MAX_HEALTH;
  private invulnerableUntil = 0;
  private isDeadState = false;
  private readonly profile: PlayerConfig;

  constructor(scene: Phaser.Scene, x: number, y: number, projectileSystem: ProjectileSystem, profile: PlayerConfig) {
    super(scene, x, y, 'player-placeholder');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setSize(32, 48);

    this.projectileSystem = projectileSystem;
    this.profile = profile;
    this.setTint(profile.color);

    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available in this scene.');
    }

    this.leftKey = keyboard.addKey(profile.controls.left);
    this.rightKey = keyboard.addKey(profile.controls.right);
    this.jumpKey = keyboard.addKey(profile.controls.jump);
    this.shootKey = keyboard.addKey(profile.controls.shoot);
  }

  update(): void {
    if (this.isDeadState) {
      this.setVelocity(0, 0);
      return;
    }

    if (this.leftKey.isDown) {
      this.setVelocityX(-MOVE_SPEED);
      this.lookDirection = -1;
      this.setFlipX(true);
    } else if (this.rightKey.isDown) {
      this.setVelocityX(MOVE_SPEED);
      this.lookDirection = 1;
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    const body = this.body as Phaser.Physics.Arcade.Body | null;

    if (this.jumpKey.isDown && body?.blocked.down) {
      this.setVelocityY(-JUMP_SPEED);
    }

    if (Phaser.Input.Keyboard.JustDown(this.shootKey)) {
      this.projectileSystem.tryFire({
        originX: this.x + this.lookDirection * 24,
        originY: this.y - 6,
        direction: this.lookDirection
      });
    }
  }

  takeDamage(amount: number, currentTime: number): boolean {
    if (amount <= 0 || !this.active || this.isDeadState || !this.canTakeDamage(currentTime)) {
      return false;
    }

    this.healthPoints = Math.max(0, this.healthPoints - amount);
    this.invulnerableUntil = currentTime + DAMAGE_INVULNERABILITY_MS;
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
}
