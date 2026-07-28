import Phaser from 'phaser';

export type ExitEGroupVariant = 'complete_group' | 'reduced_group';

export interface ExitEDialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface ExitEObjective {
  id: string;
  label: string;
}

export interface ExitEGroupDialogueConfig {
  complete_group: ExitEDialogueLine[];
  reduced_group: ExitEDialogueLine[];
}

export interface ExitECinematicDecisionConfig {
  levelId: string;
  cinematicId: string;
  movementLocked: boolean;
  preDialoguePauseMs: number;
  objectiveUpdatePauseMs: number;
  dialogueByGroup: ExitEGroupDialogueConfig;
  objectiveAfterDecision: ExitEObjective;
}

export interface ExitEPresentation {
  showDialogueLine: (
    line: ExitEDialogueLine,
    context: { cinematicId: string; lineIndex: number; groupVariant: ExitEGroupVariant }
  ) => void;
  clearDialogue: (context: { cinematicId: string }) => void;
}

export interface ExitECallbacks {
  onCinematicStarted?: (context: { cinematicId: string; groupVariant: ExitEGroupVariant }) => void;
  onCinematicCompleted?: (context: { cinematicId: string; groupVariant: ExitEGroupVariant }) => void;
  onMovementLockChanged?: (locked: boolean, context: { cinematicId: string }) => void;
  onSearchPhaseClosed?: (context: { cinematicId: string }) => void;
  onLeaderDecisionDeclared?: (context: { cinematicId: string; destination: 'subsuelo_3_estacionamiento' }) => void;
  onObjectiveUpdated?: (objective: ExitEObjective) => void;
}

export interface ExitEPlaybackOptions {
  survivorCount: number;
  canonicalGroupSize: number;
  forceVariant?: ExitEGroupVariant;
}

const DEFAULT_LINE_DURATION_MS = 2200;

/**
 * Cinemática narrativa para salida E del nivel 9.
 *
 * Flujo:
 * 1) Se confirma que la búsqueda de salidas en planta baja fracasó (persianas bajas).
 * 2) El grupo debate entre volver al 1° subsuelo o intentar una ruta alternativa.
 * 3) El protagonista impone la decisión: bajar al estacionamiento del 3° subsuelo.
 * 4) Se actualiza el objetivo para iniciar la siguiente fase.
 */
export class ExitECinematicDecisionSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: ExitECinematicDecisionConfig;
  private readonly presentation: ExitEPresentation;
  private readonly callbacks: ExitECallbacks;

  private activeSequence?: Promise<void>;
  private played = false;

  static fromJson(
    scene: Phaser.Scene,
    jsonConfig: ExitECinematicDecisionConfig,
    presentation: ExitEPresentation,
    callbacks: ExitECallbacks = {}
  ): ExitECinematicDecisionSystem {
    return new ExitECinematicDecisionSystem(scene, jsonConfig, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: ExitECinematicDecisionConfig,
    presentation: ExitEPresentation,
    callbacks: ExitECallbacks = {}
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

  playDecision(options: ExitEPlaybackOptions): Promise<void> {
    if (this.played) {
      return Promise.resolve();
    }

    if (this.activeSequence) {
      return this.activeSequence;
    }

    const groupVariant = this.resolveGroupVariant(options);

    this.activeSequence = this.runSequence(groupVariant).finally(() => {
      this.activeSequence = undefined;
    });

    return this.activeSequence;
  }

  private async runSequence(groupVariant: ExitEGroupVariant): Promise<void> {
    const cinematicContext = { cinematicId: this.config.cinematicId };
    const variantContext = { cinematicId: this.config.cinematicId, groupVariant };
    const lines = this.config.dialogueByGroup[groupVariant];

    this.callbacks.onCinematicStarted?.(variantContext);

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(true, cinematicContext);
    }

    await this.wait(this.config.preDialoguePauseMs);
    this.callbacks.onSearchPhaseClosed?.(cinematicContext);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      this.presentation.showDialogueLine(line, {
        cinematicId: this.config.cinematicId,
        lineIndex,
        groupVariant
      });

      if (lineIndex === lines.length - 2) {
        this.callbacks.onLeaderDecisionDeclared?.({
          cinematicId: this.config.cinematicId,
          destination: 'subsuelo_3_estacionamiento'
        });
      }

      await this.wait(line.durationMs ?? DEFAULT_LINE_DURATION_MS);
    }

    this.presentation.clearDialogue(cinematicContext);
    await this.wait(this.config.objectiveUpdatePauseMs);

    this.callbacks.onObjectiveUpdated?.(this.config.objectiveAfterDecision);

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(false, cinematicContext);
    }

    this.callbacks.onCinematicCompleted?.(variantContext);
    this.played = true;
  }

  private resolveGroupVariant(options: ExitEPlaybackOptions): ExitEGroupVariant {
    if (options.forceVariant) {
      return options.forceVariant;
    }

    if (!Number.isFinite(options.survivorCount) || options.survivorCount < 1) {
      throw new Error('ExitECinematicDecisionSystem: survivorCount debe ser un entero positivo.');
    }

    if (!Number.isFinite(options.canonicalGroupSize) || options.canonicalGroupSize < 1) {
      throw new Error('ExitECinematicDecisionSystem: canonicalGroupSize debe ser un entero positivo.');
    }

    return options.survivorCount < options.canonicalGroupSize ? 'reduced_group' : 'complete_group';
  }

  private wait(durationMs: number): Promise<void> {
    const normalizedDuration = Math.max(0, durationMs);

    return new Promise((resolve) => {
      this.scene.time.delayedCall(normalizedDuration, () => resolve());
    });
  }

  private validateConfig(config: ExitECinematicDecisionConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('ExitECinematicDecisionSystem: levelId es obligatorio.');
    }

    if (config.cinematicId.trim().length === 0) {
      throw new Error('ExitECinematicDecisionSystem: cinematicId es obligatorio.');
    }

    if (config.dialogueByGroup.complete_group.length === 0) {
      throw new Error('ExitECinematicDecisionSystem: complete_group requiere al menos una línea.');
    }

    if (config.dialogueByGroup.reduced_group.length === 0) {
      throw new Error('ExitECinematicDecisionSystem: reduced_group requiere al menos una línea.');
    }

    if (config.objectiveAfterDecision.id.trim().length === 0) {
      throw new Error('ExitECinematicDecisionSystem: objectiveAfterDecision.id es obligatorio.');
    }

    if (config.objectiveAfterDecision.label.trim().length === 0) {
      throw new Error('ExitECinematicDecisionSystem: objectiveAfterDecision.label es obligatorio.');
    }
  }
}
