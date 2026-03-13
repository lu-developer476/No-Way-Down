import Phaser from 'phaser';

const DEFAULT_ZOMBIE_SPEED = 80;
const DEFAULT_DETECTION_RANGE = 260;
const DEFAULT_HEALTH = 3;

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
    super(scene, x, y, 'zombie-placeholder');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.healthPoints = options.health ?? DEFAULT_HEALTH;
    this.moveSpeed = options.moveSpeed ?? DEFAULT_ZOMBIE_SPEED;
    this.detectionRange = options.detectionRange ?? DEFAULT_DETECTION_RANGE;

    this.setCollideWorldBounds(true);
    this.setSize(32, 48);
  }

  update(targetX: number): void {
    if (!this.active) {
      return;
    }

    const distanceX = targetX - this.x;

    if (Math.abs(distanceX) > this.detectionRange) {
      this.setVelocityX(0);
      return;
    }

    const direction = Math.sign(distanceX);
    this.setVelocityX(direction * this.moveSpeed);

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

    if (this.healthPoints <= 0) {
      this.die();
    }
  }

  private die(): void {
    this.setVelocity(0, 0);
    this.disableBody(true, true);
  }
}
