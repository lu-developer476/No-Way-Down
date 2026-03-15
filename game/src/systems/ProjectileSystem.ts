import Phaser from 'phaser';
import { Projectile } from '../entities/Projectile';
import { CharacterWeaponKey } from '../config/characterRuntime';

export interface FireConfig {
  originX: number;
  originY: number;
  direction: number;
  weapon?: CharacterWeaponKey;
  shooterId?: string;
}

interface WeaponCombatProfile {
  fireCooldownMs: number;
  projectileSpeed: number;
  damage: number;
}

const DEFAULT_WEAPON_PROFILE: WeaponCombatProfile = {
  fireCooldownMs: 220,
  projectileSpeed: 520,
  damage: 1
};

const WEAPON_COMBAT_PROFILE_BY_KEY: Record<string, WeaponCombatProfile> = {
  pistol: {
    fireCooldownMs: 220,
    projectileSpeed: 520,
    damage: 1
  },
  revolver: {
    fireCooldownMs: 340,
    projectileSpeed: 560,
    damage: 2
  },
  smg: {
    fireCooldownMs: 140,
    projectileSpeed: 500,
    damage: 1
  },
  shotgun: {
    fireCooldownMs: 560,
    projectileSpeed: 460,
    damage: 3
  },
  carbine: {
    fireCooldownMs: 260,
    projectileSpeed: 620,
    damage: 2
  },
  sniper_rifle: {
    fireCooldownMs: 680,
    projectileSpeed: 720,
    damage: 4
  }
};

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

    if (options.fireCooldownMs || options.projectileSpeed) {
      WEAPON_COMBAT_PROFILE_BY_KEY.pistol = {
        fireCooldownMs: options.fireCooldownMs ?? WEAPON_COMBAT_PROFILE_BY_KEY.pistol.fireCooldownMs,
        projectileSpeed: options.projectileSpeed ?? WEAPON_COMBAT_PROFILE_BY_KEY.pistol.projectileSpeed,
        damage: WEAPON_COMBAT_PROFILE_BY_KEY.pistol.damage
      };
    }
  }

  tryFire(config: FireConfig): boolean {
    const now = this.scene.time.now;
    const weaponProfile = this.getWeaponProfile(config.weapon);
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
      weaponProfile.projectileSpeed,
      weaponProfile.damage
    );
    this.nextFireTimeByShooter.set(shooterId, now + weaponProfile.fireCooldownMs);

    return true;
  }


  getGroup(): Phaser.Physics.Arcade.Group {
    return this.projectiles;
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

  private getWeaponProfile(weapon?: string): WeaponCombatProfile {
    if (!weapon) {
      return DEFAULT_WEAPON_PROFILE;
    }

    return WEAPON_COMBAT_PROFILE_BY_KEY[weapon] ?? DEFAULT_WEAPON_PROFILE;
  }
}
