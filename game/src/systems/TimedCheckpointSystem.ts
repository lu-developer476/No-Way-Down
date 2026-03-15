import Phaser from 'phaser';
import { CheckpointTimerSystem } from './core/CheckpointTimerSystem';

export type TimedCheckpointState = 'idle' | 'running' | 'expired' | 'completed';

export type TimedCheckpointExpirationBehavior = 'mission_fail' | 'restart_checkpoint' | 'penalty';

export interface TimedCheckpointBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimedCheckpointSaveData {
  id: string;
  x: number;
  y: number;
  floor: number;
  metadata?: Record<string, unknown>;
}

export interface TimedCheckpointPenaltyConfig {
  healthDamage?: number;
  spawnExtraZombies?: number;
  objectiveOverride?: string;
  interactionHint?: string;
  metadata?: Record<string, unknown>;
}

export interface TimedCheckpointConfig {
  id: string;
  label: string;
  area: TimedCheckpointBounds;
  durationMs: number;
  restoredCheckpoint: TimedCheckpointSaveData;
  objectiveDuringCountdown: string;
  interactionHintOnStart?: string;
  interactionHintOnExpire?: string;
  startsEnabled?: boolean;
  canRetrigger?: boolean;
  expirationBehavior: TimedCheckpointExpirationBehavior;
  penalty?: TimedCheckpointPenaltyConfig;
}

export interface TimedCheckpointSystemConfig {
  levelId: string;
  checkpoint: TimedCheckpointConfig;
}

export interface TimedCheckpointSnapshot {
  levelId: string;
  checkpointId: string;
  state: TimedCheckpointState;
  startedAt?: number;
  deadlineAt?: number;
  remainingMs: number;
  formattedRemaining: string;
  activationCount: number;
  expiredAt?: number;
  completedAt?: number;
}

export interface TimedCheckpointExpirationEvent {
  behavior: TimedCheckpointExpirationBehavior;
  checkpoint: TimedCheckpointSaveData;
  penalty?: TimedCheckpointPenaltyConfig;
  snapshot: TimedCheckpointSnapshot;
}

export interface TimedCheckpointCallbacks {
  onCheckpointRestored?: (checkpoint: TimedCheckpointSaveData, snapshot: TimedCheckpointSnapshot) => void;
  onTimerStarted?: (snapshot: TimedCheckpointSnapshot) => void;
  onTimerTick?: (snapshot: TimedCheckpointSnapshot) => void;
  onObjectiveUpdated?: (objectiveText: string, snapshot: TimedCheckpointSnapshot) => void;
  onExpired?: (event: TimedCheckpointExpirationEvent) => void;
  onRestartRequested?: (checkpoint: TimedCheckpointSaveData, snapshot: TimedCheckpointSnapshot) => void;
  onMissionFailed?: (snapshot: TimedCheckpointSnapshot) => void;
  onPenaltyApplied?: (penalty: TimedCheckpointPenaltyConfig, snapshot: TimedCheckpointSnapshot) => void;
  onStateChanged?: (snapshot: TimedCheckpointSnapshot) => void;
}

export interface TimedCheckpointSystemOptions {
  stateRegistryKey?: string;
  timerRegistryKey?: string;
  objectiveRegistryKey?: string;
  hintRegistryKey?: string;
  checkpointRegistryKey?: string;
  syncRegistry?: boolean;
}

type TimedCheckpointActor = Phaser.GameObjects.GameObject & {
  body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null;
};

const DEFAULT_OPTIONS: Required<TimedCheckpointSystemOptions> = {
  stateRegistryKey: 'timedCheckpointState',
  timerRegistryKey: 'countdownTimer',
  objectiveRegistryKey: 'currentObjective',
  hintRegistryKey: 'interactionHint',
  checkpointRegistryKey: 'checkpoint',
  syncRegistry: true
};

export class TimedCheckpointSystem {
  private readonly scene: Phaser.Scene;
  private readonly actors: TimedCheckpointActor[];
  private readonly callbacks: TimedCheckpointCallbacks;
  private readonly options: Required<TimedCheckpointSystemOptions>;
  private readonly config: TimedCheckpointSystemConfig;
  private readonly coreCheckpointSystem = new CheckpointTimerSystem();
  private readonly zone: Phaser.GameObjects.Zone;

  private state: TimedCheckpointState = 'idle';
  private activationCount = 0;
  private startedAt?: number;
  private deadlineAt?: number;
  private expiredAt?: number;
  private completedAt?: number;
  private lastBroadcastSecond?: number;

  static fromJson(
    scene: Phaser.Scene,
    actors: TimedCheckpointActor[],
    config: TimedCheckpointSystemConfig,
    callbacks: TimedCheckpointCallbacks = {},
    options: TimedCheckpointSystemOptions = {}
  ): TimedCheckpointSystem {
    return new TimedCheckpointSystem(scene, actors, config, callbacks, options);
  }

  constructor(
    scene: Phaser.Scene,
    actors: TimedCheckpointActor[],
    config: TimedCheckpointSystemConfig,
    callbacks: TimedCheckpointCallbacks = {},
    options: TimedCheckpointSystemOptions = {}
  ) {
    this.scene = scene;
    this.actors = actors;
    this.config = config;
    this.callbacks = callbacks;
    this.options = {
      stateRegistryKey: options.stateRegistryKey ?? DEFAULT_OPTIONS.stateRegistryKey,
      timerRegistryKey: options.timerRegistryKey ?? DEFAULT_OPTIONS.timerRegistryKey,
      objectiveRegistryKey: options.objectiveRegistryKey ?? DEFAULT_OPTIONS.objectiveRegistryKey,
      hintRegistryKey: options.hintRegistryKey ?? DEFAULT_OPTIONS.hintRegistryKey,
      checkpointRegistryKey: options.checkpointRegistryKey ?? DEFAULT_OPTIONS.checkpointRegistryKey,
      syncRegistry: options.syncRegistry ?? DEFAULT_OPTIONS.syncRegistry
    };

    this.validateConfig(config);
    this.coreCheckpointSystem.defineTimer(config.checkpoint.id, config.checkpoint.durationMs);

    this.zone = scene.add.zone(
      config.checkpoint.area.x,
      config.checkpoint.area.y,
      config.checkpoint.area.width,
      config.checkpoint.area.height
    );

    scene.physics.add.existing(this.zone, true);

    if (config.checkpoint.startsEnabled === false) {
      const body = this.zone.body as Phaser.Physics.Arcade.StaticBody;
      body.enable = false;
    }

    this.bindOverlaps();
    this.persistState();
  }

  update(now: number = this.scene.time.now): void {
    if (this.state !== 'running' || this.deadlineAt === undefined) {
      return;
    }

    const remainingMs = Math.max(0, this.deadlineAt - now);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    this.coreCheckpointSystem.updateTimer(this.config.checkpoint.id, this.scene.game.loop.delta);

    if (this.lastBroadcastSecond !== remainingSeconds) {
      this.lastBroadcastSecond = remainingSeconds;
      this.persistState();
      this.callbacks.onTimerTick?.(this.getSnapshot(now));
    }

    if (remainingMs === 0) {
      this.expire(now);
    }
  }

  destroy(): void {
    this.zone.destroy();
  }

  completeRace(now: number = this.scene.time.now): void {
    if (this.state !== 'running') {
      return;
    }

    this.state = 'completed';
    this.completedAt = now;
    this.persistState();
  }

  getSnapshot(now: number = this.scene.time.now): TimedCheckpointSnapshot {
    const remainingMs = this.getRemainingMs(now);

    return {
      levelId: this.config.levelId,
      checkpointId: this.config.checkpoint.id,
      state: this.state,
      startedAt: this.startedAt,
      deadlineAt: this.deadlineAt,
      remainingMs,
      formattedRemaining: TimedCheckpointSystem.formatDuration(remainingMs),
      activationCount: this.activationCount,
      expiredAt: this.expiredAt,
      completedAt: this.completedAt
    };
  }

  private bindOverlaps(): void {
    this.actors.forEach((actor) => {
      this.scene.physics.add.overlap(actor as Phaser.Types.Physics.Arcade.GameObjectWithBody, this.zone, () => {
        this.activate(actor);
      });
    });
  }

  private activate(actor: TimedCheckpointActor): void {
    if (this.state === 'running' && !this.config.checkpoint.canRetrigger) {
      return;
    }

    if (this.state === 'completed' || this.state === 'expired') {
      return;
    }

    const now = this.scene.time.now;

    this.state = 'running';
    this.activationCount += 1;
    this.coreCheckpointSystem.startTimer(this.config.checkpoint.id);
    this.startedAt = now;
    this.deadlineAt = now + this.config.checkpoint.durationMs;
    this.expiredAt = undefined;
    this.completedAt = undefined;
    this.lastBroadcastSecond = undefined;

    const snapshot = this.getSnapshot(now);

    if (this.options.syncRegistry) {
      this.coreCheckpointSystem.activateCheckpoint({
        id: this.config.checkpoint.restoredCheckpoint.id,
        label: this.config.checkpoint.label,
        restored: true,
        position: { x: this.config.checkpoint.area.x, y: this.config.checkpoint.area.y }
      });

      this.scene.registry.set(this.options.checkpointRegistryKey, {
        ...this.config.checkpoint.restoredCheckpoint,
        restoredBy: actor.name || actor.type,
        restoredAt: now,
        source: 'timed-checkpoint'
      });

      this.scene.registry.set(this.options.objectiveRegistryKey, this.config.checkpoint.objectiveDuringCountdown);
      this.scene.registry.set(
        this.options.hintRegistryKey,
        this.config.checkpoint.interactionHintOnStart ?? `${this.config.checkpoint.label}: checkpoint restaurado.`
      );
    }

    this.callbacks.onCheckpointRestored?.(this.config.checkpoint.restoredCheckpoint, snapshot);
    this.callbacks.onTimerStarted?.(snapshot);
    this.callbacks.onObjectiveUpdated?.(this.config.checkpoint.objectiveDuringCountdown, snapshot);

    this.persistState();
  }

  private expire(now: number): void {
    if (this.state !== 'running') {
      return;
    }

    this.state = 'expired';
    this.expiredAt = now;

    const snapshot = this.getSnapshot(now);

    if (this.options.syncRegistry) {
      this.scene.registry.set(this.options.hintRegistryKey, this.config.checkpoint.interactionHintOnExpire ?? 'Tiempo agotado.');
    }

    const expirationEvent: TimedCheckpointExpirationEvent = {
      behavior: this.config.checkpoint.expirationBehavior,
      checkpoint: this.config.checkpoint.restoredCheckpoint,
      penalty: this.config.checkpoint.penalty,
      snapshot
    };

    switch (this.config.checkpoint.expirationBehavior) {
      case 'mission_fail':
        this.callbacks.onMissionFailed?.(snapshot);
        break;
      case 'restart_checkpoint':
        this.callbacks.onRestartRequested?.(this.config.checkpoint.restoredCheckpoint, snapshot);
        break;
      case 'penalty':
        if (this.config.checkpoint.penalty) {
          this.callbacks.onPenaltyApplied?.(this.config.checkpoint.penalty, snapshot);

          if (this.options.syncRegistry && this.config.checkpoint.penalty.objectiveOverride) {
            this.scene.registry.set(this.options.objectiveRegistryKey, this.config.checkpoint.penalty.objectiveOverride);
          }

          if (this.options.syncRegistry && this.config.checkpoint.penalty.interactionHint) {
            this.scene.registry.set(this.options.hintRegistryKey, this.config.checkpoint.penalty.interactionHint);
          }
        }
        break;
      default:
        break;
    }

    this.callbacks.onExpired?.(expirationEvent);
    this.persistState();
  }

  private getRemainingMs(now: number): number {
    if (this.state !== 'running' || this.deadlineAt === undefined) {
      return 0;
    }

    return Math.max(0, this.deadlineAt - now);
  }

  private persistState(): void {
    const snapshot = this.getSnapshot();

    if (this.options.syncRegistry) {
      this.scene.registry.set(this.options.stateRegistryKey, snapshot);
      this.scene.registry.set(this.options.timerRegistryKey, snapshot.formattedRemaining);
    }

    this.callbacks.onStateChanged?.(snapshot);
  }

  private validateConfig(config: TimedCheckpointSystemConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('TimedCheckpointSystem: levelId es obligatorio.');
    }

    if (config.checkpoint.id.trim().length === 0) {
      throw new Error('TimedCheckpointSystem: checkpoint.id es obligatorio.');
    }

    if (config.checkpoint.label.trim().length === 0) {
      throw new Error('TimedCheckpointSystem: checkpoint.label es obligatorio.');
    }

    if (config.checkpoint.durationMs <= 0) {
      throw new Error('TimedCheckpointSystem: checkpoint.durationMs debe ser mayor a 0.');
    }

    if (config.checkpoint.objectiveDuringCountdown.trim().length === 0) {
      throw new Error('TimedCheckpointSystem: checkpoint.objectiveDuringCountdown es obligatorio.');
    }

    if (config.checkpoint.restoredCheckpoint.id.trim().length === 0) {
      throw new Error('TimedCheckpointSystem: checkpoint.restoredCheckpoint.id es obligatorio.');
    }

    if (
      config.checkpoint.expirationBehavior === 'penalty' &&
      !config.checkpoint.penalty
    ) {
      throw new Error('TimedCheckpointSystem: expirationBehavior="penalty" requiere checkpoint.penalty.');
    }
  }

  static formatDuration(durationMs: number): string {
    const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
