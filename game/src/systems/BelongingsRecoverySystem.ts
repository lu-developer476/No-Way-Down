import Phaser from 'phaser';

export type RecoveryStatus = 'pending' | 'in_progress' | 'completed';

export interface RecoveryArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RecoverableConfig {
  id: string;
  label: string;
  ownerCharacterId: string;
  marker: {
    x: number;
    y: number;
    radius?: number;
  };
  checkpointId: string;
  interactionDurationMs?: number;
}

export interface BelongingsRecoveryCheckpointConfig {
  id: string;
  label: string;
  allowedCharacterIds: string[];
}

export interface BelongingsRecoveryConfig {
  levelId: string;
  recoveryArea: RecoveryArea;
  checkpoints: BelongingsRecoveryCheckpointConfig[];
  recoverables: RecoverableConfig[];
}

export interface RecoveryActor {
  id: string;
  body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null;
  sprite?: Phaser.Types.Physics.Arcade.GameObjectWithBody & Phaser.GameObjects.GameObject;
}

export interface RecoverableStateSnapshot {
  id: string;
  ownerCharacterId: string;
  checkpointId: string;
  status: RecoveryStatus;
  recoveredByActorId?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface CheckpointProgressSnapshot {
  id: string;
  label: string;
  status: RecoveryStatus;
  totalRecoverables: number;
  completedRecoverables: number;
}

export interface BelongingsRecoverySnapshot {
  levelId: string;
  areaStatus: RecoveryStatus;
  recoverables: RecoverableStateSnapshot[];
  checkpoints: CheckpointProgressSnapshot[];
}

export interface BelongingsRecoveryCallbacks {
  onRecoverableStatusChanged?: (recoverable: RecoverableStateSnapshot, snapshot: BelongingsRecoverySnapshot) => void;
  onCheckpointStatusChanged?: (checkpoint: CheckpointProgressSnapshot, snapshot: BelongingsRecoverySnapshot) => void;
  onSystemStatusChanged?: (snapshot: BelongingsRecoverySnapshot) => void;
}

interface RuntimeRecoverable {
  config: RecoverableConfig;
  zone: Phaser.GameObjects.Zone;
  status: RecoveryStatus;
  startedAt?: number;
  completedAt?: number;
  recoveredByActorId?: string;
  isBusy: boolean;
}

const DEFAULT_INTERACTION_DURATION_MS = 800;

export class BelongingsRecoverySystem {
  private readonly scene: Phaser.Scene;
  private readonly config: BelongingsRecoveryConfig;
  private readonly callbacks: BelongingsRecoveryCallbacks;
  private readonly actorsById = new Map<string, RecoveryActor>();
  private readonly checkpointsById = new Map<string, BelongingsRecoveryCheckpointConfig>();
  private readonly runtimeRecoverables = new Map<string, RuntimeRecoverable>();

  static fromJson(
    scene: Phaser.Scene,
    actors: RecoveryActor[],
    jsonConfig: BelongingsRecoveryConfig,
    callbacks: BelongingsRecoveryCallbacks = {}
  ): BelongingsRecoverySystem {
    return new BelongingsRecoverySystem(scene, actors, jsonConfig, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    actors: RecoveryActor[],
    config: BelongingsRecoveryConfig,
    callbacks: BelongingsRecoveryCallbacks = {}
  ) {
    this.scene = scene;
    this.config = config;
    this.callbacks = callbacks;

    this.validateConfig(config);

    actors.forEach((actor) => this.actorsById.set(actor.id, actor));
    config.checkpoints.forEach((checkpoint) => this.checkpointsById.set(checkpoint.id, checkpoint));

    this.createRuntimeRecoverables();
    this.bindAutomaticOverlapInteractions();
    this.emitSystemStatus();
  }

  destroy(): void {
    this.runtimeRecoverables.forEach((recoverable) => recoverable.zone.destroy());
    this.runtimeRecoverables.clear();
  }

  update(): void {
    // Punto de extensión para lógica futura (cooldowns, reasignaciones dinámicas, etc.)
  }

  requestRecovery(recoverableId: string, actorId: string): Promise<boolean> {
    const runtimeRecoverable = this.runtimeRecoverables.get(recoverableId);
    if (!runtimeRecoverable) {
      return Promise.resolve(false);
    }

    const actor = this.actorsById.get(actorId);
    if (!actor || !this.canActorRecover(actorId, recoverableId)) {
      return Promise.resolve(false);
    }

    return this.startRecovery(runtimeRecoverable, actorId);
  }

  canActorRecover(actorId: string, recoverableId: string): boolean {
    const runtimeRecoverable = this.runtimeRecoverables.get(recoverableId);
    if (!runtimeRecoverable || runtimeRecoverable.status === 'completed') {
      return false;
    }

    const actor = this.actorsById.get(actorId);
    if (!actor) {
      return false;
    }

    if (!this.isActorInsideRecoveryArea(actor)) {
      return false;
    }

    const checkpoint = this.checkpointsById.get(runtimeRecoverable.config.checkpointId);
    if (!checkpoint) {
      return false;
    }

    return checkpoint.allowedCharacterIds.includes(actorId) || runtimeRecoverable.config.ownerCharacterId === actorId;
  }

  getSnapshot(): BelongingsRecoverySnapshot {
    const recoverables = Array.from(this.runtimeRecoverables.values()).map((runtimeRecoverable) => ({
      id: runtimeRecoverable.config.id,
      ownerCharacterId: runtimeRecoverable.config.ownerCharacterId,
      checkpointId: runtimeRecoverable.config.checkpointId,
      status: runtimeRecoverable.status,
      recoveredByActorId: runtimeRecoverable.recoveredByActorId,
      startedAt: runtimeRecoverable.startedAt,
      completedAt: runtimeRecoverable.completedAt
    }));

    const checkpoints = this.config.checkpoints.map((checkpoint) => this.getCheckpointProgress(checkpoint.id));

    const areaStatus: RecoveryStatus = checkpoints.every((checkpoint) => checkpoint.status === 'completed')
      ? 'completed'
      : checkpoints.some((checkpoint) => checkpoint.status === 'in_progress' || checkpoint.completedRecoverables > 0)
        ? 'in_progress'
        : 'pending';

    return {
      levelId: this.config.levelId,
      areaStatus,
      recoverables,
      checkpoints
    };
  }

  getCheckpointProgress(checkpointId: string): CheckpointProgressSnapshot {
    const checkpoint = this.checkpointsById.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`BelongingsRecoverySystem: checkpoint "${checkpointId}" no existe.`);
    }

    const recoverables = Array.from(this.runtimeRecoverables.values())
      .filter((recoverable) => recoverable.config.checkpointId === checkpointId);

    const totalRecoverables = recoverables.length;
    const completedRecoverables = recoverables.filter((recoverable) => recoverable.status === 'completed').length;

    const status: RecoveryStatus = totalRecoverables > 0 && completedRecoverables === totalRecoverables
      ? 'completed'
      : completedRecoverables > 0 || recoverables.some((recoverable) => recoverable.status === 'in_progress')
        ? 'in_progress'
        : 'pending';

    return {
      id: checkpoint.id,
      label: checkpoint.label,
      status,
      totalRecoverables,
      completedRecoverables
    };
  }

  private validateConfig(config: BelongingsRecoveryConfig): void {
    if (config.recoverables.length === 0) {
      throw new Error('BelongingsRecoverySystem: se requiere al menos un objeto recuperable.');
    }

    const seenRecoverableIds = new Set<string>();
    const checkpointIds = new Set(config.checkpoints.map((checkpoint) => checkpoint.id));

    config.recoverables.forEach((recoverable) => {
      if (seenRecoverableIds.has(recoverable.id)) {
        throw new Error(`BelongingsRecoverySystem: id duplicado "${recoverable.id}".`);
      }

      if (!checkpointIds.has(recoverable.checkpointId)) {
        throw new Error(
          `BelongingsRecoverySystem: recoverable "${recoverable.id}" usa checkpoint inexistente "${recoverable.checkpointId}".`
        );
      }

      seenRecoverableIds.add(recoverable.id);
    });
  }

  private createRuntimeRecoverables(): void {
    this.config.recoverables.forEach((recoverableConfig) => {
      const radius = recoverableConfig.marker.radius ?? 40;
      const zone = this.scene.add.zone(recoverableConfig.marker.x, recoverableConfig.marker.y, radius * 2, radius * 2);
      this.scene.physics.add.existing(zone, true);

      this.runtimeRecoverables.set(recoverableConfig.id, {
        config: recoverableConfig,
        zone,
        status: 'pending',
        isBusy: false
      });
    });
  }

  private bindAutomaticOverlapInteractions(): void {
    this.runtimeRecoverables.forEach((runtimeRecoverable) => {
      this.actorsById.forEach((actor, actorId) => {
        if (!actor.sprite) {
          return;
        }

        this.scene.physics.add.overlap(actor.sprite, runtimeRecoverable.zone, () => {
          void this.requestRecovery(runtimeRecoverable.config.id, actorId);
        });
      });
    });
  }

  private async startRecovery(runtimeRecoverable: RuntimeRecoverable, actorId: string): Promise<boolean> {
    if (runtimeRecoverable.isBusy || runtimeRecoverable.status === 'completed') {
      return false;
    }

    runtimeRecoverable.isBusy = true;
    runtimeRecoverable.status = 'in_progress';
    runtimeRecoverable.startedAt = this.scene.time.now;
    runtimeRecoverable.recoveredByActorId = actorId;

    this.emitRecoverableChange(runtimeRecoverable);

    const delayMs = runtimeRecoverable.config.interactionDurationMs ?? DEFAULT_INTERACTION_DURATION_MS;

    await new Promise<void>((resolve) => {
      this.scene.time.delayedCall(delayMs, () => resolve());
    });

    runtimeRecoverable.status = 'completed';
    runtimeRecoverable.completedAt = this.scene.time.now;
    runtimeRecoverable.isBusy = false;

    this.emitRecoverableChange(runtimeRecoverable);
    return true;
  }

  private emitRecoverableChange(runtimeRecoverable: RuntimeRecoverable): void {
    const snapshot = this.getSnapshot();

    const recoverableSnapshot = snapshot.recoverables.find((recoverable) => recoverable.id === runtimeRecoverable.config.id);
    if (recoverableSnapshot) {
      this.callbacks.onRecoverableStatusChanged?.(recoverableSnapshot, snapshot);
    }

    const checkpointSnapshot = snapshot.checkpoints.find(
      (checkpoint) => checkpoint.id === runtimeRecoverable.config.checkpointId
    );

    if (checkpointSnapshot) {
      this.callbacks.onCheckpointStatusChanged?.(checkpointSnapshot, snapshot);
    }

    this.emitSystemStatus(snapshot);
  }

  private emitSystemStatus(snapshot: BelongingsRecoverySnapshot = this.getSnapshot()): void {
    this.callbacks.onSystemStatusChanged?.(snapshot);
  }

  private isActorInsideRecoveryArea(actor: RecoveryActor): boolean {
    const sprite = actor.sprite;
    if (!sprite) {
      return true;
    }

    const { recoveryArea } = this.config;
    const left = recoveryArea.x - recoveryArea.width / 2;
    const right = recoveryArea.x + recoveryArea.width / 2;
    const top = recoveryArea.y - recoveryArea.height / 2;
    const bottom = recoveryArea.y + recoveryArea.height / 2;

    const actorPosition = sprite as unknown as { x: number; y: number };
    return actorPosition.x >= left && actorPosition.x <= right && actorPosition.y >= top && actorPosition.y <= bottom;
  }
}
