import Phaser from 'phaser';
import { Projectile } from '../entities/Projectile';
import { CharacterWeaponKey } from '../config/characterRuntime';
import { applyLegacyWeaponOverrides, getWeaponRuntimeConfig, WeaponRuntimeConfig } from '../config/weaponRuntime';

export interface FireConfig {
  originX: number;
  originY: number;
  direction: number;
  weapon?: CharacterWeaponKey;
  shooterId?: string;
  shooterCharacterId?: string;
}

export class ProjectileSystem {
  private readonly scene: Phaser.Scene;
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private readonly nextFireTimeByShooter = new Map<string, number>();

  constructor(
    scene: Phaser.Scene,
    options: {
      fireCooldownMs?: number;
      projectileSpeed?: number;
      maxProjectiles?: number;
    } = {}
  ) {
    this.scene = scene;

    this.projectiles = this.scene.physics.add.group({
      classType: Projectile,
      maxSize: options.maxProjectiles ?? 30,
      runChildUpdate: false
    });

    applyLegacyWeaponOverrides({
      fireCooldownMs: options.fireCooldownMs,
      projectileSpeed: options.projectileSpeed
    });
  }

  tryFire(config: FireConfig): boolean {
    const now = this.scene.time.now;
    const weaponRuntime = this.getWeaponRuntime(config.weapon);
    const shooterId = config.shooterId ?? 'shared';
    const nextFireTime = this.nextFireTimeByShooter.get(shooterId) ?? 0;

    if (now < nextFireTime) {
      return false;
    }

    const projectile = this.projectiles.get() as Projectile | null;
    if (!projectile) {
      return false;
    }

    projectile.launch(
      config.originX,
      config.originY,
      config.direction,
      weaponRuntime.projectileSpeed,
      weaponRuntime.damage,
      weaponRuntime.maxRange,
      {
        weaponKey: weaponRuntime.key,
        shooterId,
        shooterCharacterId: config.shooterCharacterId ?? 'alan'
      }
    );

    this.nextFireTimeByShooter.set(shooterId, now + weaponRuntime.fireCooldownMs);
    return true;
  }

  createSolidCollider(solidBodies: Phaser.Types.Physics.Arcade.ArcadeColliderType): void {
    this.scene.physics.add.collider(this.projectiles, solidBodies, (projectileGameObject) => {
      const projectile = projectileGameObject as Projectile;
      projectile.deactivate();
    });
  }

  getGroup(): Phaser.Physics.Arcade.Group {
    return this.projectiles;
  }

  update(): void {
    this.projectiles.children.each((child) => {
      const projectile = child as Projectile;
      if (projectile.active && projectile.reachedMaxRange()) {
        projectile.deactivate();
      }

      return true;
    });
  }

  private getWeaponRuntime(weapon?: CharacterWeaponKey): WeaponRuntimeConfig {
    return getWeaponRuntimeConfig(weapon);
  }
}
