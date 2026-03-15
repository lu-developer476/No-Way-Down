import Phaser from 'phaser';

export type TwinFinalCollapseActionId =
  | 'second_bite_right_forearm'
  | 'redhead_shock_breakdown'
  | 'brunette_executes_twin'
  | 'brunette_forces_escape'
  | 'enable_vehicle_escape'
  | 'offscreen_final_gunshot_marker';

export interface TwinFinalCollapseDialogueStep {
  type: 'dialogue';
  speaker: string;
  text: string;
  durationMs?: number;
  mood?: string;
}

export interface TwinFinalCollapseActionStep {
  type: 'action';
  actionId: TwinFinalCollapseActionId;
  description: string;
  durationMs?: number;
  payload?: Record<string, string | number | boolean>;
}

export type TwinFinalCollapseSequenceStep = TwinFinalCollapseDialogueStep | TwinFinalCollapseActionStep;

export interface TwinFinalCollapseMember {
  id: string;
  role: 'protagonist' | 'ally' | 'twin';
  status: 'active' | 'infected' | 'deceased' | 'escaped';
  tags?: string[];
}

export interface TwinFinalCollapseObjective {
  id: string;
  label: string;
}

export interface TwinFinalCollapseConfig {
  levelId: string;
  cinematicId: string;
  triggerId: string;
  lockMovement: boolean;
  preSceneDelayMs: number;
  sequence: TwinFinalCollapseSequenceStep[];
  escapeObjective: TwinFinalCollapseObjective;
  twinsRemovedFromGroup: string[];
  survivingGroupIds: string[];
  offscreenGunshotMarkerId: string;
}

export interface TwinFinalCollapsePresentation {
  showDialogueLine: (
    line: TwinFinalCollapseDialogueStep,
    context: { cinematicId: string; stepIndex: number }
  ) => void;
  showAction: (
    action: TwinFinalCollapseActionStep,
    context: { cinematicId: string; stepIndex: number }
  ) => void;
  clearDialogue: (context: { cinematicId: string }) => void;
}

export interface TwinFinalCollapseCallbacks {
  onCinematicStarted?: (context: { cinematicId: string; triggerId: string }) => void;
  onCinematicFinished?: (context: { cinematicId: string; triggerId: string }) => void;
  onMovementLockChanged?: (locked: boolean, context: { cinematicId: string }) => void;
  onActionExecuted?: (action: TwinFinalCollapseActionStep, context: { cinematicId: string; stepIndex: number }) => void;
  onInfectionEscalated?: (context: { cinematicId: string; victimId: string; limb: string }) => void;
  onTwinExecuted?: (context: { cinematicId: string; executorId: string; victimId: string }) => void;
  onVehicleEscapeEnabled?: (context: { cinematicId: string; objective: TwinFinalCollapseObjective }) => void;
  onNarrativeSoundMarker?: (context: { cinematicId: string; markerId: string; description: string }) => void;
  onGroupCompositionUpdated?: (context: {
    cinematicId: string;
    removedMembers: TwinFinalCollapseMember[];
    survivingMembers: TwinFinalCollapseMember[];
  }) => void;
  onObjectiveUpdated?: (objective: TwinFinalCollapseObjective) => void;
}

const DEFAULT_DIALOGUE_DURATION_MS = 2500;
const DEFAULT_ACTION_DURATION_MS = 950;

/**
 * Cinemática post-combate principal del Nivel 10.
 *
 * Objetivos de diseño:
 * 1) Cerrar el arco de las gemelas con un desenlace irreversible.
 * 2) Reducir el grupo a dos supervivientes para la transición de huida.
 * 3) Habilitar la interacción de escape en auto.
 * 4) Representar el disparo final como marcador narrativo/sonoro (sin asset binario).
 */
export class TwinFinalCollapseCinematicSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: TwinFinalCollapseConfig;
  private readonly presentation: TwinFinalCollapsePresentation;
  private readonly callbacks: TwinFinalCollapseCallbacks;
  private readonly groupById: Map<string, TwinFinalCollapseMember>;

  private played = false;
  private activeSequence?: Promise<void>;

  static fromJson(
    scene: Phaser.Scene,
    config: TwinFinalCollapseConfig,
    initialGroup: TwinFinalCollapseMember[],
    presentation: TwinFinalCollapsePresentation,
    callbacks: TwinFinalCollapseCallbacks = {}
  ): TwinFinalCollapseCinematicSystem {
    return new TwinFinalCollapseCinematicSystem(scene, config, initialGroup, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: TwinFinalCollapseConfig,
    initialGroup: TwinFinalCollapseMember[],
    presentation: TwinFinalCollapsePresentation,
    callbacks: TwinFinalCollapseCallbacks = {}
  ) {
    this.scene = scene;
    this.config = config;
    this.presentation = presentation;
    this.callbacks = callbacks;
    this.groupById = new Map(initialGroup.map((member) => [member.id, member]));

    this.validateConfig(config, initialGroup);
  }

  hasPlayed(): boolean {
    return this.played;
  }

  isPlaying(): boolean {
    return Boolean(this.activeSequence);
  }

  getCurrentGroup(): TwinFinalCollapseMember[] {
    return [...this.groupById.values()];
  }

  play(triggerId: string): Promise<void> {
    if (this.played || triggerId !== this.config.triggerId) {
      return Promise.resolve();
    }

    if (this.activeSequence) {
      return this.activeSequence;
    }

    this.activeSequence = this.runSequence().finally(() => {
      this.activeSequence = undefined;
    });

    return this.activeSequence;
  }

  private async runSequence(): Promise<void> {
    const cinematicContext = { cinematicId: this.config.cinematicId };
    const triggerContext = {
      cinematicId: this.config.cinematicId,
      triggerId: this.config.triggerId
    };

    this.callbacks.onCinematicStarted?.(triggerContext);

    if (this.config.lockMovement) {
      this.callbacks.onMovementLockChanged?.(true, cinematicContext);
    }

    await this.wait(this.config.preSceneDelayMs);

    for (let stepIndex = 0; stepIndex < this.config.sequence.length; stepIndex += 1) {
      const step = this.config.sequence[stepIndex];

      if (step.type === 'dialogue') {
        this.presentation.showDialogueLine(step, { cinematicId: this.config.cinematicId, stepIndex });
        await this.wait(step.durationMs ?? DEFAULT_DIALOGUE_DURATION_MS);
        continue;
      }

      this.presentation.showAction(step, { cinematicId: this.config.cinematicId, stepIndex });
      this.callbacks.onActionExecuted?.(step, { cinematicId: this.config.cinematicId, stepIndex });
      this.dispatchActionCallbacks(step);
      await this.wait(step.durationMs ?? DEFAULT_ACTION_DURATION_MS);
    }

    this.presentation.clearDialogue(cinematicContext);

    const removedMembers = this.removeTwinMembers();
    const survivingMembers = this.markAndGetSurvivors();

    this.callbacks.onGroupCompositionUpdated?.({
      cinematicId: this.config.cinematicId,
      removedMembers,
      survivingMembers
    });

    this.callbacks.onObjectiveUpdated?.(this.config.escapeObjective);
    this.callbacks.onVehicleEscapeEnabled?.({
      cinematicId: this.config.cinematicId,
      objective: this.config.escapeObjective
    });

    if (this.config.lockMovement) {
      this.callbacks.onMovementLockChanged?.(false, cinematicContext);
    }

    this.callbacks.onCinematicFinished?.(triggerContext);
    this.played = true;
  }

  private dispatchActionCallbacks(step: TwinFinalCollapseActionStep): void {
    switch (step.actionId) {
      case 'second_bite_right_forearm':
        this.callbacks.onInfectionEscalated?.({
          cinematicId: this.config.cinematicId,
          victimId: String(step.payload?.victimId ?? 'twin_brunette'),
          limb: String(step.payload?.limb ?? 'right_forearm')
        });
        break;
      case 'brunette_executes_twin':
        this.callbacks.onTwinExecuted?.({
          cinematicId: this.config.cinematicId,
          executorId: String(step.payload?.executorId ?? 'twin_brunette'),
          victimId: String(step.payload?.victimId ?? 'twin_redhead')
        });
        break;
      case 'offscreen_final_gunshot_marker':
        this.callbacks.onNarrativeSoundMarker?.({
          cinematicId: this.config.cinematicId,
          markerId: this.config.offscreenGunshotMarkerId,
          description: step.description
        });
        break;
      default:
        break;
    }
  }

  private removeTwinMembers(): TwinFinalCollapseMember[] {
    const removed: TwinFinalCollapseMember[] = [];

    this.config.twinsRemovedFromGroup.forEach((memberId) => {
      const member = this.groupById.get(memberId);
      if (!member) {
        throw new Error(
          `TwinFinalCollapseCinematicSystem: no se encontró el miembro "${memberId}" en la composición del grupo.`
        );
      }

      removed.push({ ...member, status: 'deceased' });
      this.groupById.delete(memberId);
    });

    return removed;
  }

  private markAndGetSurvivors(): TwinFinalCollapseMember[] {
    return this.config.survivingGroupIds.map((memberId) => {
      const member = this.groupById.get(memberId);
      if (!member) {
        throw new Error(
          `TwinFinalCollapseCinematicSystem: no se encontró al superviviente esperado "${memberId}" tras la cinemática.`
        );
      }

      const updated: TwinFinalCollapseMember = {
        ...member,
        status: 'escaped'
      };

      this.groupById.set(memberId, updated);
      return updated;
    });
  }

  private wait(durationMs: number): Promise<void> {
    const normalizedDuration = Math.max(0, durationMs);

    return new Promise((resolve) => {
      this.scene.time.delayedCall(normalizedDuration, () => resolve());
    });
  }

  private validateConfig(config: TwinFinalCollapseConfig, initialGroup: TwinFinalCollapseMember[]): void {
    if (!config.levelId.trim()) {
      throw new Error('TwinFinalCollapseCinematicSystem: levelId es obligatorio.');
    }

    if (!config.cinematicId.trim()) {
      throw new Error('TwinFinalCollapseCinematicSystem: cinematicId es obligatorio.');
    }

    if (!config.triggerId.trim()) {
      throw new Error('TwinFinalCollapseCinematicSystem: triggerId es obligatorio.');
    }

    if (config.sequence.length === 0) {
      throw new Error('TwinFinalCollapseCinematicSystem: se requiere al menos un paso en sequence.');
    }

    if (config.twinsRemovedFromGroup.length !== 2) {
      throw new Error('TwinFinalCollapseCinematicSystem: twinsRemovedFromGroup debe contener exactamente dos IDs.');
    }

    if (config.survivingGroupIds.length !== 2) {
      throw new Error('TwinFinalCollapseCinematicSystem: survivingGroupIds debe contener exactamente dos IDs.');
    }

    if (!config.escapeObjective.id.trim() || !config.escapeObjective.label.trim()) {
      throw new Error('TwinFinalCollapseCinematicSystem: escapeObjective debe definir id y label.');
    }

    if (!config.offscreenGunshotMarkerId.trim()) {
      throw new Error('TwinFinalCollapseCinematicSystem: offscreenGunshotMarkerId es obligatorio.');
    }

    const memberIds = new Set(initialGroup.map((member) => member.id));

    config.twinsRemovedFromGroup.forEach((memberId) => {
      if (!memberIds.has(memberId)) {
        throw new Error(
          `TwinFinalCollapseCinematicSystem: twin removida "${memberId}" no existe en initialGroup.`
        );
      }
    });

    config.survivingGroupIds.forEach((memberId) => {
      if (!memberIds.has(memberId)) {
        throw new Error(
          `TwinFinalCollapseCinematicSystem: superviviente "${memberId}" no existe en initialGroup.`
        );
      }
    });
  }
}
