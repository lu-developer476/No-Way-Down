import Phaser from 'phaser';
import { Projectile } from '../entities/Projectile';

export interface FireConfig {
  originX: number;
  originY: number;
  direction: number;
}

const DEFAULT_PROJECTILE_SPEED = 520;
const DEFAULT_FIRE_COOLDOWN_MS = 220;

export class ProjectileSystem {
  private readonly scene: Phaser.Scene;
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private readonly fireCooldownMs: number;
  private readonly projectileSpeed: number;
  private nextFireTime = 0;

  constructor(
    scene: Phaser.Scene,
    options: {
      fireCooldownMs?: number;
      projectileSpeed?: number;
      maxProjectiles?: number;
    } = {}
  ) {
    this.scene = scene;
    this.fireCooldownMs = options.fireCooldownMs ?? DEFAULT_FIRE_COOLDOWN_MS;
    this.projectileSpeed = options.projectileSpeed ?? DEFAULT_PROJECTILE_SPEED;

    this.projectiles = this.scene.physics.add.group({
      classType: Projectile,
      maxSize: options.maxProjectiles ?? 30,
      runChildUpdate: false
    });
  }

  tryFire(config: FireConfig): boolean {
    const now = this.scene.time.now;
    if (now < this.nextFireTime) {
      return false;
    }

    const projectile = this.projectiles.get() as Projectile | null;
    if (!projectile) {
      return false;
    }

    projectile.launch(config.originX, config.originY, config.direction, this.projectileSpeed);
    this.nextFireTime = now + this.fireCooldownMs;

    return true;
  }

  update(): void {
    const worldBounds = this.scene.physics.world.bounds;

    this.projectiles.children.each((child) => {
      const projectile = child as Projectile;
      if (projectile.active && projectile.isOutOfBounds(worldBounds)) {
        projectile.deactivate();
      }

      return true;
    });
  }
}
