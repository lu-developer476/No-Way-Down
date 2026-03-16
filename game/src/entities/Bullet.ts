import Phaser from 'phaser';

export interface BulletLaunchConfig {
  direction: Phaser.Math.Vector2;
  speed: number;
  damage: number;
  shooter: Phaser.GameObjects.GameObject;
  maxDistance?: number;
}

export class Bullet extends Phaser.Physics.Arcade.Image {
  private damage = 0;
  private shooter: Phaser.GameObjects.GameObject | null = null;
  private startX = 0;
  private startY = 0;
  private maxDistance = Number.POSITIVE_INFINITY;

  constructor(scene: Phaser.Scene, x: number, y: number, texture = 'bullet-placeholder') {
    super(scene, x, y, texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.setActive(false);
    this.setVisible(false);
  }

  launch(x: number, y: number, config: BulletLaunchConfig): void {
    const direction = config.direction.clone();
    if (direction.lengthSq() <= Number.EPSILON) {
      direction.set(1, 0);
    } else {
      direction.normalize();
    }

    this.enableBody(true, x, y, true, true);
    this.setPosition(x, y);

    this.damage = Math.max(0, config.damage);
    this.shooter = config.shooter;
    this.startX = x;
    this.startY = y;
    this.maxDistance = config.maxDistance ?? Number.POSITIVE_INFINITY;

    this.setVelocity(direction.x * config.speed, direction.y * config.speed);
    this.setRotation(direction.angle());
  }

  getDamage(): number {
    return this.damage;
  }

  getShooter(): Phaser.GameObjects.GameObject | null {
    return this.shooter;
  }

  shouldDeactivate(): boolean {
    if (!Number.isFinite(this.maxDistance)) {
      return false;
    }

    return Phaser.Math.Distance.Between(this.startX, this.startY, this.x, this.y) >= this.maxDistance;
  }

  deactivate(): void {
    this.disableBody(true, true);
  }
}
