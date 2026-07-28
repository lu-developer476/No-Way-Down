import Phaser from 'phaser';

export interface LevelProgressionPoint {
  x: number;
  y: number;
}

export interface LevelProgressionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LevelProgressionBlockerConfig {
  id: string;
  bounds: LevelProgressionBounds;
  color?: number;
  alpha?: number;
  visibleWhenDisabled?: boolean;
  startsEnabled?: boolean;
}

export interface LevelProgressionSpawnWaveConfig {
  enemyType: string;
  count: number;
  spawnPoints: LevelProgressionPoint[];
  metadata?: Record<string, unknown>;
}

export interface LevelProgressionSectionConfig {
  id: string;
  initiallyEnabled?: boolean;
}

export interface LevelProgressionZoneConfig {
  id: string;
  trigger: LevelProgressionBounds;
  lockBlockers: string[];
  spawnWaves: LevelProgressionSpawnWaveConfig[];
  unlockBlockers?: string[];
  enableSections?: string[];
  hintOnActivate?: string;
  hintOnComplete?: string;
}

export interface LevelProgressionConfig {
  blockers: LevelProgressionBlockerConfig[];
  zones: LevelProgressionZoneConfig[];
  sections?: LevelProgressionSectionConfig[];
}

export interface SpawnEnemyRequest {
  zoneId: string;
  waveIndex: number;
  enemyIndex: number;
  enemyType: string;
  spawnPoint: LevelProgressionPoint;
  metadata?: Record<string, unknown>;
}

export interface LevelProgressionCallbacks<TEnemyHandle> {
  spawnEnemy: (request: SpawnEnemyRequest) => TEnemyHandle | null;
  isEnemyAlive: (enemy: TEnemyHandle) => boolean;
  onSectionEnabled?: (sectionId: string) => void;
  onZoneActivated?: (zoneId: string) => void;
  onZoneCompleted?: (zoneId: string) => void;
  onHintChanged?: (hint: string) => void;
}

export interface LevelProgressionSystemOptions {
  blockerDefaultColor?: number;
  blockerDefaultAlpha?: number;
}

type ZoneRuntimeState = 'idle' | 'active' | 'completed';

interface RuntimeZone<TEnemyHandle> {
  config: LevelProgressionZoneConfig;
  trigger: Phaser.GameObjects.Zone;
  state: ZoneRuntimeState;
  spawnedEnemies: TEnemyHandle[];
}

const DEFAULT_OPTIONS: Required<LevelProgressionSystemOptions> = {
  blockerDefaultColor: 0xef4444,
  blockerDefaultAlpha: 0.12
};

export class LevelProgressionSystem<TEnemyHandle> {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly callbacks: LevelProgressionCallbacks<TEnemyHandle>;
  private readonly blockerMap: Map<string, Phaser.GameObjects.Rectangle>;
  private readonly sectionState: Map<string, boolean>;
  private readonly zones: RuntimeZone<TEnemyHandle>[];
  private readonly options: Required<LevelProgressionSystemOptions>;

  constructor(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    config: LevelProgressionConfig,
    callbacks: LevelProgressionCallbacks<TEnemyHandle>,
    options: LevelProgressionSystemOptions = {}
  ) {
    this.scene = scene;
    this.players = players;
    this.callbacks = callbacks;
    this.options = {
      blockerDefaultColor: options.blockerDefaultColor ?? DEFAULT_OPTIONS.blockerDefaultColor,
      blockerDefaultAlpha: options.blockerDefaultAlpha ?? DEFAULT_OPTIONS.blockerDefaultAlpha
    };

    this.validateConfig(config);

    this.blockerMap = new Map(
      config.blockers.map((blockerConfig) => [
        blockerConfig.id,
        this.createBlocker(blockerConfig)
      ])
    );

    this.sectionState = new Map(
      (config.sections ?? []).map((sectionConfig) => [
        sectionConfig.id,
        sectionConfig.initiallyEnabled ?? false
      ])
    );

    this.zones = config.zones.map((zoneConfig) => this.createRuntimeZone(zoneConfig));
    this.bindTriggerOverlaps();
  }

  update(): void {
    this.zones.forEach((zone) => {
      if (zone.state !== 'active') {
        return;
      }

      const hasAliveEnemies = zone.spawnedEnemies.some((enemy) => this.callbacks.isEnemyAlive(enemy));
      if (!hasAliveEnemies) {
        this.completeZone(zone);
      }
    });
  }

  destroy(): void {
    this.zones.forEach((zone) => {
      zone.trigger.destroy();
    });

    this.blockerMap.forEach((blocker) => {
      blocker.destroy();
    });

    this.blockerMap.clear();
    this.sectionState.clear();
  }

  isSectionEnabled(sectionId: string): boolean {
    return this.sectionState.get(sectionId) ?? false;
  }

  getZoneState(zoneId: string): ZoneRuntimeState | undefined {
    return this.zones.find((zone) => zone.config.id === zoneId)?.state;
  }

  private validateConfig(config: LevelProgressionConfig): void {
    const blockerIds = new Set<string>();

    config.blockers.forEach((blocker) => {
      if (blockerIds.has(blocker.id)) {
        throw new Error(`LevelProgressionSystem: duplicated blocker id "${blocker.id}".`);
      }

      blockerIds.add(blocker.id);
    });

    const sectionIds = new Set((config.sections ?? []).map((section) => section.id));
    const zoneIds = new Set<string>();

    config.zones.forEach((zone) => {
      if (zoneIds.has(zone.id)) {
        throw new Error(`LevelProgressionSystem: duplicated zone id "${zone.id}".`);
      }

      zoneIds.add(zone.id);

      if (zone.spawnWaves.length === 0) {
        throw new Error(`LevelProgressionSystem: zone "${zone.id}" must define at least one spawn wave.`);
      }

      zone.spawnWaves.forEach((wave, waveIndex) => {
        if (wave.spawnPoints.length === 0) {
          throw new Error(
            `LevelProgressionSystem: zone "${zone.id}" wave #${waveIndex} must define at least one spawn point.`
          );
        }
      });

      [...zone.lockBlockers, ...(zone.unlockBlockers ?? [])].forEach((blockerId) => {
        if (!blockerIds.has(blockerId)) {
          throw new Error(`LevelProgressionSystem: zone "${zone.id}" references unknown blocker "${blockerId}".`);
        }
      });

      (zone.enableSections ?? []).forEach((sectionId) => {
        if (!sectionIds.has(sectionId)) {
          throw new Error(`LevelProgressionSystem: zone "${zone.id}" references unknown section "${sectionId}".`);
        }
      });
    });
  }

  private createRuntimeZone(zoneConfig: LevelProgressionZoneConfig): RuntimeZone<TEnemyHandle> {
    const trigger = this.scene.add.zone(
      zoneConfig.trigger.x,
      zoneConfig.trigger.y,
      zoneConfig.trigger.width,
      zoneConfig.trigger.height
    );

    this.scene.physics.add.existing(trigger, true);

    return {
      config: zoneConfig,
      trigger,
      state: 'idle',
      spawnedEnemies: []
    };
  }

  private createBlocker(config: LevelProgressionBlockerConfig): Phaser.GameObjects.Rectangle {
    const blocker = this.scene.add.rectangle(
      config.bounds.x,
      config.bounds.y,
      config.bounds.width,
      config.bounds.height,
      config.color ?? this.options.blockerDefaultColor,
      config.alpha ?? this.options.blockerDefaultAlpha
    );

    this.scene.physics.add.existing(blocker, true);

    this.players.forEach((player) => {
      this.scene.physics.add.collider(player, blocker);
    });

    this.setBlockerEnabled(blocker, config.startsEnabled ?? false, config.visibleWhenDisabled ?? false);

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

  private activateZone(zone: RuntimeZone<TEnemyHandle>): void {
    if (zone.state !== 'idle') {
      return;
    }

    zone.state = 'active';
    this.callbacks.onZoneActivated?.(zone.config.id);

    zone.config.lockBlockers.forEach((blockerId) => {
      const blocker = this.blockerMap.get(blockerId);
      if (blocker) {
        this.setBlockerEnabled(blocker, true, true);
      }
    });

    zone.trigger.setActive(false).setVisible(false);
    const triggerBody = zone.trigger.body as Phaser.Physics.Arcade.StaticBody;
    triggerBody.enable = false;

    zone.spawnedEnemies = this.spawnConfiguredWaves(zone.config);

    if (zone.config.hintOnActivate) {
      this.callbacks.onHintChanged?.(zone.config.hintOnActivate);
    }
  }

  private spawnConfiguredWaves(config: LevelProgressionZoneConfig): TEnemyHandle[] {
    const spawned: TEnemyHandle[] = [];

    config.spawnWaves.forEach((wave, waveIndex) => {
      for (let enemyIndex = 0; enemyIndex < wave.count; enemyIndex += 1) {
        const spawnPoint = wave.spawnPoints[enemyIndex % wave.spawnPoints.length];

        const enemy = this.callbacks.spawnEnemy({
          zoneId: config.id,
          waveIndex,
          enemyIndex,
          enemyType: wave.enemyType,
          spawnPoint,
          metadata: wave.metadata
        });

        if (enemy) {
          spawned.push(enemy);
        }
      }
    });

    return spawned;
  }

  private completeZone(zone: RuntimeZone<TEnemyHandle>): void {
    zone.state = 'completed';

    const blockersToUnlock = zone.config.unlockBlockers ?? zone.config.lockBlockers;
    blockersToUnlock.forEach((blockerId) => {
      const blocker = this.blockerMap.get(blockerId);
      if (blocker) {
        this.setBlockerEnabled(blocker, false, false);
      }
    });

    (zone.config.enableSections ?? []).forEach((sectionId) => {
      this.sectionState.set(sectionId, true);
      this.callbacks.onSectionEnabled?.(sectionId);
    });

    if (zone.config.hintOnComplete) {
      this.callbacks.onHintChanged?.(zone.config.hintOnComplete);
    }

    this.callbacks.onZoneCompleted?.(zone.config.id);
  }

  private setBlockerEnabled(
    blocker: Phaser.GameObjects.Rectangle,
    enabled: boolean,
    visibleWhenDisabled: boolean
  ): void {
    blocker.setVisible(enabled || visibleWhenDisabled);

    const body = blocker.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = enabled;

    if (enabled) {
      body.updateFromGameObject();
    }
  }
}
