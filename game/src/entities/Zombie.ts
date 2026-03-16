import Phaser from 'phaser';
import { getAudioManager } from '../audio/AudioManager';
import { SpriteAnimationSystem } from '../systems/SpriteAnimationSystem';

const DEFAULT_ZOMBIE_SPEED = 80;
const DEFAULT_DETECTION_RANGE = 260;
export const DEFAULT_ZOMBIE_HEALTH = 3;

export class Zombie extends Phaser.Physics.Arcade.Sprite {
  private healthPoints: number;
  private readonly moveSpeed: number;
  private readonly detectionRange: number;
  private readonly spriteAnimationSystem: SpriteAnimationSystem;

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
    super(scene, x, y, 'zombie-walker-sheet', 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.healthPoints = options.health ?? DEFAULT_ZOMBIE_HEALTH;
    this.moveSpeed = options.moveSpeed ?? DEFAULT_ZOMBIE_SPEED;
    this.detectionRange = options.detectionRange ?? DEFAULT_DETECTION_RANGE;
    this.spriteAnimationSystem = new SpriteAnimationSystem(scene);

    this.setCollideWorldBounds(true);
    this.setSize(18, 40);
    this.setOffset(7, 8);

    this.spriteAnimationSystem.playState(this, 'zombie-walker', 'idle');
  }

  update(targetX: number): void {
    if (!this.active) {
      return;
    }

    const distanceX = targetX - this.x;

    if (Math.abs(distanceX) > this.detectionRange) {
      this.setVelocityX(0);
      this.spriteAnimationSystem.playMovement(this, 'zombie-walker', false);
      return;
    }

    const direction = Math.sign(distanceX);
    this.setVelocityX(direction * this.moveSpeed);
    this.spriteAnimationSystem.playMovement(this, 'zombie-walker', true);

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
    this.spriteAnimationSystem.playHurt(this, 'zombie-walker');

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
    getAudioManager(this.scene).play('zombieDeath', { x: this.x, y: this.y, volume: 0.25 });
    this.disableBody(true, true);
  }
}
