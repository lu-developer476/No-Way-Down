import Phaser from 'phaser';
import type { ZombieSystem } from '../systems/ZombieSystem';

export type ZombieSpawnPoint = {
  x: number;
  y: number;
};

type Target = Pick<Phaser.GameObjects.GameObject, 'active'> & { x: number; y: number };

export class ZombieSpawner {
  private readonly scene: Phaser.Scene;
  private readonly zombieSystem: ZombieSystem;
  private readonly spawnPoints: readonly ZombieSpawnPoint[];
  private readonly spawnIntervalMs: number;
  private readonly maxActiveZombies: number;

  private nextSpawnAt = 0;

  constructor(
    scene: Phaser.Scene,
    zombieSystem: ZombieSystem,
    spawnPoints: readonly ZombieSpawnPoint[],
    options: {
      spawnIntervalMs?: number;
      maxActiveZombies?: number;
      startDelayMs?: number;
    } = {}
  ) {
    this.scene = scene;
    this.zombieSystem = zombieSystem;
    this.spawnPoints = spawnPoints;
    this.spawnIntervalMs = options.spawnIntervalMs ?? 2000;
    this.maxActiveZombies = options.maxActiveZombies ?? 25;
    this.nextSpawnAt = this.scene.time.now + (options.startDelayMs ?? 0);
  }

  update(survivors: readonly Target[]): void {
    this.trySpawn();
    const zombies = this.zombieSystem.getActiveZombies();
    zombies.forEach((zombie) => zombie.update(survivors));
  }

  forceSpawn(count = 1): void {
    for (let i = 0; i < count; i += 1) {
      this.spawnOne();
    }
  }

  private trySpawn(): void {
    if (this.scene.time.now < this.nextSpawnAt) {
      return;
    }

    this.nextSpawnAt = this.scene.time.now + this.spawnIntervalMs;
    this.spawnOne();
  }

  private spawnOne(): void {
    if (this.zombieSystem.getActiveCount() >= this.maxActiveZombies || this.spawnPoints.length === 0) {
      return;
    }

    const point = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
    this.zombieSystem.spawn(point.x, point.y);
  }
}
