import Phaser from 'phaser';
import { Zombie } from '../entities/Zombie';
import { Projectile } from '../entities/Projectile';
import { Player } from '../entities/Player';

export class ZombieSystem {
  private readonly scene: Phaser.Scene;
  private readonly zombies: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, maxZombies = 20) {
    this.scene = scene;

    this.zombies = this.scene.physics.add.group({
      classType: Zombie,
      maxSize: maxZombies,
      runChildUpdate: false
    });
  }

  spawn(x: number, y: number): Zombie | null {
    const zombie = this.zombies.get(x, y, 'zombie-base-0') as Zombie | null;
    if (!zombie) {
      return null;
    }

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

        projectile.deactivate();
        zombie.takeDamage(projectile.getDamage());
      }
    );
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
    this.zombies.children.each((child) => {
      const zombie = child as Zombie;
      if (zombie.active) {
        zombie.update(targetX);
      }

      return true;
    });
  }
}
