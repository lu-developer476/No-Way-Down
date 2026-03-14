import Phaser from 'phaser';
import { Zombie } from '../entities/Zombie';
import { ZombieSystem } from './ZombieSystem';

export type Level8FinalSiegeState = 'idle' | 'active' | 'completed';
export type Level8SpawnMode = 'waves' | 'compact_group';

export interface Level8SiegeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Level8SiegeSpawnPoint {
  id: string;
  x: number;
  y: number;
  lane?: 'hall' | 'stairs' | 'lobby' | 'door';
}

export interface Level8SiegeWaveEnemyConfig {
  enemyType?: 'zombie';
  count: number;
  spawnPointIds: string[];
  spawnIntervalMs?: number;
}

export interface Level8SiegeWaveConfig {
  id: string;
  label: string;
  enemies: Level8SiegeWaveEnemyConfig[];
}

export interface Level8CompactGroupConfig {
  totalEnemies: number;
  spawnPointIds: string[];
  spawnIntervalMs?: number;
}

export interface Level8UrgencyTimerConfig {
  enabled: boolean;
  durationMs: number;
  warningEveryMs: number;
  hintOnStart?: string;
  hintOnWarning?: string;
  hintOnExpired?: string;
  spawnReinforcementOnExpire?: {
    enabled: boolean;
    wave: Level8SiegeWaveConfig;
  };
}

export interface Level8FinalSiegeConfig {
  levelId: string;
  siegeId: string;
  requiredToCompleteLevel: boolean;
  reunionCinematicId: string;
  trigger: Level8SiegeBounds;
  combatArea: Level8SiegeBounds;
  spawnMode: Level8SpawnMode;
  blockProgressionDuringSiege: boolean;
  blockers: Array<{ id: string; bounds: Level8SiegeBounds }>;
  maxAliveEnemies: number;
  spawnTickMs: number;
  spawnPoints: Level8SiegeSpawnPoint[];
  compactGroup?: Level8CompactGroupConfig;
  waves?: Level8SiegeWaveConfig[];
  urgencyTimer: Level8UrgencyTimerConfig;
}

export interface Level8FinalSiegeCallbacks {
  onSiegeReady?: (payload: { siegeId: string; requiredToCompleteLevel: boolean }) => void;
  onSiegeStarted?: (payload: { siegeId: string; spawnMode: Level8SpawnMode }) => void;
  onWaveStarted?: (payload: { siegeId: string; waveId: string; waveIndex: number; totalWaves: number }) => void;
  onWaveCompleted?: (payload: { siegeId: string; waveId: string; waveIndex: number; totalWaves: number }) => void;
  onUrgencyTick?: (payload: { siegeId: string; remainingMs: number; expired: boolean }) => void;
  onHint?: (message: string) => void;
  onProgressionBlocked?: (payload: { siegeId: string; blocked: boolean }) => void;
  onReunionCinematicUnlocked?: (payload: { siegeId: string; cinematicId: string }) => void;
  onSiegeCompleted?: (snapshot: Level8FinalSiegeSnapshot) => void;
}

export interface Level8FinalSiegeSnapshot {
  levelId: string;
  siegeId: string;
  state: Level8FinalSiegeState;
  requiredToCompleteLevel: boolean;
  spawnMode: Level8SpawnMode;
  completedWaves: number;
  totalWaves: number;
  pendingEnemies: number;
  aliveEnemies: number;
  urgencyTimerEnabled: boolean;
  urgencyRemainingMs: number;
  urgencyExpired: boolean;
  reunionCinematicUnlocked: boolean;
}

interface RuntimeEnemyRequest {
  enemyType: 'zombie';
  waveId: string;
  spawnPoint: Level8SiegeSpawnPoint;
  delayMs: number;
}

const DEFAULT_SPAWN_INTERVAL_MS = 250;

export class Level8FinalSiegeSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly zombieSystem: ZombieSystem;
  private readonly config: Level8FinalSiegeConfig;
  private readonly callbacks: Level8FinalSiegeCallbacks;

  private readonly spawnPointById: Map<string, Level8SiegeSpawnPoint>;
  private readonly blockers: Phaser.GameObjects.Rectangle[];
  private readonly aliveEnemies = new Set<Zombie>();

  private triggerZone: Phaser.GameObjects.Zone;
  private state: Level8FinalSiegeState = 'idle';

  private queue: RuntimeEnemyRequest[] = [];
  private activeWaveIndex = -1;
  private startedAtMs = 0;
  private nextSpawnAtMs = 0;
  private nextUrgencyTickAtMs = 0;
  private urgencyExpired = false;
  private reinforcementSpawned = false;
  private reunionUnlocked = false;

  static fromJson(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    zombieSystem: ZombieSystem,
    config: Level8FinalSiegeConfig,
    callbacks: Level8FinalSiegeCallbacks = {}
  ): Level8FinalSiegeSystem {
    return new Level8FinalSiegeSystem(scene, players, zombieSystem, config, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    zombieSystem: ZombieSystem,
    config: Level8FinalSiegeConfig,
    callbacks: Level8FinalSiegeCallbacks = {}
  ) {
    this.scene = scene;
    this.players = players;
    this.zombieSystem = zombieSystem;
    this.config = config;
    this.callbacks = callbacks;

    this.validateConfig(config);

    this.spawnPointById = new Map(config.spawnPoints.map((spawnPoint) => [spawnPoint.id, spawnPoint]));
    this.triggerZone = this.createZone(config.trigger);
    this.blockers = this.createBlockers(config.blockers);

    this.bindActivation();
    this.setProgressionBlocked(false);

    this.callbacks.onSiegeReady?.({
      siegeId: config.siegeId,
      requiredToCompleteLevel: config.requiredToCompleteLevel
    });
  }

  update(): void {
    if (this.state !== 'active') {
      return;
    }

    this.flushEnemyLiveness();
    this.handleUrgencyTimer();
    this.trySpawnFromQueue();
    this.tryResolveProgress();
  }

  destroy(): void {
    this.triggerZone.destroy();
    this.blockers.forEach((blocker) => blocker.destroy());
    this.aliveEnemies.clear();
    this.queue = [];
  }

  triggerByScript(): void {
    if (this.state !== 'idle') {
      return;
    }

    this.startSiege();
  }

  isCompleted(): boolean {
    return this.state === 'completed';
  }

  getSnapshot(): Level8FinalSiegeSnapshot {
    const totalWaves = this.resolveWaves().length;

    return {
      levelId: this.config.levelId,
      siegeId: this.config.siegeId,
      state: this.state,
      requiredToCompleteLevel: this.config.requiredToCompleteLevel,
      spawnMode: this.config.spawnMode,
      completedWaves: this.activeWaveIndex < 0 ? 0 : this.activeWaveIndex,
      totalWaves,
      pendingEnemies: this.queue.length,
      aliveEnemies: this.aliveEnemies.size,
      urgencyTimerEnabled: this.config.urgencyTimer.enabled,
      urgencyRemainingMs: this.getUrgencyRemainingMs(),
      urgencyExpired: this.urgencyExpired,
      reunionCinematicUnlocked: this.reunionUnlocked
    };
  }

  private createZone(bounds: Level8SiegeBounds): Phaser.GameObjects.Zone {
    const zone = this.scene.add.zone(bounds.x, bounds.y, bounds.width, bounds.height);
    this.scene.physics.add.existing(zone, true);
    return zone;
  }

  private createBlockers(blockers: Array<{ id: string; bounds: Level8SiegeBounds }>): Phaser.GameObjects.Rectangle[] {
    return blockers.map((blockerConfig) => {
      const blocker = this.scene.add.rectangle(
        blockerConfig.bounds.x,
        blockerConfig.bounds.y,
        blockerConfig.bounds.width,
        blockerConfig.bounds.height,
        0xb91c1c,
        0.12
      );

      blocker.setVisible(false);
      blocker.setActive(false);
      blocker.setName(blockerConfig.id);
      this.scene.physics.add.existing(blocker, true);

      this.players.forEach((player) => {
        this.scene.physics.add.collider(player, blocker);
      });

      return blocker;
    });
  }

  private bindActivation(): void {
    this.players.forEach((player) => {
      this.scene.physics.add.overlap(player, this.triggerZone, () => {
        this.startSiege();
      });
    });
  }

  private startSiege(): void {
    if (this.state !== 'idle') {
      return;
    }

    this.state = 'active';
    this.startedAtMs = this.scene.time.now;
    this.nextSpawnAtMs = this.scene.time.now;
    this.nextUrgencyTickAtMs = this.scene.time.now;
    this.queue = [];
    this.activeWaveIndex = -1;

    this.setZoneEnabled(this.triggerZone, false);

    if (this.config.blockProgressionDuringSiege) {
      this.setProgressionBlocked(true);
    }

    if (this.config.urgencyTimer.enabled && this.config.urgencyTimer.hintOnStart) {
      this.callbacks.onHint?.(this.config.urgencyTimer.hintOnStart);
    }

    this.callbacks.onSiegeStarted?.({
      siegeId: this.config.siegeId,
      spawnMode: this.config.spawnMode
    });

    this.startNextWave();
  }

  private startNextWave(): void {
    this.activeWaveIndex += 1;

    const waves = this.resolveWaves();
    if (this.activeWaveIndex >= waves.length) {
      this.completeSiege();
      return;
    }

    const wave = waves[this.activeWaveIndex];
    this.queue = this.buildSpawnQueueForWave(wave);
    this.nextSpawnAtMs = this.scene.time.now;

    this.callbacks.onWaveStarted?.({
      siegeId: this.config.siegeId,
      waveId: wave.id,
      waveIndex: this.activeWaveIndex,
      totalWaves: waves.length
    });
  }

  private resolveWaves(): Level8SiegeWaveConfig[] {
    if (this.config.spawnMode === 'waves') {
      return this.config.waves ?? [];
    }

    const compact = this.config.compactGroup;
    if (!compact) {
      return [];
    }

    return [
      {
        id: 'compact-group',
        label: 'Asalto compacto en puerta',
        enemies: [
          {
            enemyType: 'zombie',
            count: compact.totalEnemies,
            spawnPointIds: compact.spawnPointIds,
            spawnIntervalMs: compact.spawnIntervalMs
          }
        ]
      }
    ];
  }

  private buildSpawnQueueForWave(wave: Level8SiegeWaveConfig): RuntimeEnemyRequest[] {
    const queue: RuntimeEnemyRequest[] = [];

    wave.enemies.forEach((enemyConfig) => {
      const points = enemyConfig.spawnPointIds.map((id) => {
        const spawnPoint = this.spawnPointById.get(id);
        if (!spawnPoint) {
          throw new Error(`Level8FinalSiegeSystem: spawnPointId desconocido "${id}" en wave ${wave.id}.`);
        }

        return spawnPoint;
      });

      for (let i = 0; i < enemyConfig.count; i += 1) {
        queue.push({
          enemyType: enemyConfig.enemyType ?? 'zombie',
          waveId: wave.id,
          spawnPoint: points[i % points.length],
          delayMs: enemyConfig.spawnIntervalMs ?? DEFAULT_SPAWN_INTERVAL_MS
        });
      }
    });

    return queue;
  }

  private handleUrgencyTimer(): void {
    if (!this.config.urgencyTimer.enabled) {
      return;
    }

    const remainingMs = this.getUrgencyRemainingMs();
    const now = this.scene.time.now;

    if (now >= this.nextUrgencyTickAtMs) {
      this.callbacks.onUrgencyTick?.({
        siegeId: this.config.siegeId,
        remainingMs,
        expired: this.urgencyExpired
      });

      if (!this.urgencyExpired && this.config.urgencyTimer.hintOnWarning) {
        this.callbacks.onHint?.(this.config.urgencyTimer.hintOnWarning.replace('{seconds}', String(Math.ceil(remainingMs / 1000))));
      }

      this.nextUrgencyTickAtMs = now + Math.max(300, this.config.urgencyTimer.warningEveryMs);
    }

    if (!this.urgencyExpired && remainingMs <= 0) {
      this.urgencyExpired = true;
      if (this.config.urgencyTimer.hintOnExpired) {
        this.callbacks.onHint?.(this.config.urgencyTimer.hintOnExpired);
      }

      const reinforcement = this.config.urgencyTimer.spawnReinforcementOnExpire;
      if (reinforcement?.enabled && !this.reinforcementSpawned) {
        const reinforcementQueue = this.buildSpawnQueueForWave(reinforcement.wave);
        this.queue.push(...reinforcementQueue);
        this.reinforcementSpawned = true;
      }
    }
  }

  private getUrgencyRemainingMs(): number {
    if (!this.config.urgencyTimer.enabled || this.state === 'idle') {
      return this.config.urgencyTimer.durationMs;
    }

    return Math.max(0, this.config.urgencyTimer.durationMs - (this.scene.time.now - this.startedAtMs));
  }

  private trySpawnFromQueue(): void {
    if (this.queue.length === 0) {
      return;
    }

    if (this.scene.time.now < this.nextSpawnAtMs) {
      return;
    }

    if (this.aliveEnemies.size >= Math.max(1, this.config.maxAliveEnemies)) {
      this.nextSpawnAtMs = this.scene.time.now + this.config.spawnTickMs;
      return;
    }

    const request = this.queue.shift();
    if (!request) {
      return;
    }

    if (request.enemyType !== 'zombie') {
      this.nextSpawnAtMs = this.scene.time.now + request.delayMs;
      return;
    }

    const zombie = this.zombieSystem.spawn(request.spawnPoint.x, request.spawnPoint.y);
    if (zombie) {
      this.aliveEnemies.add(zombie);
    }

    this.nextSpawnAtMs = this.scene.time.now + request.delayMs;
  }

  private tryResolveProgress(): void {
    if (this.queue.length > 0 || this.aliveEnemies.size > 0) {
      return;
    }

    const waves = this.resolveWaves();
    const currentWave = waves[this.activeWaveIndex];

    if (currentWave) {
      this.callbacks.onWaveCompleted?.({
        siegeId: this.config.siegeId,
        waveId: currentWave.id,
        waveIndex: this.activeWaveIndex,
        totalWaves: waves.length
      });
    }

    this.startNextWave();
  }

  private completeSiege(): void {
    this.state = 'completed';
    this.setProgressionBlocked(false);

    this.reunionUnlocked = true;
    this.callbacks.onReunionCinematicUnlocked?.({
      siegeId: this.config.siegeId,
      cinematicId: this.config.reunionCinematicId
    });

    this.callbacks.onSiegeCompleted?.(this.getSnapshot());
  }

  private flushEnemyLiveness(): void {
    this.aliveEnemies.forEach((enemy) => {
      if (!enemy.active) {
        this.aliveEnemies.delete(enemy);
      }
    });
  }

  private setProgressionBlocked(blocked: boolean): void {
    this.blockers.forEach((blocker) => {
      blocker.setVisible(false);
      blocker.setActive(blocked);
      const body = blocker.body as Phaser.Physics.Arcade.StaticBody | undefined;
      if (body) {
        body.enable = blocked;
      }
    });

    this.callbacks.onProgressionBlocked?.({
      siegeId: this.config.siegeId,
      blocked
    });
  }

  private setZoneEnabled(zone: Phaser.GameObjects.Zone, enabled: boolean): void {
    const body = zone.body as Phaser.Physics.Arcade.StaticBody | undefined;
    if (body) {
      body.enable = enabled;
    }

    zone.setActive(enabled).setVisible(false);
  }

  private validateConfig(config: Level8FinalSiegeConfig): void {
    if (!config.levelId.trim()) {
      throw new Error('Level8FinalSiegeSystem: levelId es obligatorio.');
    }

    if (!config.siegeId.trim()) {
      throw new Error('Level8FinalSiegeSystem: siegeId es obligatorio.');
    }

    if (!config.reunionCinematicId.trim()) {
      throw new Error('Level8FinalSiegeSystem: reunionCinematicId es obligatorio.');
    }

    if (config.spawnPoints.length === 0) {
      throw new Error('Level8FinalSiegeSystem: spawnPoints no puede estar vacío.');
    }

    if (config.maxAliveEnemies <= 0) {
      throw new Error('Level8FinalSiegeSystem: maxAliveEnemies debe ser > 0.');
    }

    if (config.spawnMode === 'waves' && (!config.waves || config.waves.length === 0)) {
      throw new Error('Level8FinalSiegeSystem: se requiere waves cuando spawnMode="waves".');
    }

    if (config.spawnMode === 'compact_group' && !config.compactGroup) {
      throw new Error('Level8FinalSiegeSystem: se requiere compactGroup cuando spawnMode="compact_group".');
    }

    if (config.urgencyTimer.enabled && config.urgencyTimer.durationMs <= 0) {
      throw new Error('Level8FinalSiegeSystem: urgencyTimer.durationMs debe ser > 0 si está habilitado.');
    }
  }
}
