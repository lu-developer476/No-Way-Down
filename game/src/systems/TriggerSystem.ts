import Phaser from 'phaser';

export type TriggerType = 'combat_activation' | 'zombie_spawn' | 'narrative_message' | 'level_transition';

export interface TriggerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TriggerDefinitionBase<TType extends TriggerType, TPayload> {
  id: string;
  type: TType;
  bounds: TriggerBounds;
  payload: TPayload;
  once?: boolean;
  startsEnabled?: boolean;
}

export interface CombatActivationPayload {
  encounterId: string;
  lockPlayerMovement?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ZombieSpawnPayload {
  waveId: string;
  zombieType?: string;
  count: number;
  spawnPoints: Array<{ x: number; y: number }>;
  metadata?: Record<string, unknown>;
}

export interface NarrativeMessagePayload {
  message: string;
  speaker?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface LevelTransitionPayload {
  targetLevel: string;
  spawnMarker?: string;
  fadeOutMs?: number;
  metadata?: Record<string, unknown>;
}

export type CombatActivationTrigger = TriggerDefinitionBase<'combat_activation', CombatActivationPayload>;
export type ZombieSpawnTrigger = TriggerDefinitionBase<'zombie_spawn', ZombieSpawnPayload>;
export type NarrativeMessageTrigger = TriggerDefinitionBase<'narrative_message', NarrativeMessagePayload>;
export type LevelTransitionTrigger = TriggerDefinitionBase<'level_transition', LevelTransitionPayload>;

export type TriggerDefinition =
  | CombatActivationTrigger
  | ZombieSpawnTrigger
  | NarrativeMessageTrigger
  | LevelTransitionTrigger;

export interface TriggerConfig {
  levelId: string;
  triggers: TriggerDefinition[];
}

export interface TriggerContext {
  triggerId: string;
  levelId: string;
  player: Phaser.Types.Physics.Arcade.GameObjectWithBody;
}

export interface TriggerSystemCallbacks {
  onCombatActivation?: (payload: CombatActivationPayload, context: TriggerContext) => void;
  onZombieSpawn?: (payload: ZombieSpawnPayload, context: TriggerContext) => void;
  onNarrativeMessage?: (payload: NarrativeMessagePayload, context: TriggerContext) => void;
  onLevelTransition?: (payload: LevelTransitionPayload, context: TriggerContext) => void;
  onTriggerActivated?: (trigger: TriggerDefinition, context: TriggerContext) => void;
}

interface RuntimeTrigger {
  config: TriggerDefinition;
  zone: Phaser.GameObjects.Zone;
  enabled: boolean;
  activations: number;
}

export class TriggerSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly callbacks: TriggerSystemCallbacks;
  private readonly runtimeTriggers = new Map<string, RuntimeTrigger>();
  private activeLevelId: string;

  constructor(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    config: TriggerConfig,
    callbacks: TriggerSystemCallbacks = {}
  ) {
    this.scene = scene;
    this.players = players;
    this.callbacks = callbacks;
    this.activeLevelId = config.levelId;

    this.applyConfig(config);
  }

  loadConfig(config: TriggerConfig): void {
    this.destroyRuntimeTriggers();
    this.activeLevelId = config.levelId;
    this.applyConfig(config);
  }

  enableTrigger(triggerId: string): void {
    const runtime = this.runtimeTriggers.get(triggerId);
    if (!runtime) {
      return;
    }

    runtime.enabled = true;
    runtime.zone.setActive(true).setVisible(true);
    const body = runtime.zone.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = true;
  }

  disableTrigger(triggerId: string): void {
    const runtime = this.runtimeTriggers.get(triggerId);
    if (!runtime) {
      return;
    }

    runtime.enabled = false;
    runtime.zone.setActive(false).setVisible(false);
    const body = runtime.zone.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = false;
  }

  resetTrigger(triggerId: string): void {
    const runtime = this.runtimeTriggers.get(triggerId);
    if (!runtime) {
      return;
    }

    runtime.activations = 0;
    this.setTriggerEnabled(runtime, runtime.config.startsEnabled ?? true);
  }

  destroy(): void {
    this.destroyRuntimeTriggers();
  }

  private applyConfig(config: TriggerConfig): void {
    this.validateConfig(config);

    config.triggers.forEach((triggerConfig) => {
      const zone = this.scene.add.zone(
        triggerConfig.bounds.x,
        triggerConfig.bounds.y,
        triggerConfig.bounds.width,
        triggerConfig.bounds.height
      );

      this.scene.physics.add.existing(zone, true);

      const runtime: RuntimeTrigger = {
        config: triggerConfig,
        zone,
        enabled: triggerConfig.startsEnabled ?? true,
        activations: 0
      };

      this.runtimeTriggers.set(triggerConfig.id, runtime);
      this.setTriggerEnabled(runtime, runtime.enabled);
      this.bindPlayerCollisions(runtime);
    });
  }

  private bindPlayerCollisions(runtime: RuntimeTrigger): void {
    this.players.forEach((player) => {
      this.scene.physics.add.overlap(player, runtime.zone, () => {
        this.activateTrigger(runtime, player);
      });
    });
  }

  private activateTrigger(
    runtime: RuntimeTrigger,
    player: Phaser.Types.Physics.Arcade.GameObjectWithBody
  ): void {
    if (!runtime.enabled) {
      return;
    }

    runtime.activations += 1;

    const context: TriggerContext = {
      triggerId: runtime.config.id,
      levelId: this.activeLevelId,
      player
    };

    this.callbacks.onTriggerActivated?.(runtime.config, context);

    switch (runtime.config.type) {
      case 'combat_activation':
        this.callbacks.onCombatActivation?.(runtime.config.payload, context);
        break;
      case 'zombie_spawn':
        this.callbacks.onZombieSpawn?.(runtime.config.payload, context);
        break;
      case 'narrative_message':
        this.callbacks.onNarrativeMessage?.(runtime.config.payload, context);
        break;
      case 'level_transition':
        this.callbacks.onLevelTransition?.(runtime.config.payload, context);
        break;
      default: {
        const exhaustiveCheck: never = runtime.config;
        throw new Error(`Unsupported trigger type: ${JSON.stringify(exhaustiveCheck)}`);
      }
    }

    if (runtime.config.once ?? true) {
      this.setTriggerEnabled(runtime, false);
    }
  }

  private setTriggerEnabled(runtime: RuntimeTrigger, enabled: boolean): void {
    runtime.enabled = enabled;
    runtime.zone.setActive(enabled).setVisible(false);

    const body = runtime.zone.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = enabled;

    if (enabled) {
      body.updateFromGameObject();
    }
  }

  private validateConfig(config: TriggerConfig): void {
    const seenIds = new Set<string>();

    config.triggers.forEach((trigger) => {
      if (seenIds.has(trigger.id)) {
        throw new Error(`TriggerSystem: duplicated trigger id "${trigger.id}" in level "${config.levelId}".`);
      }

      seenIds.add(trigger.id);

      if (trigger.type === 'zombie_spawn' && trigger.payload.spawnPoints.length === 0) {
        throw new Error(`TriggerSystem: zombie_spawn trigger "${trigger.id}" requires at least one spawn point.`);
      }

      if (trigger.type === 'zombie_spawn' && trigger.payload.count <= 0) {
        throw new Error(`TriggerSystem: zombie_spawn trigger "${trigger.id}" requires a positive count.`);
      }

      if (trigger.type === 'narrative_message' && trigger.payload.message.trim().length === 0) {
        throw new Error(`TriggerSystem: narrative_message trigger "${trigger.id}" requires a non-empty message.`);
      }
    });
  }

  private destroyRuntimeTriggers(): void {
    this.runtimeTriggers.forEach((runtime) => {
      runtime.zone.destroy();
    });

    this.runtimeTriggers.clear();
  }
}
