import Phaser from 'phaser';

export class Projectile extends Phaser.Physics.Arcade.Image {
  private speed = 0;
  private direction = 1;
  private damage = 1;
  private weaponKey = 'pistol';
  private shooterId = 'shared';
  private shooterCharacterId = 'alan';
  private maxRange = 0;
  private spawnX = 0;
  private spawnY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet-placeholder');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
  }

  launch(
    x: number,
    y: number,
    direction: number,
    speed: number,
    damage: number,
    maxRange: number,
    metadata: {
      weaponKey: string;
      shooterId: string;
      shooterCharacterId: string;
    }
  ): void {
    this.speed = speed;
    this.direction = direction;
    this.damage = damage;
    this.weaponKey = metadata.weaponKey;
    this.shooterId = metadata.shooterId;
    this.shooterCharacterId = metadata.shooterCharacterId;
    this.maxRange = Math.max(0, maxRange);
    this.spawnX = x;
    this.spawnY = y;

    this.enableBody(true, x, y, true, true);
    this.setVelocityX(this.direction * this.speed);
    this.setVelocityY(0);
  }

  getDamage(): number {
    return this.damage;
  }

  getWeaponKey(): string {
    return this.weaponKey;
  }

  getShooterId(): string {
    return this.shooterId;
  }

  getShooterCharacterId(): string {
    return this.shooterCharacterId;
  }

  deactivate(): void {
    this.disableBody(true, true);
  }

  reachedMaxRange(): boolean {
    if (this.maxRange <= 0) {
      return false;
    }

    return Phaser.Math.Distance.Between(this.spawnX, this.spawnY, this.x, this.y) >= this.maxRange;
  }
}
