import Phaser from 'phaser';

export interface ExitADialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface ExitAObjective {
  id: string;
  label: string;
}

export interface ExitADialogueConfig {
  levelId: string;
  cinematicId: string;
  movementLocked: boolean;
  preDialoguePauseMs: number;
  threatRevealPauseMs: number;
  fallbackPauseMs: number;
  dialogue: ExitADialogueLine[];
  objectiveAfterCinematic: ExitAObjective;
}

export interface ExitAPresentation {
  showDialogueLine: (line: ExitADialogueLine, context: { cinematicId: string; lineIndex: number }) => void;
  clearDialogue: (context: { cinematicId: string }) => void;
}

export interface ExitACallbacks {
  onCinematicStarted?: (context: { cinematicId: string }) => void;
  onCinematicCompleted?: (context: { cinematicId: string }) => void;
  onMovementLockChanged?: (locked: boolean, context: { cinematicId: string }) => void;
  onExteriorThreatRevealed?: (context: { cinematicId: string }) => void;
  onTacticalFallbackOrdered?: (context: { cinematicId: string }) => void;
  onObjectiveUpdated?: (objective: ExitAObjective) => void;
}

const DEFAULT_LINE_DURATION_MS = 2000;

/**
 * Cinemática narrativa para la salida A del Nivel 9.
 *
 * Flujo:
 * 1) Falsa esperanza: el grupo cree que puede salir por las puertas giratorias.
 * 2) Amenaza masiva exterior: una marea de infectados en Plaza de Mayo los detecta.
 * 3) Repliegue táctico: se ordena retroceder y se actualiza el objetivo.
 */
export class ExitACinematicSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: ExitADialogueConfig;
  private readonly presentation: ExitAPresentation;
  private readonly callbacks: ExitACallbacks;

  private activeSequence?: Promise<void>;
  private played = false;

  static fromJson(
    scene: Phaser.Scene,
    jsonConfig: ExitADialogueConfig,
    presentation: ExitAPresentation,
    callbacks: ExitACallbacks = {}
  ): ExitACinematicSystem {
    return new ExitACinematicSystem(scene, jsonConfig, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: ExitADialogueConfig,
    presentation: ExitAPresentation,
    callbacks: ExitACallbacks = {}
  ) {
    this.scene = scene;
    this.config = config;
    this.presentation = presentation;
    this.callbacks = callbacks;

    this.validateConfig(config);
  }

  isPlaying(): boolean {
    return Boolean(this.activeSequence);
  }

  hasPlayed(): boolean {
    return this.played;
  }

  play(): Promise<void> {
    if (this.played) {
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

    this.callbacks.onCinematicStarted?.(cinematicContext);

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(true, cinematicContext);
    }

    await this.wait(this.config.preDialoguePauseMs);

    for (let lineIndex = 0; lineIndex < this.config.dialogue.length; lineIndex += 1) {
      const line = this.config.dialogue[lineIndex];
      this.presentation.showDialogueLine(line, {
        cinematicId: this.config.cinematicId,
        lineIndex
      });

      if (lineIndex === 1) {
        this.callbacks.onExteriorThreatRevealed?.(cinematicContext);
        await this.wait(this.config.threatRevealPauseMs);
      }

      if (lineIndex === this.config.dialogue.length - 1) {
        this.callbacks.onTacticalFallbackOrdered?.(cinematicContext);
        await this.wait(this.config.fallbackPauseMs);
      }

      await this.wait(line.durationMs ?? DEFAULT_LINE_DURATION_MS);
    }

    this.presentation.clearDialogue(cinematicContext);

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(false, cinematicContext);
    }

    this.callbacks.onObjectiveUpdated?.(this.config.objectiveAfterCinematic);
    this.callbacks.onCinematicCompleted?.(cinematicContext);

    this.played = true;
  }

  private wait(durationMs: number): Promise<void> {
    const normalizedDuration = Math.max(0, durationMs);

    return new Promise((resolve) => {
      this.scene.time.delayedCall(normalizedDuration, () => resolve());
    });
  }

  private validateConfig(config: ExitADialogueConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('ExitACinematicSystem: levelId es obligatorio.');
    }

    if (config.cinematicId.trim().length === 0) {
      throw new Error('ExitACinematicSystem: cinematicId es obligatorio.');
    }

    if (config.dialogue.length === 0) {
      throw new Error('ExitACinematicSystem: se requiere al menos una línea de diálogo.');
    }

    if (config.objectiveAfterCinematic.id.trim().length === 0) {
      throw new Error('ExitACinematicSystem: objectiveAfterCinematic.id es obligatorio.');
    }

    if (config.objectiveAfterCinematic.label.trim().length === 0) {
      throw new Error('ExitACinematicSystem: objectiveAfterCinematic.label es obligatorio.');
    }
  }
}
