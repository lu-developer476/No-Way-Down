import Phaser from 'phaser';
import { Player } from '../entities/Player';

export type MixedSpawnSourceId =
  | 'stairs_top'
  | 'stairs_bottom'
  | 'side_doors'
  | 'upper_floor_ends';

export interface MixedSpawnPoint {
  id: string;
  x: number;
  y: number;
}

export interface MixedSpawnWeightedSource {
  source: MixedSpawnSourceId;
  weight?: number;
}

export interface MixedSpawnWaveConfig {
  id: string;
  totalZombies: number;
  spawnIntervalMs: number;
  maxAlive?: number;
  sources: MixedSpawnWeightedSource[];
}

export interface MixedSpawnSystemConfig {
  minPlayerDistance: number;
  unsafePlayerDistance: number;
  retryDelayMs: number;
  pointsBySource: Record<MixedSpawnSourceId, MixedSpawnPoint[]>;
}

export interface MixedSpawnJsonConfig {
  mixedSpawns: {
    minPlayerDistance: number;
    unsafePlayerDistance: number;
    retryDelayMs?: number;
    pointsBySource: Record<MixedSpawnSourceId, MixedSpawnPoint[]>;
    zoneWaves?: Record<string, MixedSpawnWaveConfig[]>;
  };
}

export interface MixedSpawnCallbacks<TEnemyHandle> {
  spawnEnemy: (x: number, y: number, source: MixedSpawnSourceId, waveId: string) => TEnemyHandle | null;
  isEnemyAlive: (enemy: TEnemyHandle) => boolean;
  onWaveStarted?: (wave: MixedSpawnWaveConfig) => void;
  onWaveCompleted?: (wave: MixedSpawnWaveConfig) => void;
  onEncounterCompleted?: () => void;
}

interface RuntimeWave<TEnemyHandle> {
  config: MixedSpawnWaveConfig;
  spawned: number;
  alive: Set<TEnemyHandle>;
  nextSpawnAt: number;
}

const DEFAULT_RETRY_DELAY_MS = 250;

export class MixedSpawnSystem<TEnemyHandle> {
  private readonly scene: Phaser.Scene;
  private readonly players: Player[];
  private readonly config: MixedSpawnSystemConfig;
  private readonly callbacks: MixedSpawnCallbacks<TEnemyHandle>;
  private activeWaves: RuntimeWave<TEnemyHandle>[] = [];
  private activeWaveIndex = -1;
  private encounterInProgress = false;

  constructor(
    scene: Phaser.Scene,
    players: Player[],
    config: MixedSpawnSystemConfig,
    callbacks: MixedSpawnCallbacks<TEnemyHandle>
  ) {
    this.scene = scene;
    this.players = players;
    this.config = {
      ...config,
      retryDelayMs: config.retryDelayMs > 0 ? config.retryDelayMs : DEFAULT_RETRY_DELAY_MS
    };
    this.callbacks = callbacks;
  }

  static fromJson<TEnemyHandle>(
    scene: Phaser.Scene,
    players: Player[],
    jsonConfig: MixedSpawnJsonConfig,
    callbacks: MixedSpawnCallbacks<TEnemyHandle>
  ): MixedSpawnSystem<TEnemyHandle> {
    const config = jsonConfig.mixedSpawns;

    return new MixedSpawnSystem<TEnemyHandle>(
      scene,
      players,
      {
        minPlayerDistance: config.minPlayerDistance,
        unsafePlayerDistance: config.unsafePlayerDistance,
        retryDelayMs: config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
        pointsBySource: config.pointsBySource
      },
      callbacks
    );
  }

  startEncounter(waves: MixedSpawnWaveConfig[]): void {
    if (waves.length === 0) {
      this.encounterInProgress = false;
      this.activeWaves = [];
      this.activeWaveIndex = -1;
      return;
    }

    this.activeWaves = waves.map((wave) => ({
      config: wave,
      spawned: 0,
      alive: new Set<TEnemyHandle>(),
      nextSpawnAt: this.scene.time.now
    }));

    this.encounterInProgress = true;
    this.activeWaveIndex = 0;
    this.callbacks.onWaveStarted?.(this.activeWaves[0].config);
  }

  isEncounterInProgress(): boolean {
    return this.encounterInProgress;
  }

  update(currentTime: number): void {
    if (!this.encounterInProgress) {
      return;
    }

    const runtimeWave = this.activeWaves[this.activeWaveIndex];
    if (!runtimeWave) {
      this.finishEncounter();
      return;
    }

    this.cleanupInactive(runtimeWave);
    this.trySpawn(runtimeWave, currentTime);

    if (this.isWaveCompleted(runtimeWave)) {
      const completedWave = runtimeWave.config;
      this.callbacks.onWaveCompleted?.(completedWave);
      this.activeWaveIndex += 1;

      const nextWave = this.activeWaves[this.activeWaveIndex];
      if (nextWave) {
        nextWave.nextSpawnAt = currentTime;
        this.callbacks.onWaveStarted?.(nextWave.config);
      } else {
        this.finishEncounter();
      }
    }
  }

  private trySpawn(runtimeWave: RuntimeWave<TEnemyHandle>, currentTime: number): void {
    if (runtimeWave.spawned >= runtimeWave.config.totalZombies) {
      return;
    }

    if (currentTime < runtimeWave.nextSpawnAt) {
      return;
    }

    if (runtimeWave.config.maxAlive !== undefined && runtimeWave.alive.size >= runtimeWave.config.maxAlive) {
      runtimeWave.nextSpawnAt = currentTime + this.config.retryDelayMs;
      return;
    }

    const spawnPoint = this.pickSafeSpawnPoint(runtimeWave.config.sources);
    if (!spawnPoint) {
      runtimeWave.nextSpawnAt = currentTime + this.config.retryDelayMs;
      return;
    }

    const enemy = this.callbacks.spawnEnemy(
      spawnPoint.point.x,
      spawnPoint.point.y,
      spawnPoint.source,
      runtimeWave.config.id
    );

    runtimeWave.nextSpawnAt = currentTime + runtimeWave.config.spawnIntervalMs;

    if (!enemy) {
      return;
    }

    runtimeWave.alive.add(enemy);
    runtimeWave.spawned += 1;
  }

  private pickSafeSpawnPoint(
    weightedSources: MixedSpawnWeightedSource[]
  ): { source: MixedSpawnSourceId; point: MixedSpawnPoint } | null {
    const weightedPool = weightedSources.flatMap((entry) => {
      const weight = Math.max(1, Math.floor(entry.weight ?? 1));
      return Array.from({ length: weight }, () => entry.source);
    });

    if (weightedPool.length === 0) {
      return null;
    }

    const shuffledSources = Phaser.Utils.Array.Shuffle([...weightedPool]);

    for (const source of shuffledSources) {
      const points = this.config.pointsBySource[source];
      if (!points || points.length === 0) {
        continue;
      }

      const shuffledPoints = Phaser.Utils.Array.Shuffle([...points]);
      const safePoint = shuffledPoints.find((point) => this.isPointSafeForPlayers(point.x, point.y));

      if (safePoint) {
        return { source, point: safePoint };
      }
    }

    return null;
  }

  private isPointSafeForPlayers(x: number, y: number): boolean {
    const minDistanceSquared = this.config.minPlayerDistance * this.config.minPlayerDistance;
    const unsafeDistanceSquared = this.config.unsafePlayerDistance * this.config.unsafePlayerDistance;

    return this.players.every((player) => {
      const dx = player.x - x;
      const dy = player.y - y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared < unsafeDistanceSquared) {
        return false;
      }

      return distanceSquared >= minDistanceSquared;
    });
  }

  private cleanupInactive(runtimeWave: RuntimeWave<TEnemyHandle>): void {
    runtimeWave.alive.forEach((enemy) => {
      if (!this.callbacks.isEnemyAlive(enemy)) {
        runtimeWave.alive.delete(enemy);
      }
    });
  }

  private isWaveCompleted(runtimeWave: RuntimeWave<TEnemyHandle>): boolean {
    return runtimeWave.spawned >= runtimeWave.config.totalZombies && runtimeWave.alive.size === 0;
  }

  private finishEncounter(): void {
    this.encounterInProgress = false;
    this.activeWaves = [];
    this.activeWaveIndex = -1;
    this.callbacks.onEncounterCompleted?.();
  }
}
