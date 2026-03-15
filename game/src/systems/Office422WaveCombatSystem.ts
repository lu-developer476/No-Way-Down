import Phaser from 'phaser';
import { Zombie } from '../entities/Zombie';
import { ZombieSystem } from './ZombieSystem';
import { CombatEventSystem } from './core/CombatEventSystem';

export type Office422CombatAreaType = 'closed' | 'semi_closed';
export type Office422CombatState = 'idle' | 'active' | 'completed';

export interface Office422RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Office422SpawnPointConfig {
  id: string;
  x: number;
  y: number;
  lane?: 'interior' | 'hallway' | 'door' | 'window';
}

export interface Office422WaveEnemyConfig {
  enemyType?: 'zombie';
  count: number;
  spawnPointIds: string[];
  spawnIntervalMs?: number;
}

export interface Office422WaveConfig {
  id: string;
  label: string;
  enemies: Office422WaveEnemyConfig[];
}

export interface Office422ReducedSpaceConfig {
  enabled: boolean;
  maxAliveEnemies: number;
  spawnTickMs: number;
}

export interface Office422WaveCombatConfig {
  levelId: string;
  combatId: string;
  area: {
    type: Office422CombatAreaType;
    bounds: Office422RectBounds;
  };
  trigger: Office422RectBounds;
  blockExitDuringCombat: boolean;
  exitBlockers: Array<{ id: string; bounds: Office422RectBounds }>;
  spawnPoints: Office422SpawnPointConfig[];
  waves: Office422WaveConfig[];
  reducedSpace: Office422ReducedSpaceConfig;
}

export interface Office422WaveCombatCallbacks {
  onCombatReady?: (context: { combatId: string; areaType: Office422CombatAreaType }) => void;
  onCombatStarted?: (context: { combatId: string; triggeredBy: 'rescue' | 'zone' | 'script' }) => void;
  onWaveStarted?: (payload: { combatId: string; waveId: string; waveIndex: number; totalWaves: number }) => void;
  onWaveCompleted?: (payload: { combatId: string; waveId: string; waveIndex: number; totalWaves: number }) => void;
  onExitStateChanged?: (payload: { combatId: string; blocked: boolean }) => void;
  onCombatCompleted?: (payload: { combatId: string; state: Office422WaveCombatSnapshot }) => void;
}

export interface Office422WaveCombatSnapshot {
  levelId: string;
  combatId: string;
  state: Office422CombatState;
  startedByRescue: boolean;
  activeWaveIndex: number;
  completedWaves: number;
  totalWaves: number;
  pendingEnemies: number;
  aliveEnemies: number;
  exitUnlocked: boolean;
}

interface RuntimeEnemyRequest {
  waveId: string;
  enemyType: 'zombie';
  spawnPoint: Office422SpawnPointConfig;
  delayMs: number;
}

const DEFAULT_SPAWN_INTERVAL_MS = 280;
const MIN_REDUCED_SPACE_CAP = 1;

export class Office422WaveCombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly zombieSystem: ZombieSystem;
  private readonly config: Office422WaveCombatConfig;
  private readonly callbacks: Office422WaveCombatCallbacks;

  private readonly spawnPointById: Map<string, Office422SpawnPointConfig>;
  private readonly exitBlockers: Phaser.GameObjects.Rectangle[];
  private readonly aliveEnemies = new Set<Zombie>();
  private readonly coreCombatEvents: CombatEventSystem;

  private triggerZone: Phaser.GameObjects.Zone;
  private state: Office422CombatState = 'idle';
  private startedByRescue = false;
  private activeWaveIndex = -1;
  private pendingSpawnQueue: RuntimeEnemyRequest[] = [];
  private nextSpawnAt = 0;

  static fromJson(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    zombieSystem: ZombieSystem,
    config: Office422WaveCombatConfig,
    callbacks: Office422WaveCombatCallbacks = {}
  ): Office422WaveCombatSystem {
    return new Office422WaveCombatSystem(scene, players, zombieSystem, config, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    zombieSystem: ZombieSystem,
    config: Office422WaveCombatConfig,
    callbacks: Office422WaveCombatCallbacks = {}
  ) {
    this.scene = scene;
    this.players = players;
    this.zombieSystem = zombieSystem;
    this.config = config;
    this.callbacks = callbacks;

    this.validateConfig(config);

    this.spawnPointById = new Map(config.spawnPoints.map((spawnPoint) => [spawnPoint.id, spawnPoint]));
    this.coreCombatEvents = new CombatEventSystem([config.combatId]);
    this.triggerZone = this.createTriggerZone(config.trigger);
    this.exitBlockers = this.createExitBlockers(config.exitBlockers);

    this.bindTriggerActivation();
    this.setExitBlocked(false);

    this.callbacks.onCombatReady?.({
      combatId: this.config.combatId,
      areaType: this.config.area.type
    });
  }

  update(): void {
    if (this.state !== 'active') {
      return;
    }

    this.flushEnemyLiveness();
    this.trySpawnFromQueue();
    this.tryResolveCurrentWave();
  }

  destroy(): void {
    this.triggerZone.destroy();
    this.exitBlockers.forEach((blocker) => blocker.destroy());
    this.aliveEnemies.clear();
    this.pendingSpawnQueue = [];
  }

  isCompleted(): boolean {
    return this.state === 'completed';
  }

  getSnapshot(): Office422WaveCombatSnapshot {
    return {
      levelId: this.config.levelId,
      combatId: this.config.combatId,
      state: this.state,
      startedByRescue: this.startedByRescue,
      activeWaveIndex: this.activeWaveIndex,
      completedWaves: this.activeWaveIndex < 0 ? 0 : this.activeWaveIndex,
      totalWaves: this.config.waves.length,
      pendingEnemies: this.pendingSpawnQueue.length,
      aliveEnemies: this.aliveEnemies.size,
      exitUnlocked: this.state === 'completed'
    };
  }

  startAfterRescue(): void {
    if (this.state !== 'idle') {
      return;
    }

    this.startedByRescue = true;
    this.startCombat('rescue');
  }

  triggerByScript(): void {
    if (this.state !== 'idle') {
      return;
    }

    this.startCombat('script');
  }

  private createTriggerZone(trigger: Office422RectBounds): Phaser.GameObjects.Zone {
    const zone = this.scene.add.zone(trigger.x, trigger.y, trigger.width, trigger.height);
    this.scene.physics.add.existing(zone, true);
    return zone;
  }

  private createExitBlockers(blockers: Array<{ id: string; bounds: Office422RectBounds }>): Phaser.GameObjects.Rectangle[] {
    return blockers.map((blockerConfig) => {
      const blocker = this.scene.add.rectangle(
        blockerConfig.bounds.x,
        blockerConfig.bounds.y,
        blockerConfig.bounds.width,
        blockerConfig.bounds.height,
        0xdc2626,
        0.15
      );

      blocker.setName(blockerConfig.id);
      blocker.setVisible(false);
      this.scene.physics.add.existing(blocker, true);

      this.players.forEach((player) => {
        this.scene.physics.add.collider(player, blocker);
      });

      return blocker;
    });
  }

  private bindTriggerActivation(): void {
    this.players.forEach((player) => {
      this.scene.physics.add.overlap(player, this.triggerZone, () => {
        if (this.startedByRescue || this.state !== 'idle') {
          return;
        }

        this.startCombat('zone');
      });
    });
  }

  private startCombat(triggeredBy: 'rescue' | 'zone' | 'script'): void {
    this.state = 'active';
    this.activeWaveIndex = -1;
    this.pendingSpawnQueue = [];
    this.nextSpawnAt = this.scene.time.now;

    this.setTriggerEnabled(false);

    if (this.config.blockExitDuringCombat) {
      this.setExitBlocked(true);
    }

    this.coreCombatEvents.applyEvent({ type: 'zone-activated', zoneId: this.config.combatId });
    this.callbacks.onCombatStarted?.({ combatId: this.config.combatId, triggeredBy });
    this.startNextWave();
  }

  private startNextWave(): void {
    this.activeWaveIndex += 1;

    if (this.activeWaveIndex >= this.config.waves.length) {
      this.completeCombat();
      return;
    }

    const wave = this.config.waves[this.activeWaveIndex];
    this.pendingSpawnQueue = this.buildWaveSpawnQueue(wave);
    this.nextSpawnAt = this.scene.time.now;

    this.coreCombatEvents.applyEvent({ type: 'wave-started', zoneId: this.config.combatId, waveId: wave.id });
    this.callbacks.onWaveStarted?.({
      combatId: this.config.combatId,
      waveId: wave.id,
      waveIndex: this.activeWaveIndex,
      totalWaves: this.config.waves.length
    });
  }

  private buildWaveSpawnQueue(wave: Office422WaveConfig): RuntimeEnemyRequest[] {
    const queue: RuntimeEnemyRequest[] = [];

    wave.enemies.forEach((enemyConfig) => {
      const spawnPoints = enemyConfig.spawnPointIds.map((spawnPointId) => {
        const spawnPoint = this.spawnPointById.get(spawnPointId);
        if (!spawnPoint) {
          throw new Error(`Office422WaveCombatSystem: spawnPointId desconocido "${spawnPointId}" en wave ${wave.id}.`);
        }

        return spawnPoint;
      });

      for (let index = 0; index < enemyConfig.count; index += 1) {
        queue.push({
          waveId: wave.id,
          enemyType: enemyConfig.enemyType ?? 'zombie',
          spawnPoint: spawnPoints[index % spawnPoints.length],
          delayMs: enemyConfig.spawnIntervalMs ?? DEFAULT_SPAWN_INTERVAL_MS
        });
      }
    });

    return queue;
  }

  private trySpawnFromQueue(): void {
    if (this.pendingSpawnQueue.length === 0) {
      return;
    }

    if (this.scene.time.now < this.nextSpawnAt) {
      return;
    }

    const maxAliveEnemies = this.config.reducedSpace.enabled
      ? Math.max(MIN_REDUCED_SPACE_CAP, this.config.reducedSpace.maxAliveEnemies)
      : Number.POSITIVE_INFINITY;

    if (this.aliveEnemies.size >= maxAliveEnemies) {
      this.nextSpawnAt = this.scene.time.now + this.config.reducedSpace.spawnTickMs;
      return;
    }

    const spawnRequest = this.pendingSpawnQueue.shift();
    if (!spawnRequest) {
      return;
    }

    if (spawnRequest.enemyType !== 'zombie') {
      this.nextSpawnAt = this.scene.time.now + spawnRequest.delayMs;
      return;
    }

    const spawnedZombie = this.zombieSystem.spawn(spawnRequest.spawnPoint.x, spawnRequest.spawnPoint.y);
    if (spawnedZombie) {
      this.aliveEnemies.add(spawnedZombie);
    }

    this.nextSpawnAt = this.scene.time.now + spawnRequest.delayMs;
  }

  private tryResolveCurrentWave(): void {
    if (this.pendingSpawnQueue.length > 0 || this.aliveEnemies.size > 0) {
      return;
    }

    const wave = this.config.waves[this.activeWaveIndex];

    this.callbacks.onWaveCompleted?.({
      combatId: this.config.combatId,
      waveId: wave.id,
      waveIndex: this.activeWaveIndex,
      totalWaves: this.config.waves.length
    });

    this.startNextWave();
  }

  private completeCombat(): void {
    this.state = 'completed';
    this.setExitBlocked(false);

    this.callbacks.onCombatCompleted?.({
      combatId: this.config.combatId,
      state: this.getSnapshot()
    });
  }

  private flushEnemyLiveness(): void {
    this.aliveEnemies.forEach((enemy) => {
      if (!enemy.active) {
        this.aliveEnemies.delete(enemy);
      }
    });
  }

  private setExitBlocked(blocked: boolean): void {
    this.exitBlockers.forEach((blocker) => {
      blocker.setVisible(false);
      const body = blocker.body as Phaser.Physics.Arcade.StaticBody | undefined;
      if (body) {
        body.enable = blocked;
      }
      blocker.setActive(blocked);
    });

    this.callbacks.onExitStateChanged?.({
      combatId: this.config.combatId,
      blocked
    });
  }

  private setTriggerEnabled(enabled: boolean): void {
    const body = this.triggerZone.body as Phaser.Physics.Arcade.StaticBody | undefined;
    if (body) {
      body.enable = enabled;
    }

    this.triggerZone.setActive(enabled).setVisible(false);
  }

  private validateConfig(config: Office422WaveCombatConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Office422WaveCombatSystem: levelId es obligatorio.');
    }

    if (config.combatId.trim().length === 0) {
      throw new Error('Office422WaveCombatSystem: combatId es obligatorio.');
    }

    if (config.waves.length === 0) {
      throw new Error('Office422WaveCombatSystem: waves no puede estar vacío.');
    }

    if (config.spawnPoints.length === 0) {
      throw new Error('Office422WaveCombatSystem: spawnPoints no puede estar vacío.');
    }

    if (config.reducedSpace.maxAliveEnemies <= 0) {
      throw new Error('Office422WaveCombatSystem: reducedSpace.maxAliveEnemies debe ser mayor a 0.');
    }

    config.waves.forEach((wave, waveIndex) => {
      if (wave.id.trim().length === 0) {
        throw new Error(`Office422WaveCombatSystem: waves[${waveIndex}] requiere id.`);
      }

      if (wave.enemies.length === 0) {
        throw new Error(`Office422WaveCombatSystem: waves[${waveIndex}] debe definir enemies.`);
      }

      wave.enemies.forEach((enemy, enemyIndex) => {
        if (enemy.count <= 0) {
          throw new Error(`Office422WaveCombatSystem: waves[${waveIndex}].enemies[${enemyIndex}] count debe ser > 0.`);
        }

        if (enemy.spawnPointIds.length === 0) {
          throw new Error(`Office422WaveCombatSystem: waves[${waveIndex}].enemies[${enemyIndex}] requiere spawnPointIds.`);
        }
      });
    });
  }
}
