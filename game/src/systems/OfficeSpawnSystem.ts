import Phaser from 'phaser';
import { Player } from '../entities/Player';

export interface OfficeDoorSpawnPoint {
  id: string;
  x: number;
  y: number;
}

export interface OfficeSpawnConfig {
  id: string;
  doors: OfficeDoorSpawnPoint[];
}

export interface OfficeSpawnWaveConfig {
  id: string;
  totalZombies: number;
  spawnIntervalMs: number;
  maxAlive?: number;
  enabledOffices?: string[];
}

export interface OfficeSpawnSystemConfig {
  offices: OfficeSpawnConfig[];
  minPlayerDistance: number;
  retryDelayMs: number;
}

export interface OfficeSpawnJsonConfig {
  officeSpawns: {
    minPlayerDistance: number;
    retryDelayMs?: number;
    offices: Array<{
      id: string;
      doors: Array<{
        id: string;
        x: number;
        y: number;
      }>;
    }>;
    waves?: OfficeSpawnWaveConfig[];
  };
}

export interface OfficeSpawnCallbacks<TEnemyHandle> {
  spawnEnemy: (x: number, y: number, officeId: string, doorId: string, waveId: string) => TEnemyHandle | null;
  isEnemyAlive: (enemy: TEnemyHandle) => boolean;
  onWaveStarted?: (wave: OfficeSpawnWaveConfig) => void;
  onWaveCompleted?: (wave: OfficeSpawnWaveConfig) => void;
  onEncounterCompleted?: () => void;
}

interface RuntimeWave<TEnemyHandle> {
  config: OfficeSpawnWaveConfig;
  spawned: number;
  alive: Set<TEnemyHandle>;
  nextSpawnAt: number;
}

interface OfficeDoorChoice {
  officeId: string;
  door: OfficeDoorSpawnPoint;
}

const DEFAULT_RETRY_DELAY_MS = 250;

export class OfficeSpawnSystem<TEnemyHandle> {
  private readonly scene: Phaser.Scene;
  private readonly players: Player[];
  private readonly config: OfficeSpawnSystemConfig;
  private readonly callbacks: OfficeSpawnCallbacks<TEnemyHandle>;
  private activeWaves: RuntimeWave<TEnemyHandle>[] = [];
  private activeWaveIndex = -1;
  private encounterInProgress = false;

  constructor(
    scene: Phaser.Scene,
    players: Player[],
    config: OfficeSpawnSystemConfig,
    callbacks: OfficeSpawnCallbacks<TEnemyHandle>
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
    jsonConfig: OfficeSpawnJsonConfig,
    callbacks: OfficeSpawnCallbacks<TEnemyHandle>
  ): OfficeSpawnSystem<TEnemyHandle> {
    const config = jsonConfig.officeSpawns;

    return new OfficeSpawnSystem<TEnemyHandle>(
      scene,
      players,
      {
        offices: config.offices,
        minPlayerDistance: config.minPlayerDistance,
        retryDelayMs: config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
      },
      callbacks
    );
  }

  startEncounter(waves: OfficeSpawnWaveConfig[]): void {
    if (waves.length === 0) {
      this.finishEncounter();
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

    const choice = this.pickSafeDoor(runtimeWave.config.enabledOffices);
    if (!choice) {
      runtimeWave.nextSpawnAt = currentTime + this.config.retryDelayMs;
      return;
    }

    const enemy = this.callbacks.spawnEnemy(
      choice.door.x,
      choice.door.y,
      choice.officeId,
      choice.door.id,
      runtimeWave.config.id
    );

    runtimeWave.nextSpawnAt = currentTime + runtimeWave.config.spawnIntervalMs;

    if (!enemy) {
      return;
    }

    runtimeWave.spawned += 1;
    runtimeWave.alive.add(enemy);
  }

  private pickSafeDoor(enabledOfficeIds?: string[]): OfficeDoorChoice | null {
    const officeFilter = enabledOfficeIds ? new Set(enabledOfficeIds) : null;
    const candidateDoors = this.config.offices.flatMap((office) => {
      if (officeFilter && !officeFilter.has(office.id)) {
        return [];
      }

      return office.doors.map((door) => ({
        officeId: office.id,
        door
      }));
    });

    if (candidateDoors.length === 0) {
      return null;
    }

    const shuffledCandidates = Phaser.Utils.Array.Shuffle([...candidateDoors]);
    return shuffledCandidates.find((candidate) => this.isFarEnoughFromPlayers(candidate.door.x, candidate.door.y)) ?? null;
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
