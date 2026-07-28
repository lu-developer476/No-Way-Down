import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { ZombieSystem } from './ZombieSystem';
import { scaleSpawnCount } from '../config/difficultyRuntime';

export interface ZombieWaveSpawnPoint {
  x: number;
  y: number;
}

export interface ZombieWaveZoneConfig {
  id: string;
  trigger: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  blockers: {
    left: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    right: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  wave: {
    leftSpawnPoints: ZombieWaveSpawnPoint[];
    rightSpawnPoints: ZombieWaveSpawnPoint[];
    zombiesPerSide: number;
  };
}

interface SubsueloSegment {
  id: number;
  posicionX: {
    inicioPx: number;
    finPx: number;
  };
}

interface SubsueloCleanupZone {
  id: string;
  segmentosCubiertos: number[];
  activacion: ZombieWaveSpawnPoint;
  spawnsZombies: ZombieWaveSpawnPoint[];
  zombiesIniciales: number;
}

export interface SubsueloLevelConfigJson {
  dimensiones: {
    anchoTotalPx: number;
    altoTotalPx: number;
  };
  segmentos: SubsueloSegment[];
  zonasLimpiezaZombies: SubsueloCleanupZone[];
}

export interface ZombieWaveJsonAdapterOptions {
  triggerSize?: {
    width: number;
    height: number;
  };
  blockerWidth?: number;
  blockerPadding?: number;
  spawnYOffset?: number;
  spawnPressureMultiplier?: number;
}

type WaveState = 'idle' | 'active' | 'completed';

interface RuntimeZone {
  config: ZombieWaveZoneConfig;
  trigger: Phaser.GameObjects.Zone;
  leftBlocker: Phaser.GameObjects.Rectangle;
  rightBlocker: Phaser.GameObjects.Rectangle;
  spawnedZombies: Zombie[];
  state: WaveState;
}

const DEFAULT_ADAPTER_OPTIONS: Required<ZombieWaveJsonAdapterOptions> = {
  triggerSize: {
    width: 140,
    height: 220
  },
  blockerWidth: 30,
  blockerPadding: 32,
  spawnYOffset: 0,
  spawnPressureMultiplier: 1
};

export function createZombieWaveZonesFromLevelJson(
  levelJson: SubsueloLevelConfigJson,
  options: ZombieWaveJsonAdapterOptions = {}
): ZombieWaveZoneConfig[] {
  const mergedOptions: Required<ZombieWaveJsonAdapterOptions> = {
    triggerSize: options.triggerSize ?? DEFAULT_ADAPTER_OPTIONS.triggerSize,
    blockerWidth: options.blockerWidth ?? DEFAULT_ADAPTER_OPTIONS.blockerWidth,
    blockerPadding: options.blockerPadding ?? DEFAULT_ADAPTER_OPTIONS.blockerPadding,
    spawnYOffset: options.spawnYOffset ?? DEFAULT_ADAPTER_OPTIONS.spawnYOffset,
    spawnPressureMultiplier: options.spawnPressureMultiplier ?? DEFAULT_ADAPTER_OPTIONS.spawnPressureMultiplier
  };

  const spawnPressureMultiplier = mergedOptions.spawnPressureMultiplier;

  return levelJson.zonasLimpiezaZombies.map((zone) => {
    const levelWidth = levelJson.dimensiones.anchoTotalPx;
    const coveredSegments = levelJson.segmentos.filter((segment) => zone.segmentosCubiertos.includes(segment.id));

    if (coveredSegments.length === 0) {
      throw new Error(`Zombie cleanup zone "${zone.id}" has no valid covered segments in level JSON.`);
    }

    const leftBoundary = Math.max(0, Math.min(...coveredSegments.map((segment) => segment.posicionX.inicioPx)));
    const rightBoundary = Math.min(levelWidth, Math.max(...coveredSegments.map((segment) => segment.posicionX.finPx)));

    const leftSpawnPoints = zone.spawnsZombies
      .filter((spawnPoint) => spawnPoint.x <= zone.activacion.x)
      .map((spawnPoint) => ({
        x: Phaser.Math.Clamp(spawnPoint.x, 0, levelWidth),
        y: spawnPoint.y + mergedOptions.spawnYOffset
      }));

    const rightSpawnPoints = zone.spawnsZombies
      .filter((spawnPoint) => spawnPoint.x > zone.activacion.x)
      .map((spawnPoint) => ({
        x: Phaser.Math.Clamp(spawnPoint.x, 0, levelWidth),
        y: spawnPoint.y + mergedOptions.spawnYOffset
      }));

    const fallbackSplitIndex = Math.ceil(zone.spawnsZombies.length / 2);
    const safeLeftSpawns = leftSpawnPoints.length > 0
      ? leftSpawnPoints
      : zone.spawnsZombies.slice(0, fallbackSplitIndex).map((spawnPoint) => ({
        x: Phaser.Math.Clamp(spawnPoint.x, 0, levelWidth),
        y: spawnPoint.y + mergedOptions.spawnYOffset
      }));

    const safeRightSpawns = rightSpawnPoints.length > 0
      ? rightSpawnPoints
      : zone.spawnsZombies.slice(fallbackSplitIndex).map((spawnPoint) => ({
        x: Phaser.Math.Clamp(spawnPoint.x, 0, levelWidth),
        y: spawnPoint.y + mergedOptions.spawnYOffset
      }));

    return {
      id: zone.id,
      trigger: {
        x: Phaser.Math.Clamp(zone.activacion.x, 0, levelWidth),
        y: zone.activacion.y,
        width: mergedOptions.triggerSize.width,
        height: mergedOptions.triggerSize.height
      },
      blockers: {
        left: {
          x: Phaser.Math.Clamp(leftBoundary - mergedOptions.blockerPadding, 0, levelWidth),
          y: levelJson.dimensiones.altoTotalPx / 2,
          width: mergedOptions.blockerWidth,
          height: levelJson.dimensiones.altoTotalPx
        },
        right: {
          x: Phaser.Math.Clamp(rightBoundary + mergedOptions.blockerPadding, 0, levelWidth),
          y: levelJson.dimensiones.altoTotalPx / 2,
          width: mergedOptions.blockerWidth,
          height: levelJson.dimensiones.altoTotalPx
        }
      },
      wave: {
        leftSpawnPoints: safeLeftSpawns,
        rightSpawnPoints: safeRightSpawns,
        zombiesPerSide: scaleSpawnCount(Math.max(1, Math.ceil(zone.zombiesIniciales / 2)), spawnPressureMultiplier)
      }
    };
  });
}

export class ZombieWaveZone {
  private readonly scene: Phaser.Scene;
  private readonly zombieSystem: ZombieSystem;
  private readonly players: Player[];
  private readonly zones: RuntimeZone[];
  private enabled = true;

  constructor(scene: Phaser.Scene, zombieSystem: ZombieSystem, players: Player[], configs: ZombieWaveZoneConfig[]) {
    this.scene = scene;
    this.zombieSystem = zombieSystem;
    this.players = players;
    this.zones = configs.map((config) => this.createRuntimeZone(config));

    this.bindTriggerOverlaps();
  }

  update(): void {
    if (!this.enabled) {
      return;
    }

    this.zones.forEach((zone) => {
      if (zone.state !== 'active') {
        return;
      }

      const hasAliveZombies = zone.spawnedZombies.some((zombie) => zombie.active);
      if (!hasAliveZombies) {
        this.completeZone(zone);
      }
    });
  }

  getTotalZonesCount(): number {
    return this.zones.length;
  }

  getCompletedZonesCount(): number {
    return this.zones.filter((zone) => zone.state === 'completed').length;
  }

  getCompletedZoneIds(): string[] {
    return this.zones
      .filter((zone) => zone.state === 'completed')
      .map((zone) => zone.config.id);
  }

  areAllZonesCompleted(): boolean {
    return this.getTotalZonesCount() > 0 && this.getCompletedZonesCount() === this.getTotalZonesCount();
  }

  setEnabled(enabled: boolean, reason = 'sin-detalle'): void {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;
    console.info(`[ZombieWaveZone] ${enabled ? 'enabled' : 'disabled'} (${reason})`);
  }

  private createRuntimeZone(config: ZombieWaveZoneConfig): RuntimeZone {
    const trigger = this.scene.add.zone(
      config.trigger.x,
      config.trigger.y,
      config.trigger.width,
      config.trigger.height
    );
    this.scene.physics.add.existing(trigger, true);

    const leftBlocker = this.createBlocker(config.blockers.left);
    const rightBlocker = this.createBlocker(config.blockers.right);

    this.setBlockerEnabled(leftBlocker, false);
    this.setBlockerEnabled(rightBlocker, false);

    return {
      config,
      trigger,
      leftBlocker,
      rightBlocker,
      spawnedZombies: [],
      state: 'idle'
    };
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

  private bindTriggerOverlaps(): void {
    this.zones.forEach((zone) => {
      this.players.forEach((player) => {
        this.scene.physics.add.overlap(player, zone.trigger, () => {
          this.activateZone(zone);
        });
      });
    });
  }

  private activateZone(zone: RuntimeZone): void {
    if (!this.enabled || zone.state !== 'idle') {
      return;
    }

    zone.state = 'active';
    this.setBlockerEnabled(zone.leftBlocker, true);
    this.setBlockerEnabled(zone.rightBlocker, true);
    zone.trigger.setActive(false).setVisible(false);
    const triggerBody = zone.trigger.body as Phaser.Physics.Arcade.StaticBody;
    triggerBody.enable = false;
    zone.spawnedZombies = this.spawnWave(zone.config);

    console.info(`[ZombieWaveZone] zone activated: ${zone.config.id}`);

    this.scene.registry.set('interactionHint', `Zona ${zone.config.id} activa: elimina a todos los zombies`);
  }

  private spawnWave(config: ZombieWaveZoneConfig): Zombie[] {
    const spawned: Zombie[] = [];
    const totalPerSide = config.wave.zombiesPerSide;

    for (let i = 0; i < totalPerSide; i += 1) {
      const leftSpawnPoint = config.wave.leftSpawnPoints[i % config.wave.leftSpawnPoints.length];
      const rightSpawnPoint = config.wave.rightSpawnPoints[i % config.wave.rightSpawnPoints.length];

      const leftZombie = this.zombieSystem.spawn(leftSpawnPoint.x, leftSpawnPoint.y);
      const rightZombie = this.zombieSystem.spawn(rightSpawnPoint.x, rightSpawnPoint.y);

      if (leftZombie) {
        spawned.push(leftZombie);
      }

      if (rightZombie) {
        spawned.push(rightZombie);
      }
    }

    return spawned;
  }

  private completeZone(zone: RuntimeZone): void {
    zone.state = 'completed';
    this.setBlockerEnabled(zone.leftBlocker, false);
    this.setBlockerEnabled(zone.rightBlocker, false);
    console.info(`[ZombieWaveZone] zone completed: ${zone.config.id}`);
    this.scene.registry.set('interactionHint', 'Zona despejada. Avance desbloqueado.');
  }

  private setBlockerEnabled(blocker: Phaser.GameObjects.Rectangle, enabled: boolean): void {
    blocker.setVisible(enabled);

    const body = blocker.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = enabled;

    if (enabled) {
      body.updateFromGameObject();
    }
  }
}
