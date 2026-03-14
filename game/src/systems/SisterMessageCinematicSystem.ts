import Phaser from 'phaser';

export interface SisterMessageDialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface SisterMessageObjective {
  id: string;
  label: string;
}

export interface SisterMessageCinematicConfig {
  levelId: string;
  cinematicId: string;
  triggerId: string;
  movementLocked: boolean;
  lockDurationMs: number;
  preDialoguePauseMs: number;
  dialogue: SisterMessageDialogueLine[];
  objectiveAfterCinematic: SisterMessageObjective;
}

export interface SisterMessagePresentation {
  showDialogueLine: (line: SisterMessageDialogueLine, context: { cinematicId: string; lineIndex: number }) => void;
  clearDialogue: (context: { cinematicId: string }) => void;
}

export interface SisterMessageCallbacks {
  onCinematicStarted?: (context: { cinematicId: string; triggerId: string }) => void;
  onCinematicCompleted?: (context: { cinematicId: string; triggerId: string }) => void;
  onMovementLockChanged?: (locked: boolean, context: { cinematicId: string }) => void;
  onObjectiveUpdated?: (objective: SisterMessageObjective) => void;
}

const DEFAULT_LINE_DURATION_MS = 2000;

/**
 * Cinemática posterior al rescate en oficina 422.
 *
 * Flujo:
 * 1) Trigger narrativo en zona de descanso del 4° piso.
 * 2) Bloqueo breve de movimiento + pausa previa para enfatizar urgencia.
 * 3) Diálogo estructurado (mensaje de la hermana y reacción del grupo).
 * 4) Cierre con actualización de objetivo hacia el piso 1 y desbloqueo de movimiento.
 */
export class SisterMessageCinematicSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: SisterMessageCinematicConfig;
  private readonly presentation: SisterMessagePresentation;
  private readonly callbacks: SisterMessageCallbacks;

  private activeSequence?: Promise<void>;
  private played = false;

  static fromJson(
    scene: Phaser.Scene,
    jsonConfig: SisterMessageCinematicConfig,
    presentation: SisterMessagePresentation,
    callbacks: SisterMessageCallbacks = {}
  ): SisterMessageCinematicSystem {
    return new SisterMessageCinematicSystem(scene, jsonConfig, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: SisterMessageCinematicConfig,
    presentation: SisterMessagePresentation,
    callbacks: SisterMessageCallbacks = {}
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

  playAfterRescue(triggerId: string): Promise<void> {
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
      await this.wait(this.config.lockDurationMs);
    }

    await this.wait(this.config.preDialoguePauseMs);

    for (let lineIndex = 0; lineIndex < this.config.dialogue.length; lineIndex += 1) {
      const line = this.config.dialogue[lineIndex];
      this.presentation.showDialogueLine(line, {
        cinematicId: this.config.cinematicId,
        lineIndex
      });

      await this.wait(line.durationMs ?? DEFAULT_LINE_DURATION_MS);
    }

    this.presentation.clearDialogue(cinematicContext);
    this.callbacks.onObjectiveUpdated?.(this.config.objectiveAfterCinematic);

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(false, cinematicContext);
    }

    this.callbacks.onCinematicCompleted?.(callbackContext);
    this.played = true;
  }

  private wait(durationMs: number): Promise<void> {
    const normalizedDuration = Math.max(0, durationMs);

    return new Promise((resolve) => {
      this.scene.time.delayedCall(normalizedDuration, () => resolve());
    });
  }

  private validateConfig(config: SisterMessageCinematicConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('SisterMessageCinematicSystem: levelId es obligatorio.');
    }

    if (config.cinematicId.trim().length === 0) {
      throw new Error('SisterMessageCinematicSystem: cinematicId es obligatorio.');
    }

    if (config.triggerId.trim().length === 0) {
      throw new Error('SisterMessageCinematicSystem: triggerId es obligatorio.');
    }

    if (config.dialogue.length === 0) {
      throw new Error('SisterMessageCinematicSystem: se requiere al menos una línea de diálogo.');
    }

    if (config.objectiveAfterCinematic.id.trim().length === 0) {
      throw new Error('SisterMessageCinematicSystem: objectiveAfterCinematic.id es obligatorio.');
    }

    if (config.objectiveAfterCinematic.label.trim().length === 0) {
      throw new Error('SisterMessageCinematicSystem: objectiveAfterCinematic.label es obligatorio.');
    }
  }
}
