import Phaser from 'phaser';
import { getAudioManager } from '../audio/AudioManager';

const DEFAULT_ZOMBIE_SPEED = 80;
const DEFAULT_DETECTION_RANGE = 260;
export const DEFAULT_ZOMBIE_HEALTH = 3;

export class Zombie extends Phaser.Physics.Arcade.Sprite {
  private healthPoints: number;
  private readonly moveSpeed: number;
  private readonly detectionRange: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: {
      health?: number;
      moveSpeed?: number;
      detectionRange?: number;
    } = {}
  ) {
    super(scene, x, y, 'zombie-walker-base-0');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.healthPoints = options.health ?? DEFAULT_ZOMBIE_HEALTH;
    this.moveSpeed = options.moveSpeed ?? DEFAULT_ZOMBIE_SPEED;
    this.detectionRange = options.detectionRange ?? DEFAULT_DETECTION_RANGE;

    this.setCollideWorldBounds(true);
    this.setSize(18, 40);
    this.setOffset(7, 8);

    this.play('zombie-walker-idle', true);
  }

  update(targetX: number): void {
    if (!this.active) {
      return;
    }

    const distanceX = targetX - this.x;

    if (Math.abs(distanceX) > this.detectionRange) {
      this.setVelocityX(0);
      this.play('zombie-walker-idle', true);
      return;
    }

    const direction = Math.sign(distanceX);
    this.setVelocityX(direction * this.moveSpeed);
    this.play('zombie-walker-run', true);

    if (direction < 0) {
      this.setFlipX(true);
    } else if (direction > 0) {
      this.setFlipX(false);
    }
  }

  takeDamage(amount: number): void {
    if (!this.active) {
      return;
    }

    this.healthPoints -= amount;
    this.play('zombie-walker-hurt', true);

    if (this.healthPoints <= 0) {
      this.die();
    }
  }

  resetStats(options: { health?: number } = {}): void {
    this.healthPoints = options.health ?? DEFAULT_ZOMBIE_HEALTH;
  }

  getHealth(): number {
    return this.healthPoints;
  }

  private die(): void {
    this.setVelocity(0, 0);
    getAudioManager(this.scene).play('zombieDeath');
    this.disableBody(true, true);
  }
}
