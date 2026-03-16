import Phaser from 'phaser';
import { DEFAULT_ZOMBIE_HEALTH, Zombie } from '../entities/Zombie';
import { Projectile } from '../entities/Projectile';
import { Player } from '../entities/Player';
import { getWeaponRuntimeConfig } from '../config/weaponRuntime';
import { getAudioManager } from '../audio/AudioManager';

const CHARACTER_HEADSHOT_BONUS_BY_ID: Record<string, number> = {
  alan: 0,
  giovanna: 0.04,
  yamil: 0.02,
  hernan: -0.01,
  lorena: 0.01,
  celestino: -0.02,
  selene: 0.05,
  nahir: 0.03,
  damian: -0.01
};

export class ZombieSystem {
  private readonly scene: Phaser.Scene;
  private readonly zombies: Phaser.Physics.Arcade.Group;
  private readonly defaultZombieHealth: number;

  private nextZombieGroanAt = 0;

  constructor(scene: Phaser.Scene, maxZombies = 20, options: { defaultZombieHealth?: number } = {}) {
    this.scene = scene;
    this.defaultZombieHealth = options.defaultZombieHealth ?? DEFAULT_ZOMBIE_HEALTH;

    this.zombies = this.scene.physics.add.group({
      classType: Zombie,
      maxSize: maxZombies,
      runChildUpdate: false
    });
  }

  spawn(x: number, y: number, options: { health?: number } = {}): Zombie | null {
    const zombie = this.zombies.get(x, y, 'zombie-base-0') as Zombie | null;
    if (!zombie) {
      return null;
    }

    zombie.resetStats({ health: options.health ?? this.defaultZombieHealth });
    zombie.enableBody(true, x, y, true, true);
    zombie.setActive(true);
    zombie.setVisible(true);

    return zombie;
  }

  createColliders(ground: Phaser.Physics.Arcade.StaticGroup, player: Player): void {
    this.scene.physics.add.collider(this.zombies, ground);
    this.scene.physics.add.collider(this.zombies, player);
  }

  createProjectileOverlap(projectiles: Phaser.Physics.Arcade.Group): void {
    this.scene.physics.add.overlap(
      projectiles,
      this.zombies,
      (projectileGameObject, zombieGameObject) => {
        const projectile = projectileGameObject as Projectile;
        const zombie = zombieGameObject as Zombie;

        if (!projectile.active || !zombie.active) {
          return;
        }

        const zombieHealthBeforeImpact = zombie.getHealth();
        const weaponRuntime = getWeaponRuntimeConfig(projectile.getWeaponKey());
        const isHeadshot = this.rollHeadshot(projectile, weaponRuntime);
        const damage = isHeadshot
          ? weaponRuntime.zombieHeadshotInstantKill
            ? zombieHealthBeforeImpact
            : Math.max(projectile.getDamage(), Math.round(projectile.getDamage() * weaponRuntime.zombieHeadshotDamageMultiplier))
          : projectile.getDamage();

        projectile.consumePenetrationOrDeactivate();
        zombie.takeDamage(damage);

        console.debug(
          `[ZombieSystem] impact shooter=${projectile.getShooterId()} char=${projectile.getShooterCharacterId()} weapon=${projectile.getWeaponKey()} headshot=${isHeadshot} damage=${damage} hpBefore=${zombieHealthBeforeImpact} hpAfter=${Math.max(0, zombie.getHealth())}`
        );
      }
    );
  }

  private rollHeadshot(projectile: Projectile, weaponRuntime: ReturnType<typeof getWeaponRuntimeConfig>): boolean {
    const shooterBonus = CHARACTER_HEADSHOT_BONUS_BY_ID[projectile.getShooterCharacterId()] ?? 0;
    const weaponPrecisionBonus = Phaser.Math.Clamp(
      (weaponRuntime.projectileSpeed - weaponRuntime.zombieHeadshotSpeedBonusReference) /
        weaponRuntime.zombieHeadshotSpeedBonusScale,
      weaponRuntime.zombieHeadshotSpeedBonusMin,
      weaponRuntime.zombieHeadshotSpeedBonusMax
    );
    const chance = Phaser.Math.Clamp(
      weaponRuntime.zombieHeadshotChance + shooterBonus + weaponPrecisionBonus,
      weaponRuntime.zombieHeadshotChanceMin,
      weaponRuntime.zombieHeadshotChanceMax
    );
    return Math.random() <= chance;
  }

  getGroup(): Phaser.Physics.Arcade.Group {
    return this.zombies;
  }

  getActiveZombies(): Zombie[] {
    const activeZombies: Zombie[] = [];

    this.zombies.children.each((child) => {
      const zombie = child as Zombie;
      if (zombie.active) {
        activeZombies.push(zombie);
      }

      return true;
    });

    return activeZombies;
  }

  getActiveCount(): number {
    let activeZombies = 0;

    this.zombies.children.each((child) => {
      const zombie = child as Zombie;
      if (zombie.active) {
        activeZombies += 1;
      }

      return true;
    });

    return activeZombies;
  }

  update(targetX: number): void {
    const activeZombies = this.getActiveZombies();
    activeZombies.forEach((zombie) => {
      zombie.update(targetX);
    });

    const groanSource = activeZombies[0];
    if (groanSource && this.scene.time.now >= this.nextZombieGroanAt) {
      getAudioManager(this.scene).play('zombieGroan', { x: groanSource.x, y: groanSource.y, volume: 0.15 });
      this.nextZombieGroanAt = this.scene.time.now + Phaser.Math.Between(2000, 5000);
    }
  }
}
