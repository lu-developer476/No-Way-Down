import Phaser from 'phaser';

export type TwinBiteActionId =
  | 'focus_vehicle'
  | 'infected_emerge_under_truck'
  | 'bite_left_leg_brunette'
  | 'redhead_pullback'
  | 'attract_zombies'
  | 'blackhair_find_car'
  | 'blackhair_finish_owners'
  | 'announce_rally_point'
  | 'trigger_main_combat'
  | 'start_infection'
  | 'set_rally_point'
  | 'activate_defense_system';

export interface TwinBiteDialogueStep {
  type: 'dialogue';
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface TwinBiteActionStep {
  type: 'action';
  actionId: TwinBiteActionId;
  description: string;
  durationMs?: number;
  payload?: Record<string, string | number | boolean>;
}

export type TwinBiteSequenceStep = TwinBiteDialogueStep | TwinBiteActionStep;

export interface TwinBiteObjective {
  id: string;
  label: string;
}

export interface TwinBiteParkingCinematicConfig {
  levelId: string;
  cinematicId: string;
  triggerId: string;
  movementLocked: boolean;
  movementLockMs: number;
  preDialoguePauseMs: number;
  sequence: TwinBiteSequenceStep[];
  objectiveAfterCinematic: TwinBiteObjective;
}

export interface TwinBitePresentation {
  showDialogueLine: (line: TwinBiteDialogueStep, context: { cinematicId: string; stepIndex: number }) => void;
  showAction: (action: TwinBiteActionStep, context: { cinematicId: string; stepIndex: number }) => void;
  clearDialogue: (context: { cinematicId: string }) => void;
}

export interface TwinBiteCallbacks {
  onCinematicStarted?: (context: { cinematicId: string; triggerId: string }) => void;
  onCinematicCompleted?: (context: { cinematicId: string; triggerId: string }) => void;
  onMovementLockChanged?: (locked: boolean, context: { cinematicId: string }) => void;
  onActionExecuted?: (action: TwinBiteActionStep, context: { cinematicId: string; stepIndex: number }) => void;
  onMainCombatTriggered?: (context: { cinematicId: string }) => void;
  onInfectionStarted?: (context: { cinematicId: string; victimId: string; infectedLimb: string }) => void;
  onRallyPointSet?: (context: { cinematicId: string; rallyPointId: string }) => void;
  onDefenseSystemActivated?: (context: { cinematicId: string }) => void;
  onObjectiveUpdated?: (objective: TwinBiteObjective) => void;
}

const DEFAULT_DIALOGUE_DURATION_MS = 2200;
const DEFAULT_ACTION_DURATION_MS = 800;

/**
 * Cinemática narrativa del evento de mordida bajo camioneta en Nivel 10.
 *
 * Objetivos narrativos/técnicos:
 * 1) Disparar combate principal cuando el grito atrae la horda.
 * 2) Marcar inicio de infección en la gemela de pelo castaño.
 * 3) Establecer punto de reunión junto al auto utilizable.
 * 4) Activar sistema de defensa al cerrar la secuencia.
 */
export class TwinBiteParkingCinematicSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: TwinBiteParkingCinematicConfig;
  private readonly presentation: TwinBitePresentation;
  private readonly callbacks: TwinBiteCallbacks;

  private played = false;
  private activeSequence?: Promise<void>;

  static fromJson(
    scene: Phaser.Scene,
    config: TwinBiteParkingCinematicConfig,
    presentation: TwinBitePresentation,
    callbacks: TwinBiteCallbacks = {}
  ): TwinBiteParkingCinematicSystem {
    return new TwinBiteParkingCinematicSystem(scene, config, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: TwinBiteParkingCinematicConfig,
    presentation: TwinBitePresentation,
    callbacks: TwinBiteCallbacks = {}
  ) {
    this.scene = scene;
    this.config = config;
    this.presentation = presentation;
    this.callbacks = callbacks;

    this.validateConfig(config);
  }

  hasPlayed(): boolean {
    return this.played;
  }

  isPlaying(): boolean {
    return Boolean(this.activeSequence);
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
    const callbackContext = { cinematicId: this.config.cinematicId, triggerId: this.config.triggerId };

    this.callbacks.onCinematicStarted?.(callbackContext);

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(true, cinematicContext);
      await this.wait(this.config.movementLockMs);
    }

    await this.wait(this.config.preDialoguePauseMs);

    for (let stepIndex = 0; stepIndex < this.config.sequence.length; stepIndex += 1) {
      const step = this.config.sequence[stepIndex];

      if (step.type === 'dialogue') {
        this.presentation.showDialogueLine(step, { cinematicId: this.config.cinematicId, stepIndex });
        await this.wait(step.durationMs ?? DEFAULT_DIALOGUE_DURATION_MS);
        continue;
      }

      this.presentation.showAction(step, { cinematicId: this.config.cinematicId, stepIndex });
      this.callbacks.onActionExecuted?.(step, { cinematicId: this.config.cinematicId, stepIndex });
      this.dispatchActionCallbacks(step.actionId, step.payload);
      await this.wait(step.durationMs ?? DEFAULT_ACTION_DURATION_MS);
    }

    this.presentation.clearDialogue(cinematicContext);
    this.callbacks.onObjectiveUpdated?.(this.config.objectiveAfterCinematic);

    this.callbacks.onDefenseSystemActivated?.(cinematicContext);

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(false, cinematicContext);
    }

    this.callbacks.onCinematicCompleted?.(callbackContext);
    this.played = true;
  }

  private dispatchActionCallbacks(actionId: TwinBiteActionId, payload?: Record<string, string | number | boolean>): void {
    const cinematicContext = { cinematicId: this.config.cinematicId };

    switch (actionId) {
      case 'trigger_main_combat':
        this.callbacks.onMainCombatTriggered?.(cinematicContext);
        break;
      case 'start_infection':
        this.callbacks.onInfectionStarted?.({
          cinematicId: this.config.cinematicId,
          victimId: String(payload?.victimId ?? 'twin_brown_hair'),
          infectedLimb: String(payload?.infectedLimb ?? 'left_leg')
        });
        break;
      case 'set_rally_point':
        this.callbacks.onRallyPointSet?.({
          cinematicId: this.config.cinematicId,
          rallyPointId: String(payload?.rallyPointId ?? 'auto_4_puertas')
        });
        break;
      case 'activate_defense_system':
        this.callbacks.onDefenseSystemActivated?.(cinematicContext);
        break;
      default:
        break;
    }
  }

  private wait(durationMs: number): Promise<void> {
    const normalizedDuration = Math.max(0, durationMs);

    return new Promise((resolve) => {
      this.scene.time.delayedCall(normalizedDuration, () => resolve());
    });
  }

  private validateConfig(config: TwinBiteParkingCinematicConfig): void {
    if (!config.levelId.trim()) {
      throw new Error('TwinBiteParkingCinematicSystem: levelId es obligatorio.');
    }

    if (!config.cinematicId.trim()) {
      throw new Error('TwinBiteParkingCinematicSystem: cinematicId es obligatorio.');
    }

    if (!config.triggerId.trim()) {
      throw new Error('TwinBiteParkingCinematicSystem: triggerId es obligatorio.');
    }

    if (config.sequence.length === 0) {
      throw new Error('TwinBiteParkingCinematicSystem: se requiere al menos un paso en sequence.');
    }

    if (!config.objectiveAfterCinematic.id.trim()) {
      throw new Error('TwinBiteParkingCinematicSystem: objectiveAfterCinematic.id es obligatorio.');
    }

    if (!config.objectiveAfterCinematic.label.trim()) {
      throw new Error('TwinBiteParkingCinematicSystem: objectiveAfterCinematic.label es obligatorio.');
    }
  }
}
