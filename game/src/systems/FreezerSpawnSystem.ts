import Phaser from 'phaser';
import { Player } from '../entities/Player';

export interface FreezerDoorPosition {
  x: number;
  y: number;
}

export interface FreezerSpawnPoint {
  id: string;
  x: number;
  y: number;
}

export interface FreezerSpawnConfig {
  id: string;
  door: FreezerDoorPosition;
  spawnPoints: FreezerSpawnPoint[];
}

export interface FreezerSpawnWaveConfig {
  id: string;
  totalZombies: number;
  spawnIntervalMs: number;
  maxAlive?: number;
  enabledFreezers?: string[];
}

export interface FreezerSpawnSystemConfig {
  freezers: FreezerSpawnConfig[];
  minPlayerDistance: number;
  retryDelayMs: number;
}

export interface FreezerSpawnJsonConfig {
  freezerSpawns: {
    minPlayerDistance: number;
    retryDelayMs?: number;
    freezers: Array<{
      id: string;
      door: {
        x: number;
        y: number;
      };
      spawnPoints: Array<{
        id: string;
        x: number;
        y: number;
      }>;
    }>;
    waves?: FreezerSpawnWaveConfig[];
  };
}

export interface FreezerSpawnCallbacks<TEnemyHandle> {
  spawnEnemy: (x: number, y: number, freezerId: string, spawnPointId: string, waveId: string) => TEnemyHandle | null;
  isEnemyAlive: (enemy: TEnemyHandle) => boolean;
  onFreezerDoorOpened?: (freezer: FreezerSpawnConfig, wave: FreezerSpawnWaveConfig) => void;
  onWaveStarted?: (wave: FreezerSpawnWaveConfig) => void;
  onWaveCompleted?: (wave: FreezerSpawnWaveConfig) => void;
  onEncounterCompleted?: () => void;
}

interface RuntimeWave<TEnemyHandle> {
  config: FreezerSpawnWaveConfig;
  spawned: number;
  alive: Set<TEnemyHandle>;
  openedFreezers: Set<string>;
  nextSpawnAt: number;
}

interface FreezerSpawnChoice {
  freezer: FreezerSpawnConfig;
  point: FreezerSpawnPoint;
}

const DEFAULT_RETRY_DELAY_MS = 250;

export class FreezerSpawnSystem<TEnemyHandle> {
  private readonly scene: Phaser.Scene;
  private readonly players: Player[];
  private readonly config: FreezerSpawnSystemConfig;
  private readonly callbacks: FreezerSpawnCallbacks<TEnemyHandle>;
  private activeWaves: RuntimeWave<TEnemyHandle>[] = [];
  private activeWaveIndex = -1;
  private encounterInProgress = false;

  constructor(
    scene: Phaser.Scene,
    players: Player[],
    config: FreezerSpawnSystemConfig,
    callbacks: FreezerSpawnCallbacks<TEnemyHandle>
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
    jsonConfig: FreezerSpawnJsonConfig,
    callbacks: FreezerSpawnCallbacks<TEnemyHandle>
  ): FreezerSpawnSystem<TEnemyHandle> {
    const config = jsonConfig.freezerSpawns;

    return new FreezerSpawnSystem<TEnemyHandle>(
      scene,
      players,
      {
        freezers: config.freezers,
        minPlayerDistance: config.minPlayerDistance,
        retryDelayMs: config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
      },
      callbacks
    );
  }

  startEncounter(waves: FreezerSpawnWaveConfig[]): void {
    if (waves.length === 0) {
      this.finishEncounter();
      return;
    }

    this.activeWaves = waves.map((wave) => ({
      config: wave,
      spawned: 0,
      alive: new Set<TEnemyHandle>(),
      openedFreezers: new Set<string>(),
      nextSpawnAt: this.scene.time.now
    }));

    this.encounterInProgress = true;
    this.activeWaveIndex = 0;
    this.callbacks.onWaveStarted?.(this.activeWaves[0].config);
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

  isEncounterInProgress(): boolean {
    return this.encounterInProgress;
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

    const choice = this.pickSafeSpawn(runtimeWave.config.enabledFreezers);
    if (!choice) {
      runtimeWave.nextSpawnAt = currentTime + this.config.retryDelayMs;
      return;
    }

    if (!runtimeWave.openedFreezers.has(choice.freezer.id)) {
      this.callbacks.onFreezerDoorOpened?.(choice.freezer, runtimeWave.config);
      runtimeWave.openedFreezers.add(choice.freezer.id);
    }

    const enemy = this.callbacks.spawnEnemy(
      choice.point.x,
      choice.point.y,
      choice.freezer.id,
      choice.point.id,
      runtimeWave.config.id
    );

    runtimeWave.nextSpawnAt = currentTime + runtimeWave.config.spawnIntervalMs;

    if (!enemy) {
      return;
    }

    runtimeWave.spawned += 1;
    runtimeWave.alive.add(enemy);
  }

  private pickSafeSpawn(enabledFreezerIds?: string[]): FreezerSpawnChoice | null {
    const freezerFilter = enabledFreezerIds ? new Set(enabledFreezerIds) : null;

    const candidates = this.config.freezers.flatMap((freezer) => {
      if (freezerFilter && !freezerFilter.has(freezer.id)) {
        return [];
      }

      return freezer.spawnPoints.map((point) => ({
        freezer,
        point
      }));
    });

    if (candidates.length === 0) {
      return null;
    }

    const shuffledCandidates = Phaser.Utils.Array.Shuffle([...candidates]);
    return shuffledCandidates.find((candidate) => this.isFarEnoughFromPlayers(candidate.point.x, candidate.point.y)) ?? null;
  }

  private isFarEnoughFromPlayers(x: number, y: number): boolean {
    const minDistanceSquared = this.config.minPlayerDistance * this.config.minPlayerDistance;

    return this.players.every((player) => {
      const dx = player.x - x;
      const dy = player.y - y;
      return dx * dx + dy * dy >= minDistanceSquared;
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
