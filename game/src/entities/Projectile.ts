import Phaser from 'phaser';

export class Projectile extends Phaser.Physics.Arcade.Image {
  private speed = 0;
  private direction = 1;
  private damage = 1;
  private weaponKey = 'pistol';
  private shooterId = 'shared';
  private shooterCharacterId = 'alan';
  private maxRange = 0;
  private remainingPenetration = 0;
  private spawnX = 0;
  private spawnY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'projectile-missing');

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
    velocityX: number,
    velocityY: number,
    damage: number,
    maxRange: number,
    penetration: number,
    metadata: {
      weaponKey: string;
      shooterId: string;
      shooterCharacterId: string;
      projectileTexture?: string;
      projectileTint?: number;
      projectileScale?: number;
    }
  ): void {
    this.speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    this.direction = velocityX >= 0 ? 1 : -1;
    this.damage = damage;
    this.weaponKey = metadata.weaponKey;
    this.shooterId = metadata.shooterId;
    this.shooterCharacterId = metadata.shooterCharacterId;
    this.maxRange = Math.max(0, maxRange);
    this.remainingPenetration = Math.max(0, penetration);
    this.spawnX = x;
    this.spawnY = y;

    this.enableBody(true, x, y, true, true);
    const textureKey = metadata.projectileTexture ?? 'projectile-missing';
    if (!this.scene.textures.exists(textureKey)) {
      console.error(`[Projectile] Missing projectile texture "${textureKey}" for weapon "${metadata.weaponKey}". Using explicit fallback.`);
      this.setTexture('projectile-missing');
    } else {
      this.setTexture(textureKey);
    }
    this.setScale(metadata.projectileScale ?? 1);
    this.setTint(metadata.projectileTint ?? 0xffffff);
    this.setFlipX(this.direction < 0);
    this.setVelocityX(velocityX);
    this.setVelocityY(velocityY);
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

  consumePenetrationOrDeactivate(): void {
    if (this.remainingPenetration > 0) {
      this.remainingPenetration -= 1;
      return;
    }

    this.deactivate();
  }

  reachedMaxRange(): boolean {
    if (this.maxRange <= 0) {
      return false;
    }

    return Phaser.Math.Distance.Between(this.spawnX, this.spawnY, this.x, this.y) >= this.maxRange;
  }
}
