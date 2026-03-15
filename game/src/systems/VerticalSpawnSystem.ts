import Phaser from 'phaser';
import { Zombie } from '../entities/Zombie';
import { Player } from '../entities/Player';
import { ZombieSystem } from './ZombieSystem';
import { scaleSpawnCooldownMs, scaleSpawnCount } from '../config/difficultyRuntime';

export type VerticalSpawnDirection = 'stairs_up' | 'stairs_down' | 'door_left' | 'door_right';

export interface VerticalSpawnPointConfig {
  id: string;
  position: {
    x: number;
    y: number;
  };
  directions: VerticalSpawnDirection[];
  cooldownMs: number;
  maxActive: number;
  minPlayerDistance?: number;
  maxPlayerDistance?: number;
}

export interface VerticalSpawnJsonConfig {
  verticalZombieSpawns: {
    minPlayerDistance?: number;
    maxPlayerDistance?: number;
    points: Array<{
      id: string;
      position: {
        x: number;
        y: number;
      };
      directions: string[];
      cooldownMs: number;
      maxActive: number;
      minPlayerDistance?: number;
      maxPlayerDistance?: number;
    }>;
  };
}

interface VerticalSpawnRuntime {
  config: VerticalSpawnPointConfig;
  nextSpawnAt: number;
  activeZombies: Set<Zombie>;
  enabled: boolean;
}

const DEFAULT_MIN_PLAYER_DISTANCE = 220;
const DEFAULT_MAX_PLAYER_DISTANCE = 1350;

const ALLOWED_DIRECTIONS: ReadonlySet<VerticalSpawnDirection> = new Set([
  'stairs_up',
  'stairs_down',
  'door_left',
  'door_right'
]);

function sanitizeDirections(directions: string[]): VerticalSpawnDirection[] {
  const validDirections = directions.filter((direction): direction is VerticalSpawnDirection =>
    ALLOWED_DIRECTIONS.has(direction as VerticalSpawnDirection)
  );

  return validDirections.length > 0 ? validDirections : ['door_left'];
}

export class VerticalSpawnSystem {
  private readonly scene: Phaser.Scene;
  private readonly zombieSystem: ZombieSystem;
  private readonly players: Player[];
  private readonly runtimes: VerticalSpawnRuntime[];
  private readonly defaultMinPlayerDistance: number;
  private readonly defaultMaxPlayerDistance: number;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    zombieSystem: ZombieSystem,
    players: Player[],
    points: VerticalSpawnPointConfig[],
    options?: { defaultMinPlayerDistance?: number; defaultMaxPlayerDistance?: number }
  ) {
    this.scene = scene;
    this.zombieSystem = zombieSystem;
    this.players = players;
    this.defaultMinPlayerDistance = options?.defaultMinPlayerDistance ?? DEFAULT_MIN_PLAYER_DISTANCE;
    this.defaultMaxPlayerDistance = options?.defaultMaxPlayerDistance ?? DEFAULT_MAX_PLAYER_DISTANCE;
    this.runtimes = points.map((config) => ({
      config,
      nextSpawnAt: 0,
      activeZombies: new Set<Zombie>(),
      enabled: true
    }));
  }

  static fromJson(
    scene: Phaser.Scene,
    zombieSystem: ZombieSystem,
    players: Player[],
    jsonConfig: VerticalSpawnJsonConfig,
    options?: {
      defaultMinPlayerDistance?: number;
      defaultMaxPlayerDistance?: number;
      spawnPressureMultiplier?: number;
    }
  ): VerticalSpawnSystem {
    const spawnPressureMultiplier = options?.spawnPressureMultiplier ?? 1;
    const sanitizedPoints: VerticalSpawnPointConfig[] = jsonConfig.verticalZombieSpawns.points.map((point) => ({
      id: point.id,
      position: point.position,
      directions: sanitizeDirections(point.directions),
      cooldownMs: scaleSpawnCooldownMs(point.cooldownMs, spawnPressureMultiplier),
      maxActive: scaleSpawnCount(point.maxActive, spawnPressureMultiplier),
      minPlayerDistance: point.minPlayerDistance,
      maxPlayerDistance: point.maxPlayerDistance
    }));

    return new VerticalSpawnSystem(scene, zombieSystem, players, sanitizedPoints, {
      defaultMinPlayerDistance: jsonConfig.verticalZombieSpawns.minPlayerDistance ?? options?.defaultMinPlayerDistance,
      defaultMaxPlayerDistance: jsonConfig.verticalZombieSpawns.maxPlayerDistance ?? options?.defaultMaxPlayerDistance
    });
  }

  update(currentTime: number): void {
    if (!this.enabled) {
      return;
    }

    this.runtimes.forEach((runtime) => {
      this.cleanupInactive(runtime);
      if (!runtime.enabled) {
        return;
      }

      if (runtime.activeZombies.size >= runtime.config.maxActive) {
        return;
      }

      if (currentTime < runtime.nextSpawnAt) {
        return;
      }

      const minDistance = runtime.config.minPlayerDistance ?? this.defaultMinPlayerDistance;
      const maxDistance = runtime.config.maxPlayerDistance ?? this.defaultMaxPlayerDistance;
      if (!this.isSpawnPointEligible(runtime.config.position.x, runtime.config.position.y, minDistance, maxDistance)) {
        runtime.nextSpawnAt = currentTime + 250;
        return;
      }

      const direction = Phaser.Utils.Array.GetRandom(runtime.config.directions);
      const spawnPosition = this.resolveSpawnPosition(runtime.config.position.x, runtime.config.position.y, direction);
      const zombie = this.zombieSystem.spawn(spawnPosition.x, spawnPosition.y);
      if (!zombie) {
        runtime.nextSpawnAt = currentTime + runtime.config.cooldownMs;
        return;
      }

      this.applySpawnDirectionImpulse(zombie, direction);
      runtime.activeZombies.add(zombie);
      runtime.nextSpawnAt = currentTime + runtime.config.cooldownMs;

      console.info(`[VerticalSpawnSystem] point ${runtime.config.id} spawned zombie from ${direction}`);
    });
  }

  setPointEnabled(pointId: string, enabled: boolean, reason = 'sin-detalle'): void {
    const runtime = this.runtimes.find((candidate) => candidate.config.id === pointId);
    if (!runtime || runtime.enabled === enabled) {
      return;
    }

    runtime.enabled = enabled;
    console.info(`[VerticalSpawnSystem] point ${pointId} ${enabled ? 'enabled' : 'disabled'} (${reason})`);
  }

  setEnabled(enabled: boolean, reason = 'sin-detalle'): void {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;
    console.info(`[VerticalSpawnSystem] ${enabled ? 'enabled' : 'disabled'} (${reason})`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private cleanupInactive(runtime: VerticalSpawnRuntime): void {
    runtime.activeZombies.forEach((zombie) => {
      if (!zombie.active) {
        runtime.activeZombies.delete(zombie);
      }
    });
  }

  private isSpawnPointEligible(x: number, y: number, minDistance: number, maxDistance: number): boolean {
    const minDistanceSquared = minDistance * minDistance;
    const maxDistanceSquared = maxDistance * maxDistance;
    let hasNearbyPlayer = false;

    const allPlayersOutsideMinDistance = this.players.every((player) => {
      const dx = player.x - x;
      const dy = player.y - y;
      const squaredDistance = dx * dx + dy * dy;

      if (squaredDistance <= maxDistanceSquared) {
        hasNearbyPlayer = true;
      }

      return squaredDistance >= minDistanceSquared;
    });

    return allPlayersOutsideMinDistance && hasNearbyPlayer;
  }

  private resolveSpawnPosition(x: number, y: number, direction: VerticalSpawnDirection): { x: number; y: number } {
    switch (direction) {
      case 'stairs_up':
        return { x: x - 24, y: y - 110 };
      case 'stairs_down':
        return { x: x + 24, y: y + 90 };
      case 'door_left':
        return { x: x - 96, y: y + 40 };
      case 'door_right':
        return { x: x + 96, y: y + 40 };
      default:
        return { x, y };
    }
  }

  private applySpawnDirectionImpulse(zombie: Zombie, direction: VerticalSpawnDirection): void {
    const body = zombie.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }

    switch (direction) {
      case 'stairs_up':
        body.setVelocity(-35, -95);
        break;
      case 'stairs_down':
        body.setVelocity(35, 95);
        break;
      case 'door_left':
        body.setVelocity(-120, 0);
        break;
      case 'door_right':
        body.setVelocity(120, 0);
        break;
      default:
        body.setVelocity(0, 0);
    }
  }
}
