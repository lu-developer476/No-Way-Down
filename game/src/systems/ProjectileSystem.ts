import Phaser from 'phaser';
import { Projectile } from '../entities/Projectile';
import { CharacterWeaponKey } from '../config/characterRuntime';
import { getCharacterRuntimeConfig } from '../config/characterRuntime';
import { getWeaponCatalogEntry } from '../config/weaponCatalog';
import { applyLegacyWeaponOverrides, getWeaponRuntimeConfig, WeaponRuntimeConfig } from '../config/weaponRuntime';
import { getWeaponVisualRuntimeConfig } from '../config/weaponVisualRuntime';
import { getAudioManager } from '../audio/AudioManager';
import { getAccuracySpreadMultiplier } from '../config/attributeRuntime';

export interface FireConfig {
  originX: number;
  originY: number;
  direction: number;
  weapon?: CharacterWeaponKey;
  shooterId?: string;
  shooterCharacterId?: string;
  activeWeapon?: {
    key: CharacterWeaponKey;
    usesAmmo: boolean;
    ammoCurrent?: number;
  };
}

export class ProjectileSystem {
  private readonly scene: Phaser.Scene;
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private readonly nextFireTimeByShooter = new Map<string, number>();
  private readonly fireCooldownMultiplier: number;

  constructor(
    scene: Phaser.Scene,
    options: {
      fireCooldownMs?: number;
      projectileSpeed?: number;
      maxProjectiles?: number;
      fireCooldownMultiplier?: number;
    } = {}
  ) {
    this.scene = scene;
    this.fireCooldownMultiplier = Math.max(0.5, options.fireCooldownMultiplier ?? 1);

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
    if (!this.canFireByRuntime(config)) {
      return false;
    }

    const now = this.scene.time.now;
    const weaponRuntime = this.getWeaponRuntime(config.weapon, config.shooterCharacterId);
    const weaponVisual = getWeaponVisualRuntimeConfig(weaponRuntime.key);
    const shooterId = config.shooterId ?? 'shared';
    const nextFireTime = this.nextFireTimeByShooter.get(shooterId) ?? 0;

    if (now < nextFireTime) {
      return false;
    }

    const projectile = this.projectiles.get() as Projectile | null;
    if (!projectile) {
      return false;
    }

    const shotVelocity = this.getShotVelocity(config.direction, weaponRuntime.projectileSpeed, weaponRuntime.spread);

    projectile.launch(
      config.originX,
      config.originY,
      shotVelocity.x,
      shotVelocity.y,
      weaponRuntime.damage,
      weaponRuntime.maxRange,
      weaponRuntime.penetration,
      {
        weaponKey: weaponRuntime.key,
        shooterId,
        shooterCharacterId: config.shooterCharacterId ?? 'alan',
        projectileTexture: weaponVisual.projectileTexture,
        projectileTint: weaponVisual.projectileTint,
        projectileScale: weaponVisual.projectileScale
      }
    );

    this.nextFireTimeByShooter.set(shooterId, now + weaponRuntime.fireCooldownMs * this.fireCooldownMultiplier);
    getAudioManager(this.scene).play('shot', { x: config.originX, y: config.originY, volume: 0.24 });
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

  private getWeaponRuntime(weapon?: CharacterWeaponKey, shooterCharacterId?: string): WeaponRuntimeConfig {
    const attributes = shooterCharacterId ? getCharacterRuntimeConfig(shooterCharacterId).attributes : undefined;

    return getWeaponRuntimeConfig(weapon, {
      spreadMultiplier: attributes ? getAccuracySpreadMultiplier(attributes) : 1
    });
  }

  private canFireByRuntime(config: FireConfig): boolean {
    if (!config.weapon) {
      return false;
    }

    const catalogWeapon = getWeaponCatalogEntry(config.weapon);
    if (catalogWeapon.key !== config.weapon) {
      return false;
    }

    if (catalogWeapon.isMelee || catalogWeapon.isDefensive || !catalogWeapon.usesAmmo) {
      return false;
    }

    if (config.activeWeapon?.key && config.activeWeapon.key !== catalogWeapon.key) {
      return false;
    }

    if (config.activeWeapon?.usesAmmo === false) {
      return false;
    }

    if ((config.activeWeapon?.ammoCurrent ?? catalogWeapon.magazineSize) <= 0) {
      return false;
    }

    return true;
  }

  private getShotVelocity(direction: number, projectileSpeed: number, spread: number): { x: number; y: number } {
    const spreadOffset = Phaser.Math.FloatBetween(-spread, spread);
    const baseAngle = direction < 0 ? Math.PI : 0;
    const angle = baseAngle + spreadOffset;
    return {
      x: Math.cos(angle) * projectileSpeed,
      y: Math.sin(angle) * projectileSpeed
    };
  }
}
