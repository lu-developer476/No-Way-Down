import Phaser from 'phaser';
import { Zombie } from '../entities/Zombie';
import { ZombieSystem } from './ZombieSystem';

export type FlankingEscapeEncounterState = 'idle' | 'active' | 'completed';
export type FlankingEscapeZoneId = 'salida-c' | 'salida-d';

export interface FlankingEscapeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlankingEscapeSpawnPointConfig {
  id: string;
  x: number;
  y: number;
  tags?: string[];
}

export interface FlankingEscapeDynamicSpawnConfig {
  enabled: boolean;
  preferredTags?: string[];
  fallbackSpawnPointIds?: string[];
}

export interface FlankingEscapeEnemyBatchConfig {
  enemyType?: 'zombie';
  count: number;
  spawnPointIds?: string[];
  spawnIntervalMs?: number;
  dynamicSpawn?: FlankingEscapeDynamicSpawnConfig;
}

export interface FlankingEscapeWaveConfig {
  id: string;
  label: string;
  enemies: FlankingEscapeEnemyBatchConfig[];
}

export interface FlankingEscapeRepositionConfig {
  destination: { x: number; y: number };
  spreadRadius?: number;
  hint?: string;
}

export interface FlankingEscapeEncounterConfig {
  id: FlankingEscapeZoneId;
  label: string;
  trigger: FlankingEscapeBounds;
  spawnPoints: FlankingEscapeSpawnPointConfig[];
  waves: FlankingEscapeWaveConfig[];
  maxAliveEnemies?: number;
  spawnTickMs?: number;
  repositionAfterCombat: FlankingEscapeRepositionConfig;
}

export interface FlankingEscapeCombatConfig {
  levelId: string;
  combatSystemId: string;
  encounters: FlankingEscapeEncounterConfig[];
}

export interface FlankingEscapeCombatCallbacks {
  onEncounterStarted?: (encounter: FlankingEscapeEncounterConfig) => void;
  onWaveStarted?: (payload: { encounterId: FlankingEscapeZoneId; waveId: string; waveIndex: number }) => void;
  onWaveCompleted?: (payload: { encounterId: FlankingEscapeZoneId; waveId: string; waveIndex: number }) => void;
  onEncounterCompleted?: (payload: {
    encounterId: FlankingEscapeZoneId;
    reposition: FlankingEscapeRepositionConfig;
    state: FlankingEscapeCombatSnapshot;
  }) => void;
  onAllEncountersCompleted?: (state: FlankingEscapeCombatSnapshot) => void;
  onHintChanged?: (hint: string) => void;
}

export interface FlankingEscapeCombatSnapshot {
  levelId: string;
  combatSystemId: string;
  activeEncounterId?: FlankingEscapeZoneId;
  completedEncounterIds: FlankingEscapeZoneId[];
  aliveEnemies: number;
  pendingSpawns: number;
  isComplete: boolean;
}

interface RuntimeSpawnRequest {
  encounterId: FlankingEscapeZoneId;
  waveId: string;
  waveIndex: number;
  enemyType: 'zombie';
  spawnIntervalMs: number;
  staticSpawnPointIds: string[];
  dynamicSpawn?: FlankingEscapeDynamicSpawnConfig;
}

interface RuntimeEncounter {
  config: FlankingEscapeEncounterConfig;
  state: FlankingEscapeEncounterState;
  trigger: Phaser.GameObjects.Zone;
  spawnPointById: Map<string, FlankingEscapeSpawnPointConfig>;
  aliveEnemies: Set<Zombie>;
  pendingSpawnQueue: RuntimeSpawnRequest[];
  activeWaveIndex: number;
  nextSpawnAt: number;
}

const DEFAULT_SPAWN_INTERVAL_MS = 250;
const DEFAULT_SPAWN_TICK_MS = 300;
const DEFAULT_MAX_ALIVE_ENEMIES = 5;
const DEFAULT_REPOSITION_SPREAD = 24;

export class FlankingEscapeCombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly zombieSystem: ZombieSystem;
  private readonly config: FlankingEscapeCombatConfig;
  private readonly callbacks: FlankingEscapeCombatCallbacks;

  private readonly encounterMap: Map<FlankingEscapeZoneId, RuntimeEncounter>;
  private readonly encounterOrder: RuntimeEncounter[];
  private activeEncounter?: RuntimeEncounter;

  static fromJson(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    zombieSystem: ZombieSystem,
    config: FlankingEscapeCombatConfig,
    callbacks: FlankingEscapeCombatCallbacks = {}
  ): FlankingEscapeCombatSystem {
    return new FlankingEscapeCombatSystem(scene, players, zombieSystem, config, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    zombieSystem: ZombieSystem,
    config: FlankingEscapeCombatConfig,
    callbacks: FlankingEscapeCombatCallbacks = {}
  ) {
    this.scene = scene;
    this.players = players;
    this.zombieSystem = zombieSystem;
    this.config = config;
    this.callbacks = callbacks;

    this.validateConfig(config);

    this.encounterOrder = config.encounters.map((encounterConfig) => this.createRuntimeEncounter(encounterConfig));
    this.encounterMap = new Map(this.encounterOrder.map((encounter) => [encounter.config.id, encounter]));

    this.bindTriggerActivation();
  }

  update(): void {
    if (!this.activeEncounter || this.activeEncounter.state !== 'active') {
      return;
    }

    this.flushEnemyLiveness(this.activeEncounter);
    this.trySpawn(this.activeEncounter);
    this.tryResolveWave(this.activeEncounter);
  }

  destroy(): void {
    this.encounterOrder.forEach((encounter) => {
      encounter.trigger.destroy();
      encounter.aliveEnemies.clear();
      encounter.pendingSpawnQueue = [];
    });
  }

  getSnapshot(): FlankingEscapeCombatSnapshot {
    return {
      levelId: this.config.levelId,
      combatSystemId: this.config.combatSystemId,
      activeEncounterId: this.activeEncounter?.config.id,
      completedEncounterIds: this.encounterOrder
        .filter((encounter) => encounter.state === 'completed')
        .map((encounter) => encounter.config.id),
      aliveEnemies: this.activeEncounter?.aliveEnemies.size ?? 0,
      pendingSpawns: this.activeEncounter?.pendingSpawnQueue.length ?? 0,
      isComplete: this.encounterOrder.every((encounter) => encounter.state === 'completed')
    };
  }

  private createRuntimeEncounter(config: FlankingEscapeEncounterConfig): RuntimeEncounter {
    const trigger = this.scene.add.zone(config.trigger.x, config.trigger.y, config.trigger.width, config.trigger.height);
    this.scene.physics.add.existing(trigger, true);

    return {
      config,
      state: 'idle',
      trigger,
      spawnPointById: new Map(config.spawnPoints.map((spawnPoint) => [spawnPoint.id, spawnPoint])),
      aliveEnemies: new Set<Zombie>(),
      pendingSpawnQueue: [],
      activeWaveIndex: -1,
      nextSpawnAt: 0
    };
  }

  private bindTriggerActivation(): void {
    this.encounterOrder.forEach((encounter) => {
      this.players.forEach((player) => {
        this.scene.physics.add.overlap(player, encounter.trigger, () => {
          if (this.activeEncounter || encounter.state !== 'idle') {
            return;
          }

          this.startEncounter(encounter);
        });
      });
    });
  }

  private startEncounter(encounter: RuntimeEncounter): void {
    encounter.state = 'active';
    encounter.activeWaveIndex = -1;
    encounter.pendingSpawnQueue = [];
    encounter.nextSpawnAt = this.scene.time.now;
    this.activeEncounter = encounter;

    this.setTriggerEnabled(encounter.trigger, false);

    this.callbacks.onEncounterStarted?.(encounter.config);
    this.callbacks.onHintChanged?.(`Flanqueo en ${encounter.config.label}: moverse y contener la presión.`);

    this.startNextWave(encounter);
  }

  private startNextWave(encounter: RuntimeEncounter): void {
    encounter.activeWaveIndex += 1;

    if (encounter.activeWaveIndex >= encounter.config.waves.length) {
      this.completeEncounter(encounter);
      return;
    }

    const wave = encounter.config.waves[encounter.activeWaveIndex];
    encounter.pendingSpawnQueue = this.buildSpawnQueue(encounter, wave, encounter.activeWaveIndex);
    encounter.nextSpawnAt = this.scene.time.now;

    this.callbacks.onWaveStarted?.({
      encounterId: encounter.config.id,
      waveId: wave.id,
      waveIndex: encounter.activeWaveIndex
    });
  }

  private buildSpawnQueue(
    encounter: RuntimeEncounter,
    wave: FlankingEscapeWaveConfig,
    waveIndex: number
  ): RuntimeSpawnRequest[] {
    const queue: RuntimeSpawnRequest[] = [];

    wave.enemies.forEach((batch) => {
      const staticSpawnPointIds = batch.spawnPointIds ?? [];

      for (let index = 0; index < batch.count; index += 1) {
        queue.push({
          encounterId: encounter.config.id,
          waveId: wave.id,
          waveIndex,
          enemyType: batch.enemyType ?? 'zombie',
          spawnIntervalMs: batch.spawnIntervalMs ?? DEFAULT_SPAWN_INTERVAL_MS,
          staticSpawnPointIds,
          dynamicSpawn: batch.dynamicSpawn
        });
      }
    });

    return queue;
  }

  private trySpawn(encounter: RuntimeEncounter): void {
    if (encounter.pendingSpawnQueue.length === 0 || this.scene.time.now < encounter.nextSpawnAt) {
      return;
    }

    const maxAliveEnemies = encounter.config.maxAliveEnemies ?? DEFAULT_MAX_ALIVE_ENEMIES;
    if (encounter.aliveEnemies.size >= maxAliveEnemies) {
      encounter.nextSpawnAt = this.scene.time.now + (encounter.config.spawnTickMs ?? DEFAULT_SPAWN_TICK_MS);
      return;
    }

    const request = encounter.pendingSpawnQueue.shift();
    if (!request) {
      return;
    }

    const spawnPoint = this.resolveSpawnPoint(encounter, request);
    if (!spawnPoint) {
      encounter.nextSpawnAt = this.scene.time.now + request.spawnIntervalMs;
      return;
    }

    if (request.enemyType === 'zombie') {
      const zombie = this.zombieSystem.spawn(spawnPoint.x, spawnPoint.y);
      if (zombie) {
        encounter.aliveEnemies.add(zombie);
      }
    }

    encounter.nextSpawnAt = this.scene.time.now + request.spawnIntervalMs;
  }

  private resolveSpawnPoint(
    encounter: RuntimeEncounter,
    request: RuntimeSpawnRequest
  ): FlankingEscapeSpawnPointConfig | undefined {
    const dynamicConfig = request.dynamicSpawn;

    if (dynamicConfig?.enabled) {
      const candidates = this.resolveCandidatePoints(encounter, dynamicConfig);
      const groupCenter = this.getGroupCenter();

      if (groupCenter && candidates.length > 0) {
        const preferredTags = new Set(dynamicConfig.preferredTags ?? []);
        const sorted = candidates
          .map((spawnPoint) => {
            const distance = Phaser.Math.Distance.Between(spawnPoint.x, spawnPoint.y, groupCenter.x, groupCenter.y);
            const hasPreferredTag = (spawnPoint.tags ?? []).some((tag) => preferredTags.has(tag));
            const score = distance + (hasPreferredTag ? 200 : 0);
            return { spawnPoint, score };
          })
          .sort((left, right) => right.score - left.score);

        return sorted[0]?.spawnPoint;
      }
    }

    const staticIds = request.staticSpawnPointIds;
    if (staticIds.length === 0) {
      return encounter.config.spawnPoints[0];
    }

    const randomId = staticIds[Phaser.Math.Between(0, staticIds.length - 1)];
    return encounter.spawnPointById.get(randomId);
  }

  private resolveCandidatePoints(
    encounter: RuntimeEncounter,
    dynamicConfig: FlankingEscapeDynamicSpawnConfig
  ): FlankingEscapeSpawnPointConfig[] {
    const fallbackIds = dynamicConfig.fallbackSpawnPointIds ?? [];
    if (fallbackIds.length > 0) {
      const points = fallbackIds
        .map((spawnPointId) => encounter.spawnPointById.get(spawnPointId))
        .filter((spawnPoint): spawnPoint is FlankingEscapeSpawnPointConfig => Boolean(spawnPoint));

      if (points.length > 0) {
        return points;
      }
    }

    return encounter.config.spawnPoints;
  }

  private tryResolveWave(encounter: RuntimeEncounter): void {
    if (encounter.pendingSpawnQueue.length > 0 || encounter.aliveEnemies.size > 0) {
      return;
    }

    const wave = encounter.config.waves[encounter.activeWaveIndex];
    this.callbacks.onWaveCompleted?.({
      encounterId: encounter.config.id,
      waveId: wave.id,
      waveIndex: encounter.activeWaveIndex
    });

    this.startNextWave(encounter);
  }

  private completeEncounter(encounter: RuntimeEncounter): void {
    encounter.state = 'completed';

    this.repositionPlayers(encounter.config.repositionAfterCombat);
    this.callbacks.onHintChanged?.(
      encounter.config.repositionAfterCombat.hint ?? `Repliegue completado: avanzar hacia la siguiente salida.`
    );

    this.callbacks.onEncounterCompleted?.({
      encounterId: encounter.config.id,
      reposition: encounter.config.repositionAfterCombat,
      state: this.getSnapshot()
    });

    this.activeEncounter = undefined;

    if (this.encounterOrder.every((item) => item.state === 'completed')) {
      this.callbacks.onAllEncountersCompleted?.(this.getSnapshot());
    }
  }

  private repositionPlayers(reposition: FlankingEscapeRepositionConfig): void {
    const spread = reposition.spreadRadius ?? DEFAULT_REPOSITION_SPREAD;

    this.players.forEach((player, index) => {
      const gameObject = player as unknown as Phaser.GameObjects.GameObject & {
        x: number;
        y: number;
        setPosition?: (x: number, y: number) => Phaser.GameObjects.GameObject;
        body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
      };

      if (!gameObject.setPosition) {
        return;
      }

      const angle = (Math.PI * 2 * index) / Math.max(this.players.length, 1);
      const x = reposition.destination.x + Math.cos(angle) * spread;
      const y = reposition.destination.y + Math.sin(angle) * spread;

      gameObject.setPosition(x, y);

      const body = gameObject.body;
      if (body && 'reset' in body && typeof body.reset === 'function') {
        body.reset(x, y);
      }
    });
  }

  private flushEnemyLiveness(encounter: RuntimeEncounter): void {
    encounter.aliveEnemies.forEach((enemy) => {
      if (!enemy.active) {
        encounter.aliveEnemies.delete(enemy);
      }
    });
  }

  private getGroupCenter(): Phaser.Math.Vector2 | undefined {
    const activePlayers = this.players
      .map((player) => player as unknown as { x?: number; y?: number; active?: boolean })
      .filter((player) => (player.active ?? true) && typeof player.x === 'number' && typeof player.y === 'number');

    if (activePlayers.length === 0) {
      return undefined;
    }

    const center = activePlayers.reduce<{ x: number; y: number }>((acc, player) => {
      acc.x += player.x as number;
      acc.y += player.y as number;
      return acc;
    }, { x: 0, y: 0 });

    return new Phaser.Math.Vector2(center.x / activePlayers.length, center.y / activePlayers.length);
  }

  private setTriggerEnabled(trigger: Phaser.GameObjects.Zone, enabled: boolean): void {
    const body = trigger.body as Phaser.Physics.Arcade.StaticBody | undefined;
    if (body) {
      body.enable = enabled;
    }

    trigger.setActive(enabled).setVisible(false);
  }

  private validateConfig(config: FlankingEscapeCombatConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('FlankingEscapeCombatSystem: levelId es obligatorio.');
    }

    if (config.combatSystemId.trim().length === 0) {
      throw new Error('FlankingEscapeCombatSystem: combatSystemId es obligatorio.');
    }

    if (config.encounters.length === 0) {
      throw new Error('FlankingEscapeCombatSystem: encounters no puede estar vacío.');
    }

    const encounterIds = new Set<string>();
    config.encounters.forEach((encounter, encounterIndex) => {
      if (encounterIds.has(encounter.id)) {
        throw new Error(`FlankingEscapeCombatSystem: encounter id duplicado "${encounter.id}".`);
      }
      encounterIds.add(encounter.id);

      if (encounter.waves.length === 0) {
        throw new Error(`FlankingEscapeCombatSystem: encounters[${encounterIndex}] requiere waves.`);
      }

      if (encounter.spawnPoints.length === 0) {
        throw new Error(`FlankingEscapeCombatSystem: encounters[${encounterIndex}] requiere spawnPoints.`);
      }

      const spawnPointIds = new Set(encounter.spawnPoints.map((spawnPoint) => spawnPoint.id));

      encounter.waves.forEach((wave, waveIndex) => {
        if (wave.enemies.length === 0) {
          throw new Error(
            `FlankingEscapeCombatSystem: encounters[${encounterIndex}].waves[${waveIndex}] requiere enemies.`
          );
        }

        wave.enemies.forEach((enemyBatch, batchIndex) => {
          if (enemyBatch.count <= 0) {
            throw new Error(
              `FlankingEscapeCombatSystem: encounters[${encounterIndex}].waves[${waveIndex}].enemies[${batchIndex}] count debe ser > 0.`
            );
          }

          (enemyBatch.spawnPointIds ?? []).forEach((spawnPointId) => {
            if (!spawnPointIds.has(spawnPointId)) {
              throw new Error(
                `FlankingEscapeCombatSystem: spawnPointId desconocido "${spawnPointId}" en encounter "${encounter.id}".`
              );
            }
          });

          (enemyBatch.dynamicSpawn?.fallbackSpawnPointIds ?? []).forEach((spawnPointId) => {
            if (!spawnPointIds.has(spawnPointId)) {
              throw new Error(
                `FlankingEscapeCombatSystem: fallbackSpawnPointId desconocido "${spawnPointId}" en encounter "${encounter.id}".`
              );
            }
          });
        });
      });
    });
  }
}
