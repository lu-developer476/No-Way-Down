import Phaser from 'phaser';
import { Bullet } from '../Bullet';
import { WeaponCatalogEntry, getWeaponCatalogEntry } from '../../config/weaponCatalog';

export type WeaponType = 'firearm' | 'melee' | 'utility';

export interface WeaponStats {
  damage: number;
  fireRate: number;
  bulletSpeed: number;
  spread: number;
}

export interface WeaponDefinition extends WeaponStats {
  key: string;
  type: WeaponType;
  maxRange: number;
}

interface DamageableObject extends Phaser.Types.Physics.Arcade.GameObjectWithBody {
  takeDamage?: (amount: number) => unknown;
  health?: number;
}

export interface WeaponShooter extends Phaser.Types.Physics.Arcade.GameObjectWithBody {
  x: number;
  y: number;
  weaponKey?: string;
  targetGroup?: Phaser.Types.Physics.Arcade.ArcadeColliderType;
}

export class WeaponSystem {
  private readonly bullets: Phaser.Physics.Arcade.Group;
  private readonly nextFireByShooter = new WeakMap<WeaponShooter, number>();

  constructor(private readonly scene: Phaser.Scene, maxBullets = 80) {
    this.bullets = scene.physics.add.group({
      classType: Bullet,
      maxSize: maxBullets,
      runChildUpdate: false
    });
  }

  getWeaponDefinition(weaponKey: string): WeaponDefinition {
    const catalog = getWeaponCatalogEntry(weaponKey);

    return {
      key: catalog.key,
      type: this.resolveWeaponType(catalog),
      damage: catalog.damage,
      fireRate: catalog.fireRateMs,
      bulletSpeed: catalog.bulletSpeed,
      spread: catalog.spread,
      maxRange: catalog.maxRange
    };
  }

  fire(scene: Phaser.Scene, shooter: WeaponShooter, direction: Phaser.Math.Vector2): Bullet | null {
    const weapon = this.getWeaponDefinition(shooter.weaponKey ?? 'pistol');
    const shooterBody = shooter.body as Phaser.Physics.Arcade.Body | undefined;
    if (!shooterBody) {
      return null;
    }

    const now = scene.time.now;
    const nextFireAt = this.nextFireByShooter.get(shooter) ?? 0;
    if (now < nextFireAt) {
      return null;
    }

    const bullet = this.bullets.get(shooter.x, shooter.y) as Bullet | null;
    if (!bullet) {
      return null;
    }

    const spreadAngle = Phaser.Math.FloatBetween(-weapon.spread, weapon.spread);
    const finalDirection = direction.clone();
    if (finalDirection.lengthSq() <= Number.EPSILON) {
      finalDirection.set(1, 0);
    }
    finalDirection.normalize().rotate(spreadAngle);

    const originX = shooter.x + finalDirection.x * 18;
    const originY = shooter.y + finalDirection.y * 18;

    bullet.launch(originX, originY, {
      direction: finalDirection,
      speed: weapon.bulletSpeed,
      damage: weapon.damage,
      shooter,
      maxDistance: weapon.maxRange
    });

    this.nextFireByShooter.set(shooter, now + weapon.fireRate);

    if (shooter.targetGroup) {
      scene.physics.add.overlap(
        bullet,
        shooter.targetGroup,
        (bulletGameObject, targetGameObject) => {
          const shot = bulletGameObject as Bullet;
          const target = targetGameObject as DamageableObject;

          if (target === shooter || target === shot.getShooter()) {
            return;
          }

          if (typeof target.takeDamage === 'function') {
            target.takeDamage(shot.getDamage());
          } else if (typeof target.health === 'number') {
            target.health = Math.max(0, target.health - shot.getDamage());
          }

          shot.deactivate();
        }
      );
    }

    return bullet;
  }

  update(): void {
    this.bullets.children.each((child) => {
      const bullet = child as Bullet;
      if (bullet.active && bullet.shouldDeactivate()) {
        bullet.deactivate();
      }

      return true;
    });
  }

  getBulletGroup(): Phaser.Physics.Arcade.Group {
    return this.bullets;
  }

  private resolveWeaponType(catalog: WeaponCatalogEntry): WeaponType {
    if (catalog.isDefensive) {
      return 'utility';
    }

    if (catalog.isMelee) {
      return 'melee';
    }

    return 'firearm';
  }

}
