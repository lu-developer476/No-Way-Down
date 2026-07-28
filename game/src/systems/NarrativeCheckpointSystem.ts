import Phaser from 'phaser';
import { CheckpointTimerSystem } from './core/CheckpointTimerSystem';

export interface NarrativeCheckpointBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NarrativeCheckpointConfig {
  id: string;
  label: string;
  area: NarrativeCheckpointBounds;
  objectiveOnComplete: string;
  recoveryEventId: string;
  participants: string[];
  startsEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface NarrativeCheckpointSystemConfig {
  levelId: string;
  checkpoints: NarrativeCheckpointConfig[];
}

export type NarrativeCheckpointState = 'idle' | 'awaiting_combat_resolution' | 'recovering' | 'completed';

export interface NarrativeCheckpointSnapshot {
  levelId: string;
  checkpoints: Array<{
    id: string;
    state: NarrativeCheckpointState;
    activations: number;
    activatedBy?: string;
    completedAt?: number;
  }>;
}

export interface NarrativeCheckpointContext {
  levelId: string;
  checkpointId: string;
  activatedBy: NarrativeActor;
}

export interface NarrativeCheckpointRecoveryRequest {
  checkpoint: NarrativeCheckpointConfig;
  context: NarrativeCheckpointContext;
}

export interface NarrativeCheckpointCallbacks {
  isCombatPending?: (request: NarrativeCheckpointRecoveryRequest) => boolean;
  onCheckpointActivated?: (request: NarrativeCheckpointRecoveryRequest) => void;
  onCombatResolutionRequired?: (request: NarrativeCheckpointRecoveryRequest) => void;
  onRecoveryRequested?: (request: NarrativeCheckpointRecoveryRequest) => void | Promise<void>;
  onRecoveryCompleted?: (request: NarrativeCheckpointRecoveryRequest) => void;
  onObjectiveUpdated?: (objectiveText: string, request: NarrativeCheckpointRecoveryRequest) => void;
  onCheckpointStateChanged?: (snapshot: NarrativeCheckpointSnapshot) => void;
}

export interface NarrativeCheckpointSystemOptions {
  stateRegistryKey?: string;
}

type NarrativeActor = Phaser.GameObjects.GameObject & {
  body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null;
};

interface RuntimeCheckpoint {
  config: NarrativeCheckpointConfig;
  zone: Phaser.GameObjects.Zone;
  state: NarrativeCheckpointState;
  activations: number;
  activatedBy?: NarrativeActor;
  isResolvingRecovery: boolean;
  completedAt?: number;
}

const DEFAULT_OPTIONS: Required<NarrativeCheckpointSystemOptions> = {
  stateRegistryKey: 'narrativeCheckpointState'
};

export class NarrativeCheckpointSystem {
  private readonly scene: Phaser.Scene;
  private readonly actors: NarrativeActor[];
  private readonly callbacks: NarrativeCheckpointCallbacks;
  private readonly options: Required<NarrativeCheckpointSystemOptions>;
  private readonly levelId: string;
  private readonly runtimeCheckpoints = new Map<string, RuntimeCheckpoint>();
  private readonly coreCheckpointSystem = new CheckpointTimerSystem();

  static fromJson(
    scene: Phaser.Scene,
    actors: NarrativeActor[],
    jsonConfig: NarrativeCheckpointSystemConfig,
    callbacks: NarrativeCheckpointCallbacks = {},
    options: NarrativeCheckpointSystemOptions = {}
  ): NarrativeCheckpointSystem {
    return new NarrativeCheckpointSystem(scene, actors, jsonConfig, callbacks, options);
  }

  constructor(
    scene: Phaser.Scene,
    actors: NarrativeActor[],
    config: NarrativeCheckpointSystemConfig,
    callbacks: NarrativeCheckpointCallbacks = {},
    options: NarrativeCheckpointSystemOptions = {}
  ) {
    this.scene = scene;
    this.actors = actors;
    this.callbacks = callbacks;
    this.options = {
      stateRegistryKey: options.stateRegistryKey ?? DEFAULT_OPTIONS.stateRegistryKey
    };
    this.levelId = config.levelId;

    this.validateConfig(config);
    this.buildRuntimeCheckpoints(config.checkpoints);
    this.persistSnapshot();
  }

  update(): void {
    this.runtimeCheckpoints.forEach((runtimeCheckpoint) => {
      if (runtimeCheckpoint.state !== 'awaiting_combat_resolution' || !runtimeCheckpoint.activatedBy) {
        return;
      }

      const request = this.createRequest(runtimeCheckpoint, runtimeCheckpoint.activatedBy);
      if (this.callbacks.isCombatPending?.(request) ?? false) {
        return;
      }

      void this.startRecovery(runtimeCheckpoint, runtimeCheckpoint.activatedBy);
    });
  }

  destroy(): void {
    this.runtimeCheckpoints.forEach((runtimeCheckpoint) => {
      runtimeCheckpoint.zone.destroy();
    });

    this.runtimeCheckpoints.clear();
  }

  getState(checkpointId: string): NarrativeCheckpointState | undefined {
    return this.runtimeCheckpoints.get(checkpointId)?.state;
  }

  getSnapshot(): NarrativeCheckpointSnapshot {
    return {
      levelId: this.levelId,
      checkpoints: Array.from(this.runtimeCheckpoints.values()).map((runtimeCheckpoint) => ({
        id: runtimeCheckpoint.config.id,
        state: runtimeCheckpoint.state,
        activations: runtimeCheckpoint.activations,
        activatedBy: runtimeCheckpoint.activatedBy?.name || runtimeCheckpoint.activatedBy?.type,
        completedAt: runtimeCheckpoint.completedAt
      }))
    };
  }

  private validateConfig(config: NarrativeCheckpointSystemConfig): void {
    if (config.checkpoints.length === 0) {
      throw new Error('NarrativeCheckpointSystem requires at least one checkpoint.');
    }

    const seenIds = new Set<string>();

    config.checkpoints.forEach((checkpoint) => {
      if (seenIds.has(checkpoint.id)) {
        throw new Error(`NarrativeCheckpointSystem: duplicated checkpoint id "${checkpoint.id}".`);
      }

      seenIds.add(checkpoint.id);

      if (checkpoint.recoveryEventId.trim().length === 0) {
        throw new Error(`NarrativeCheckpointSystem: checkpoint "${checkpoint.id}" requires recoveryEventId.`);
      }

      if (checkpoint.objectiveOnComplete.trim().length === 0) {
        throw new Error(`NarrativeCheckpointSystem: checkpoint "${checkpoint.id}" requires objectiveOnComplete.`);
      }

      if (checkpoint.participants.length === 0) {
        throw new Error(`NarrativeCheckpointSystem: checkpoint "${checkpoint.id}" requires at least one participant.`);
      }
    });
  }

  private buildRuntimeCheckpoints(checkpoints: NarrativeCheckpointConfig[]): void {
    checkpoints.forEach((checkpointConfig) => {
      const zone = this.scene.add.zone(
        checkpointConfig.area.x,
        checkpointConfig.area.y,
        checkpointConfig.area.width,
        checkpointConfig.area.height
      );

      this.scene.physics.add.existing(zone, true);

      const runtimeCheckpoint: RuntimeCheckpoint = {
        config: checkpointConfig,
        zone,
        state: 'idle',
        activations: 0,
        isResolvingRecovery: false
      };

      this.runtimeCheckpoints.set(checkpointConfig.id, runtimeCheckpoint);
      this.coreCheckpointSystem.activateCheckpoint({
        id: checkpointConfig.id,
        label: checkpointConfig.label,
        restored: runtimeCheckpoint.state === 'completed',
        position: { x: checkpointConfig.area.x, y: checkpointConfig.area.y }
      });
      this.bindOverlap(runtimeCheckpoint);

      if (checkpointConfig.startsEnabled === false) {
        const body = zone.body as Phaser.Physics.Arcade.StaticBody;
        body.enable = false;
      }
    });
  }

  private bindOverlap(runtimeCheckpoint: RuntimeCheckpoint): void {
    this.actors.forEach((actor) => {
      this.scene.physics.add.overlap(actor as Phaser.Types.Physics.Arcade.GameObjectWithBody, runtimeCheckpoint.zone, () => {
        void this.activateCheckpoint(runtimeCheckpoint, actor);
      });
    });
  }

  private async activateCheckpoint(
    runtimeCheckpoint: RuntimeCheckpoint,
    activatedBy: NarrativeActor
  ): Promise<void> {
    if (runtimeCheckpoint.state === 'completed' || runtimeCheckpoint.state === 'recovering') {
      return;
    }

    runtimeCheckpoint.activations += 1;
    runtimeCheckpoint.activatedBy = activatedBy;

    const request = this.createRequest(runtimeCheckpoint, activatedBy);

    this.callbacks.onCheckpointActivated?.(request);

    if (this.callbacks.isCombatPending?.(request) ?? false) {
      this.setState(runtimeCheckpoint, 'awaiting_combat_resolution');
      this.callbacks.onCombatResolutionRequired?.(request);
      return;
    }

    await this.startRecovery(runtimeCheckpoint, activatedBy);
  }

  private async startRecovery(
    runtimeCheckpoint: RuntimeCheckpoint,
    activatedBy: NarrativeActor
  ): Promise<void> {
    if (runtimeCheckpoint.isResolvingRecovery || runtimeCheckpoint.state === 'completed') {
      return;
    }

    runtimeCheckpoint.isResolvingRecovery = true;
    this.setState(runtimeCheckpoint, 'recovering');

    const request = this.createRequest(runtimeCheckpoint, activatedBy);

    try {
      await this.callbacks.onRecoveryRequested?.(request);
      runtimeCheckpoint.completedAt = this.scene.time.now;
      this.coreCheckpointSystem.activateCheckpoint({
        id: runtimeCheckpoint.config.id,
        label: runtimeCheckpoint.config.label,
        restored: true,
        position: { x: runtimeCheckpoint.config.area.x, y: runtimeCheckpoint.config.area.y }
      });
      this.setState(runtimeCheckpoint, 'completed');
      this.callbacks.onRecoveryCompleted?.(request);
      this.callbacks.onObjectiveUpdated?.(runtimeCheckpoint.config.objectiveOnComplete, request);
    } finally {
      runtimeCheckpoint.isResolvingRecovery = false;
    }
  }

  private setState(runtimeCheckpoint: RuntimeCheckpoint, nextState: NarrativeCheckpointState): void {
    if (runtimeCheckpoint.state === nextState) {
      return;
    }

    runtimeCheckpoint.state = nextState;
    this.persistSnapshot();
  }

  private createRequest(
    runtimeCheckpoint: RuntimeCheckpoint,
    activatedBy: NarrativeActor
  ): NarrativeCheckpointRecoveryRequest {
    return {
      checkpoint: runtimeCheckpoint.config,
      context: {
        levelId: this.levelId,
        checkpointId: runtimeCheckpoint.config.id,
        activatedBy
      }
    };
  }

  private persistSnapshot(): void {
    const snapshot = this.getSnapshot();
    this.scene.registry.set(this.options.stateRegistryKey, snapshot);
    this.callbacks.onCheckpointStateChanged?.(snapshot);
  }
}
