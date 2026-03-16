import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { scaleSpawnCooldownMs, scaleSpawnCount } from '../config/difficultyRuntime';
import { ZombieSystem } from './ZombieSystem';

export type SpawnType = 'wave_spawn' | 'ambient_spawn' | 'vertical_spawn' | 'door_spawn';
export type SpawnDirection = 'none' | 'stairs_up' | 'stairs_down' | 'door_left' | 'door_right' | 'left' | 'right';

interface SpawnArea {
  id: string;
  trigger?: { x: number; y: number; width: number; height: number };
  blockers?: {
    left: { x: number; y: number; width: number; height: number };
    right: { x: number; y: number; width: number; height: number };
  };
  maxAlive?: number;
}

export interface SpawnPointConfig {
  id: string;
  x: number;
  y: number;
  maxActive: number;
  spawnCooldown: number;
  spawnType: SpawnType;
  spawnDirection: SpawnDirection;
  spawnArea: string;
  difficultyModifier: number;
  spawnBudget?: number;
  minPlayerDistance?: number;
  maxPlayerDistance?: number;
}

export interface SpawnManagerConfig {
  minPlayerDistance?: number;
  maxPlayerDistance?: number;
  viewportSafePadding?: number;
  areas: SpawnArea[];
  points: SpawnPointConfig[];
}

interface RuntimeArea {
  config: SpawnArea;
  trigger?: Phaser.GameObjects.Zone;
  leftBlocker?: Phaser.GameObjects.Rectangle;
  rightBlocker?: Phaser.GameObjects.Rectangle;
  active: boolean;
  enabled: boolean;
  completed: boolean;
  pointIds: string[];
}

interface RuntimePoint {
  config: SpawnPointConfig;
  activeZombies: Set<Zombie>;
  nextSpawnAt: number;
  spawnedTotal: number;
  enabled: boolean;
}

interface SubsueloCompatJson {
  dimensiones: { anchoTotalPx: number; altoTotalPx: number };
  segmentos: Array<{ id: number; posicionX: { inicioPx: number; finPx: number } }>;
  zonasLimpiezaZombies?: Array<{
    id: string;
    segmentosCubiertos: number[];
    activacion: { x: number; y: number };
    spawnsZombies: Array<{ x: number; y: number }>;
    zombiesIniciales: number;
  }>;
  zombieSpawnManager?: {
    minPlayerDistance?: number;
    maxPlayerDistance?: number;
    viewportSafePadding?: number;
    areas: SpawnArea[];
    points: Array<Omit<SpawnPointConfig, 'spawnType' | 'spawnDirection'> & { spawnType: string; spawnDirection: string }>;
  };
}

interface VerticalCompatJson {
  verticalZombieSpawns?: {
    minPlayerDistance?: number;
    maxPlayerDistance?: number;
    points: Array<{
      id: string;
      position: { x: number; y: number };
      directions: string[];
      cooldownMs: number;
      maxActive: number;
      minPlayerDistance?: number;
      maxPlayerDistance?: number;
    }>;
  };
}

const DEFAULT_MIN_PLAYER_DISTANCE = 220;
const DEFAULT_MAX_PLAYER_DISTANCE = 1350;
const DEFAULT_VIEWPORT_SAFE_PADDING = 100;
const ALLOWED_SPAWN_TYPES: ReadonlySet<SpawnType> = new Set(['wave_spawn', 'ambient_spawn', 'vertical_spawn', 'door_spawn']);
const ALLOWED_DIRECTIONS: ReadonlySet<SpawnDirection> = new Set([
  'none',
  'stairs_up',
  'stairs_down',
  'door_left',
  'door_right',
  'left',
  'right'
]);

const DIRECTION_OFFSETS: Record<SpawnDirection, { x: number; y: number }> = {
  none: { x: 0, y: 0 },
  left: { x: -90, y: 0 },
  right: { x: 90, y: 0 },
  stairs_up: { x: -24, y: -110 },
  stairs_down: { x: 24, y: 90 },
  door_left: { x: -96, y: 40 },
  door_right: { x: 96, y: 40 }
};

export class SpawnManager {
  private readonly scene: Phaser.Scene;
  private readonly zombieSystem: ZombieSystem;
  private readonly players: Player[];
  private readonly defaultMinPlayerDistance: number;
  private readonly defaultMaxPlayerDistance: number;
  private readonly viewportSafePadding: number;
  private readonly areas = new Map<string, RuntimeArea>();
  private readonly points = new Map<string, RuntimePoint>();
  private readonly pointOrder: string[];
  private readonly getEnemyLimit?: () => number;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    zombieSystem: ZombieSystem,
    players: Player[],
    config: SpawnManagerConfig,
    options: { getEnemyLimit?: () => number } = {}
  ) {
    this.scene = scene;
    this.zombieSystem = zombieSystem;
    this.players = players;
    this.getEnemyLimit = options.getEnemyLimit;
    this.defaultMinPlayerDistance = config.minPlayerDistance ?? DEFAULT_MIN_PLAYER_DISTANCE;
    this.defaultMaxPlayerDistance = config.maxPlayerDistance ?? DEFAULT_MAX_PLAYER_DISTANCE;
    this.viewportSafePadding = config.viewportSafePadding ?? DEFAULT_VIEWPORT_SAFE_PADDING;

    config.areas.forEach((area) => {
      this.areas.set(area.id, this.createRuntimeArea(area));
    });

    config.points.forEach((point) => {
      const area = this.areas.get(point.spawnArea);
      if (!area) {
        return;
      }

      const runtime: RuntimePoint = {
        config: point,
        activeZombies: new Set<Zombie>(),
        nextSpawnAt: 0,
        spawnedTotal: 0,
        enabled: true
      };

      this.points.set(point.id, runtime);
      area.pointIds.push(point.id);
    });

    this.pointOrder = [...this.points.keys()].sort((a, b) => a.localeCompare(b));
    this.bindAreaTriggers();
  }

  static fromLevelJson(
    scene: Phaser.Scene,
    zombieSystem: ZombieSystem,
    players: Player[],
    levelJson: SubsueloCompatJson,
    verticalJson?: VerticalCompatJson,
    options: { spawnPressureMultiplier?: number; getEnemyLimit?: () => number } = {}
  ): SpawnManager {
    const spawnPressureMultiplier = options.spawnPressureMultiplier ?? 1;

    const config = levelJson.zombieSpawnManager
      ? SpawnManager.normalizeConfig(levelJson.zombieSpawnManager, spawnPressureMultiplier)
      : SpawnManager.fromLegacyJson(levelJson, verticalJson, spawnPressureMultiplier);

    return new SpawnManager(scene, zombieSystem, players, config, {
      getEnemyLimit: options.getEnemyLimit
    });
  }

  update(currentTime: number): void {
    if (!this.enabled) {
      return;
    }

    if (this.getEnemyLimit && this.zombieSystem.getActiveCount() >= this.getEnemyLimit()) {
      return;
    }

    this.cleanupInactiveZombies();

    for (const pointId of this.pointOrder) {
      const point = this.points.get(pointId);
      if (!point || !point.enabled) {
        continue;
      }

      const area = this.areas.get(point.config.spawnArea);
      if (!area || !area.enabled || area.completed || !area.active) {
        continue;
      }

      if (point.config.spawnBudget !== undefined && point.spawnedTotal >= point.config.spawnBudget) {
        continue;
      }

      const areaAlive = this.getAreaAliveCount(area.config.id);
      if (area.config.maxAlive !== undefined && areaAlive >= area.config.maxAlive) {
        continue;
      }

      if (point.activeZombies.size >= point.config.maxActive || currentTime < point.nextSpawnAt) {
        continue;
      }

      if (!this.isSpawnAllowed(point.config)) {
        point.nextSpawnAt = currentTime + 220;
        continue;
      }

      const position = this.resolveSpawnPosition(point.config.x, point.config.y, point.config.spawnDirection);
      const zombie = this.zombieSystem.spawn(position.x, position.y);
      point.nextSpawnAt = currentTime + point.config.spawnCooldown;

      if (!zombie) {
        continue;
      }

      this.applySpawnDirectionImpulse(zombie, point.config.spawnDirection);
      point.activeZombies.add(zombie);
      point.spawnedTotal += 1;
    }

    this.syncAreaCompletion();
  }

  setEnabled(enabled: boolean, reason = 'sin-detalle'): void {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;
    console.info(`[SpawnManager] ${enabled ? 'enabled' : 'disabled'} (${reason})`);
  }

  setAreaEnabled(areaId: string, enabled: boolean, reason = 'sin-detalle'): void {
    const area = this.areas.get(areaId);
    if (!area || area.enabled === enabled) {
      return;
    }

    area.enabled = enabled;
    if (!enabled) {
      area.active = false;
      this.setAreaBlockers(area, false);
    }

    console.info(`[SpawnManager] area ${areaId} ${enabled ? 'enabled' : 'disabled'} (${reason})`);
  }

  getTotalAreasCount(): number {
    return this.areas.size;
  }

  getCompletedAreasCount(): number {
    return [...this.areas.values()].filter((area) => area.completed).length;
  }

  getCompletedAreaIds(): string[] {
    return [...this.areas.values()].filter((area) => area.completed).map((area) => area.config.id);
  }

  private static normalizeConfig(
    config: Omit<SpawnManagerConfig, 'points'> & {
      points: Array<Omit<SpawnPointConfig, 'spawnType' | 'spawnDirection'> & { spawnType: string; spawnDirection: string }>;
    },
    spawnPressureMultiplier: number
  ): SpawnManagerConfig {
    return {
      minPlayerDistance: config.minPlayerDistance,
      maxPlayerDistance: config.maxPlayerDistance,
      viewportSafePadding: config.viewportSafePadding,
      areas: config.areas,
      points: config.points.map((point) => ({
        ...point,
        spawnType: ALLOWED_SPAWN_TYPES.has(point.spawnType as SpawnType) ? point.spawnType as SpawnType : 'ambient_spawn',
        spawnDirection: ALLOWED_DIRECTIONS.has(point.spawnDirection as SpawnDirection)
          ? point.spawnDirection as SpawnDirection
          : 'none',
        maxActive: scaleSpawnCount(point.maxActive, point.difficultyModifier * spawnPressureMultiplier),
        spawnCooldown: scaleSpawnCooldownMs(point.spawnCooldown, point.difficultyModifier * spawnPressureMultiplier),
        spawnBudget: point.spawnBudget !== undefined
          ? scaleSpawnCount(point.spawnBudget, point.difficultyModifier * spawnPressureMultiplier)
          : undefined
      }))
    };
  }

  private static fromLegacyJson(
    levelJson: SubsueloCompatJson,
    verticalJson: VerticalCompatJson | undefined,
    spawnPressureMultiplier: number
  ): SpawnManagerConfig {
    const areas: SpawnArea[] = [];
    const points: SpawnPointConfig[] = [];
    const zones = levelJson.zonasLimpiezaZombies ?? [];

    zones.forEach((zone) => {
      const coveredSegments = levelJson.segmentos.filter((segment) => zone.segmentosCubiertos.includes(segment.id));
      if (coveredSegments.length === 0) {
        return;
      }

      const leftBoundary = Math.max(0, Math.min(...coveredSegments.map((segment) => segment.posicionX.inicioPx)));
      const rightBoundary = Math.min(
        levelJson.dimensiones.anchoTotalPx,
        Math.max(...coveredSegments.map((segment) => segment.posicionX.finPx))
      );

      areas.push({
        id: zone.id,
        trigger: { x: zone.activacion.x, y: zone.activacion.y, width: 140, height: 220 },
        blockers: {
          left: {
            x: Phaser.Math.Clamp(leftBoundary - 36, 0, levelJson.dimensiones.anchoTotalPx),
            y: levelJson.dimensiones.altoTotalPx / 2,
            width: 30,
            height: levelJson.dimensiones.altoTotalPx
          },
          right: {
            x: Phaser.Math.Clamp(rightBoundary + 36, 0, levelJson.dimensiones.anchoTotalPx),
            y: levelJson.dimensiones.altoTotalPx / 2,
            width: 30,
            height: levelJson.dimensiones.altoTotalPx
          }
        }
      });

      const leftSpawns = zone.spawnsZombies.filter((spawnPoint) => spawnPoint.x <= zone.activacion.x);
      const rightSpawns = zone.spawnsZombies.filter((spawnPoint) => spawnPoint.x > zone.activacion.x);
      const perSideBudget = Math.max(1, Math.ceil(zone.zombiesIniciales / 2));

      leftSpawns.forEach((spawnPoint, index) => {
        points.push({
          id: `${zone.id}-wave-left-${index}`,
          x: spawnPoint.x,
          y: spawnPoint.y,
          maxActive: 1,
          spawnCooldown: 800,
          spawnType: 'wave_spawn',
          spawnDirection: 'right',
          spawnArea: zone.id,
          difficultyModifier: 1,
          spawnBudget: Math.ceil(perSideBudget / Math.max(1, leftSpawns.length))
        });
      });

      rightSpawns.forEach((spawnPoint, index) => {
        points.push({
          id: `${zone.id}-wave-right-${index}`,
          x: spawnPoint.x,
          y: spawnPoint.y,
          maxActive: 1,
          spawnCooldown: 800,
          spawnType: 'wave_spawn',
          spawnDirection: 'left',
          spawnArea: zone.id,
          difficultyModifier: 1,
          spawnBudget: Math.ceil(perSideBudget / Math.max(1, rightSpawns.length))
        });
      });
    });

    const vertical = verticalJson?.verticalZombieSpawns;
    vertical?.points.forEach((point) => {
      const direction = (point.directions[0] ?? 'door_left') as SpawnDirection;
      const fallbackArea = areas.find((area) => {
        if (!area.blockers) {
          return false;
        }

        const minX = Math.min(area.blockers.left.x, area.blockers.right.x);
        const maxX = Math.max(area.blockers.left.x, area.blockers.right.x);
        return point.position.x >= minX && point.position.x <= maxX;
      })?.id ?? areas[0]?.id;

      if (!fallbackArea) {
        return;
      }

      points.push({
        id: point.id,
        x: point.position.x,
        y: point.position.y,
        maxActive: point.maxActive,
        spawnCooldown: point.cooldownMs,
        spawnType: direction.startsWith('door') ? 'door_spawn' : 'vertical_spawn',
        spawnDirection: direction,
        spawnArea: fallbackArea,
        difficultyModifier: 1,
        minPlayerDistance: point.minPlayerDistance,
        maxPlayerDistance: point.maxPlayerDistance
      });
    });

    return SpawnManager.normalizeConfig({
      minPlayerDistance: vertical?.minPlayerDistance,
      maxPlayerDistance: vertical?.maxPlayerDistance,
      viewportSafePadding: DEFAULT_VIEWPORT_SAFE_PADDING,
      areas,
      points
    }, spawnPressureMultiplier);
  }

  private createRuntimeArea(area: SpawnArea): RuntimeArea {
    const runtime: RuntimeArea = {
      config: area,
      active: area.trigger === undefined,
      enabled: true,
      completed: false,
      pointIds: []
    };

    if (area.trigger) {
      runtime.trigger = this.scene.add.zone(area.trigger.x, area.trigger.y, area.trigger.width, area.trigger.height);
      this.scene.physics.add.existing(runtime.trigger, true);
    }

    if (area.blockers) {
      runtime.leftBlocker = this.createBlocker(area.blockers.left);
      runtime.rightBlocker = this.createBlocker(area.blockers.right);
      this.setAreaBlockers(runtime, false);
    }

    return runtime;
  }

  private bindAreaTriggers(): void {
    this.areas.forEach((area) => {
      if (!area.trigger) {
        return;
      }

      this.players.forEach((player) => {
        this.scene.physics.add.overlap(player, area.trigger!, () => {
          if (!this.enabled || !area.enabled || area.active || area.completed) {
            return;
          }

          area.active = true;
          area.trigger?.setActive(false).setVisible(false);
          const body = area.trigger?.body as Phaser.Physics.Arcade.StaticBody | undefined;
          if (body) {
            body.enable = false;
          }
          this.setAreaBlockers(area, true);
        });
      });
    });
  }

  private createBlocker(bounds: { x: number; y: number; width: number; height: number }): Phaser.GameObjects.Rectangle {
    const blocker = this.scene.add.rectangle(bounds.x, bounds.y, bounds.width, bounds.height, 0xef4444, 0.12);
    blocker.setVisible(false);
    this.scene.physics.add.existing(blocker, true);

    this.players.forEach((player) => {
      this.scene.physics.add.collider(player, blocker);
    });

    return blocker;
  }

  private setAreaBlockers(area: RuntimeArea, enabled: boolean): void {
    [area.leftBlocker, area.rightBlocker].forEach((blocker) => {
      if (!blocker) {
        return;
      }
      blocker.setVisible(enabled);
      const body = blocker.body as Phaser.Physics.Arcade.StaticBody;
      body.enable = enabled;
      if (enabled) {
        body.updateFromGameObject();
      }
    });
  }

  private cleanupInactiveZombies(): void {
    this.points.forEach((point) => {
      point.activeZombies.forEach((zombie) => {
        if (!zombie.active) {
          point.activeZombies.delete(zombie);
        }
      });
    });
  }

  private syncAreaCompletion(): void {
    this.areas.forEach((area) => {
      if (!area.active || area.completed) {
        return;
      }

      const allBudgetsSpent = area.pointIds.every((pointId) => {
        const point = this.points.get(pointId);
        return point
          ? point.config.spawnBudget === undefined || point.spawnedTotal >= point.config.spawnBudget
          : true;
      });

      const hasAliveInArea = this.getAreaAliveCount(area.config.id) > 0;
      if (!allBudgetsSpent || hasAliveInArea) {
        return;
      }

      area.completed = true;
      area.enabled = false;
      this.setAreaBlockers(area, false);
    });
  }

  private getAreaAliveCount(areaId: string): number {
    const area = this.areas.get(areaId);
    if (!area) {
      return 0;
    }

    return area.pointIds.reduce((total, pointId) => total + (this.points.get(pointId)?.activeZombies.size ?? 0), 0);
  }

  private isSpawnAllowed(point: SpawnPointConfig): boolean {
    const minDistance = point.minPlayerDistance ?? this.defaultMinPlayerDistance;
    const maxDistance = point.maxPlayerDistance ?? this.defaultMaxPlayerDistance;
    const minDistanceSquared = minDistance * minDistance;
    const maxDistanceSquared = maxDistance * maxDistance;

    let hasNearbyPlayer = false;

    const farEnough = this.players.every((player) => {
      const dx = player.x - point.x;
      const dy = player.y - point.y;
      const sqrDistance = dx * dx + dy * dy;
      if (sqrDistance <= maxDistanceSquared) {
        hasNearbyPlayer = true;
      }

      return sqrDistance >= minDistanceSquared;
    });

    if (!farEnough || !hasNearbyPlayer) {
      return false;
    }

    return this.players.every((player) => {
      const camera = player.scene.cameras.main;
      const view = camera.worldView;
      const immediateViewport = new Phaser.Geom.Rectangle(
        view.x - this.viewportSafePadding,
        view.y - this.viewportSafePadding,
        view.width + this.viewportSafePadding * 2,
        view.height + this.viewportSafePadding * 2
      );

      return !immediateViewport.contains(point.x, point.y);
    });
  }

  private resolveSpawnPosition(x: number, y: number, direction: SpawnDirection): { x: number; y: number } {
    const offset = DIRECTION_OFFSETS[direction] ?? DIRECTION_OFFSETS.none;
    return { x: x + offset.x, y: y + offset.y };
  }

  private applySpawnDirectionImpulse(zombie: Zombie, direction: SpawnDirection): void {
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
      case 'left':
        body.setVelocity(-120, 0);
        break;
      case 'door_right':
      case 'right':
        body.setVelocity(120, 0);
        break;
      default:
        body.setVelocity(0, 0);
    }
  }
}
