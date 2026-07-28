import Phaser from 'phaser';

export type RescueProgressStatus = 'pending' | 'in_progress' | 'completed';

export interface RescueTriggerArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RescueCinematicStep {
  id: string;
  actor: string;
  text: string;
  durationMs?: number;
}

export interface RescueVariantConfig {
  rescuerCharacterId: string;
  sequence: RescueCinematicStep[];
}

export interface RescueSceneConfig {
  id: string;
  movementLockDuringRescue: boolean;
  preRescueDelayMs: number;
  postRescueDelayMs: number;
  sequence: RescueCinematicStep[];
  rescueVariants?: RescueVariantConfig[];
}

export interface CompanionRescueConfig {
  id: string;
  codename: string;
  officeCode: string;
}

export interface WeaponRewardConfig {
  id: string;
  name: string;
  ammo: number;
}

export interface GroupCompositionConfig {
  addMemberIds: string[];
  markAsRescuedIds: string[];
}

export interface Office422RescueConfig {
  levelId: string;
  rescueId: string;
  trigger: RescueTriggerArea;
  rescueScene: RescueSceneConfig;
  companion: CompanionRescueConfig;
  weaponReward: WeaponRewardConfig;
  groupComposition: GroupCompositionConfig;
}

export interface RescueRuntimeState {
  levelId: string;
  rescueId: string;
  status: RescueProgressStatus;
  triggeredAt?: number;
  completedAt?: number;
  companionRescued: boolean;
  weaponGranted: boolean;
  groupUpdated: boolean;
}

export interface RescuePresentation {
  showRescueStep: (step: RescueCinematicStep, context: { rescueId: string; stepIndex: number }) => void;
  clearRescueScene: (context: { rescueId: string }) => void;
}

export interface Office422RescueCallbacks {
  onTriggerActivated?: (context: { rescueId: string; player: Phaser.Types.Physics.Arcade.GameObjectWithBody }) => void;
  onMovementLockChanged?: (locked: boolean, context: { rescueId: string }) => void;
  onRescueSceneSpawned?: (sceneConfig: RescueSceneConfig, context: { rescueId: string }) => void;
  onRescueVariantSelected?: (variant: { rescuerCharacterId: string; usedFallback: boolean }, context: { rescueId: string }) => void;
  onCompanionRescued?: (companion: CompanionRescueConfig, state: RescueRuntimeState) => void;
  onWeaponGranted?: (weapon: WeaponRewardConfig, companion: CompanionRescueConfig, state: RescueRuntimeState) => void;
  onGroupCompositionUpdated?: (groupUpdate: GroupCompositionConfig, state: RescueRuntimeState) => void;
  onRescueCompleted?: (state: RescueRuntimeState) => void;
  resolveRescuerCharacterId?: () => string | undefined;
}

const DEFAULT_STEP_DURATION_MS = 1200;

/**
 * Sistema genérico para rescates narrativos configurados por JSON.
 *
 * Objetivo específico de esta implementación:
 * - disparador al entrar a oficina 422
 * - reproducción de una breve escena de rescate
 * - registro de rescate de compañera
 * - entrega de arma
 * - actualización de composición de grupo
 *
 * El flujo se define por config y callbacks, para reutilizar el patrón en otros niveles/oficinas.
 */
export class Office422RescueSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly config: Office422RescueConfig;
  private readonly presentation: RescuePresentation;
  private readonly callbacks: Office422RescueCallbacks;

  private triggerZone: Phaser.GameObjects.Zone;
  private rescueSequence?: Promise<void>;

  private state: RescueRuntimeState;

  static fromJson(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    jsonConfig: Office422RescueConfig,
    presentation: RescuePresentation,
    callbacks: Office422RescueCallbacks = {}
  ): Office422RescueSystem {
    return new Office422RescueSystem(scene, players, jsonConfig, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    config: Office422RescueConfig,
    presentation: RescuePresentation,
    callbacks: Office422RescueCallbacks = {}
  ) {
    this.scene = scene;
    this.players = players;
    this.config = config;
    this.presentation = presentation;
    this.callbacks = callbacks;

    this.validateConfig(config);

    this.state = {
      levelId: config.levelId,
      rescueId: config.rescueId,
      status: 'pending',
      companionRescued: false,
      weaponGranted: false,
      groupUpdated: false
    };

    this.triggerZone = this.scene.add.zone(
      config.trigger.x,
      config.trigger.y,
      config.trigger.width,
      config.trigger.height
    );

    this.scene.physics.add.existing(this.triggerZone, true);
    this.bindTrigger();
  }

  destroy(): void {
    this.triggerZone.destroy();
  }

  update(): void {
    // Punto de extensión para versiones futuras (saltos, cancelaciones, variantes por dificultad).
  }

  isCompleted(): boolean {
    return this.state.status === 'completed';
  }

  getSnapshot(): RescueRuntimeState {
    return { ...this.state };
  }

  triggerRescueByScript(): Promise<void> {
    return this.startRescueSequence();
  }

  private bindTrigger(): void {
    this.players.forEach((player) => {
      this.scene.physics.add.overlap(player, this.triggerZone, () => {
        this.callbacks.onTriggerActivated?.({
          rescueId: this.config.rescueId,
          player
        });

        void this.startRescueSequence();
      });
    });
  }

  private startRescueSequence(): Promise<void> {
    if (this.state.status === 'completed') {
      return Promise.resolve();
    }

    if (this.rescueSequence) {
      return this.rescueSequence;
    }

    this.disableTriggerZone();

    this.rescueSequence = this.runSequence().finally(() => {
      this.rescueSequence = undefined;
    });

    return this.rescueSequence;
  }

  private async runSequence(): Promise<void> {
    this.state.status = 'in_progress';
    this.state.triggeredAt = this.scene.time.now;

    const sceneContext = { rescueId: this.config.rescueId };

    this.callbacks.onRescueSceneSpawned?.(this.config.rescueScene, sceneContext);

    if (this.config.rescueScene.movementLockDuringRescue) {
      this.callbacks.onMovementLockChanged?.(true, sceneContext);
    }

    await this.wait(this.config.rescueScene.preRescueDelayMs);

    const selectedRescuerCharacterId = this.callbacks.resolveRescuerCharacterId?.();
    const { sequence, usedFallback } = this.resolveSequenceForRescuer(selectedRescuerCharacterId);

    if (selectedRescuerCharacterId) {
      this.callbacks.onRescueVariantSelected?.(
        {
          rescuerCharacterId: selectedRescuerCharacterId,
          usedFallback
        },
        sceneContext
      );
    }

    for (let stepIndex = 0; stepIndex < sequence.length; stepIndex += 1) {
      const step = sequence[stepIndex];
      this.presentation.showRescueStep(step, {
        rescueId: this.config.rescueId,
        stepIndex
      });

      await this.wait(step.durationMs ?? DEFAULT_STEP_DURATION_MS);
    }

    this.presentation.clearRescueScene(sceneContext);
    await this.wait(this.config.rescueScene.postRescueDelayMs);

    this.state.companionRescued = true;
    this.callbacks.onCompanionRescued?.(this.config.companion, this.getSnapshot());

    this.state.weaponGranted = true;
    this.callbacks.onWeaponGranted?.(this.config.weaponReward, this.config.companion, this.getSnapshot());

    this.state.groupUpdated = true;
    this.callbacks.onGroupCompositionUpdated?.(this.config.groupComposition, this.getSnapshot());

    if (this.config.rescueScene.movementLockDuringRescue) {
      this.callbacks.onMovementLockChanged?.(false, sceneContext);
    }

    this.state.status = 'completed';
    this.state.completedAt = this.scene.time.now;
    this.callbacks.onRescueCompleted?.(this.getSnapshot());
  }

  private disableTriggerZone(): void {
    const body = this.triggerZone.body as Phaser.Physics.Arcade.StaticBody | undefined;
    if (body) {
      body.enable = false;
    }

    this.triggerZone.setActive(false).setVisible(false);
  }

  private wait(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.time.delayedCall(Math.max(0, durationMs), () => resolve());
    });
  }

  private validateConfig(config: Office422RescueConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Office422RescueSystem: levelId es obligatorio.');
    }

    if (config.rescueId.trim().length === 0) {
      throw new Error('Office422RescueSystem: rescueId es obligatorio.');
    }

    if (config.trigger.width <= 0 || config.trigger.height <= 0) {
      throw new Error('Office422RescueSystem: trigger debe tener width/height positivos.');
    }

    if (config.rescueScene.id.trim().length === 0) {
      throw new Error('Office422RescueSystem: rescueScene.id es obligatorio.');
    }

    if (config.rescueScene.sequence.length === 0) {
      throw new Error('Office422RescueSystem: rescueScene.sequence no puede estar vacío.');
    }

    config.rescueScene.sequence.forEach((step, index) => {
      if (step.id.trim().length === 0) {
        throw new Error(`Office422RescueSystem: rescueScene.sequence[${index}] requiere id.`);
      }

      if (step.actor.trim().length === 0) {
        throw new Error(`Office422RescueSystem: rescueScene.sequence[${index}] requiere actor.`);
      }

      if (step.text.trim().length === 0) {
        throw new Error(`Office422RescueSystem: rescueScene.sequence[${index}] requiere text.`);
      }
    });

    if (config.companion.id.trim().length === 0) {
      throw new Error('Office422RescueSystem: companion.id es obligatorio.');
    }

    if (config.weaponReward.id.trim().length === 0 || config.weaponReward.name.trim().length === 0) {
      throw new Error('Office422RescueSystem: weaponReward.id y weaponReward.name son obligatorios.');
    }

    if (config.weaponReward.ammo < 0) {
      throw new Error('Office422RescueSystem: weaponReward.ammo no puede ser negativo.');
    }

    if (config.groupComposition.addMemberIds.length === 0) {
      throw new Error('Office422RescueSystem: groupComposition.addMemberIds debe tener al menos un miembro.');
    }

    config.rescueScene.rescueVariants?.forEach((variant, index) => {
      if (variant.rescuerCharacterId.trim().length === 0) {
        throw new Error(`Office422RescueSystem: rescueVariants[${index}].rescuerCharacterId es obligatorio.`);
      }

      if (variant.sequence.length === 0) {
        throw new Error(`Office422RescueSystem: rescueVariants[${index}].sequence no puede estar vacío.`);
      }

      variant.sequence.forEach((step, sequenceIndex) => {
        if (step.id.trim().length === 0) {
          throw new Error(`Office422RescueSystem: rescueVariants[${index}].sequence[${sequenceIndex}] requiere id.`);
        }

        if (step.actor.trim().length === 0) {
          throw new Error(`Office422RescueSystem: rescueVariants[${index}].sequence[${sequenceIndex}] requiere actor.`);
        }

        if (step.text.trim().length === 0) {
          throw new Error(`Office422RescueSystem: rescueVariants[${index}].sequence[${sequenceIndex}] requiere text.`);
        }
      });
    });
  }

  private resolveSequenceForRescuer(rescuerCharacterId?: string): {
    sequence: RescueCinematicStep[];
    usedFallback: boolean;
  } {
    const variants = this.config.rescueScene.rescueVariants;
    if (!rescuerCharacterId || !variants || variants.length === 0) {
      return {
        sequence: this.config.rescueScene.sequence,
        usedFallback: true
      };
    }

    const variant = variants.find((entry) => entry.rescuerCharacterId === rescuerCharacterId);
    if (!variant) {
      return {
        sequence: this.config.rescueScene.sequence,
        usedFallback: true
      };
    }

    return {
      sequence: variant.sequence,
      usedFallback: false
    };
  }
}
