import Phaser from 'phaser';

export interface Level10IntroDialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
  mood?: 'sobrio' | 'duelo' | 'tension' | 'determinacion';
}

export interface Level10IntroInventorySnapshot {
  foodRations: number;
  medkits: number;
  ammo9mm: number;
  ammo12gauge: number;
  usableWeapons: string[];
  squadInjuries: string[];
}

export interface Level10IntroObjective {
  id: string;
  label: string;
}

export interface Level10ParkingIntroDialogueConfig {
  levelId: string;
  cinematicId: string;
  triggerId: string;
  movementLocked: boolean;
  movementLockMs: number;
  preDialoguePauseMs: number;
  dialogue: Level10IntroDialogueLine[];
  objectiveAfterCinematic: Level10IntroObjective;
}

export interface Level10IntroPresentation {
  showDialogueLine: (line: Level10IntroDialogueLine, context: { cinematicId: string; lineIndex: number }) => void;
  clearDialogue: (context: { cinematicId: string }) => void;
  showInventorySummary?: (
    snapshot: Level10IntroInventorySnapshot,
    context: { cinematicId: string; triggerId: string }
  ) => void;
}

export interface Level10IntroCallbacks {
  onCinematicStarted?: (context: { cinematicId: string; triggerId: string }) => void;
  onCinematicCompleted?: (context: { cinematicId: string; triggerId: string }) => void;
  onMovementLockChanged?: (locked: boolean, context: { cinematicId: string }) => void;
  onObjectiveUpdated?: (objective: Level10IntroObjective) => void;
  onInventoryReviewed?: (snapshot: Level10IntroInventorySnapshot) => void;
}

const DEFAULT_LINE_DURATION_MS = 2100;

/**
 * Cinemática narrativa de apertura para el Nivel 10 (3° subsuelo / estacionamiento).
 *
 * Flujo:
 * 1) Se activa por trigger, bloquea movimiento brevemente y pausa para framing del entorno.
 * 2) Ejecuta diálogo estructurado desde JSON (estado del parking, duelo, inventario y heridas).
 * 3) Expone el resumen de inventario para UI/log y cierra la escena.
 * 4) Desbloquea movimiento y actualiza el nuevo objetivo de progresión.
 */
export class Level10ParkingIntroCinematicSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: Level10ParkingIntroDialogueConfig;
  private readonly presentation: Level10IntroPresentation;
  private readonly callbacks: Level10IntroCallbacks;

  private played = false;
  private activeSequence?: Promise<void>;

  static fromJson(
    scene: Phaser.Scene,
    config: Level10ParkingIntroDialogueConfig,
    presentation: Level10IntroPresentation,
    callbacks: Level10IntroCallbacks = {}
  ): Level10ParkingIntroCinematicSystem {
    return new Level10ParkingIntroCinematicSystem(scene, config, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: Level10ParkingIntroDialogueConfig,
    presentation: Level10IntroPresentation,
    callbacks: Level10IntroCallbacks = {}
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

  play(triggerId: string, inventorySnapshot: Level10IntroInventorySnapshot): Promise<void> {
    if (this.played || triggerId !== this.config.triggerId) {
      return Promise.resolve();
    }

    if (this.activeSequence) {
      return this.activeSequence;
    }

    this.activeSequence = this.runSequence(inventorySnapshot).finally(() => {
      this.activeSequence = undefined;
    });

    return this.activeSequence;
  }

  private async runSequence(inventorySnapshot: Level10IntroInventorySnapshot): Promise<void> {
    const cinematicContext = { cinematicId: this.config.cinematicId };
    const callbackContext = { cinematicId: this.config.cinematicId, triggerId: this.config.triggerId };

    this.callbacks.onCinematicStarted?.(callbackContext);

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(true, cinematicContext);
      await this.wait(this.config.movementLockMs);
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

    this.presentation.showInventorySummary?.(inventorySnapshot, callbackContext);
    this.callbacks.onInventoryReviewed?.(inventorySnapshot);

    this.presentation.clearDialogue(cinematicContext);

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(false, cinematicContext);
    }

    this.callbacks.onObjectiveUpdated?.(this.config.objectiveAfterCinematic);
    this.callbacks.onCinematicCompleted?.(callbackContext);

    this.played = true;
  }

  private wait(durationMs: number): Promise<void> {
    const normalizedDuration = Math.max(0, durationMs);
    return new Promise((resolve) => {
      this.scene.time.delayedCall(normalizedDuration, () => resolve());
    });
  }

  private validateConfig(config: Level10ParkingIntroDialogueConfig): void {
    if (!config.levelId.trim()) {
      throw new Error('Level10ParkingIntroCinematicSystem: levelId es obligatorio.');
    }

    if (!config.cinematicId.trim()) {
      throw new Error('Level10ParkingIntroCinematicSystem: cinematicId es obligatorio.');
    }

    if (!config.triggerId.trim()) {
      throw new Error('Level10ParkingIntroCinematicSystem: triggerId es obligatorio.');
    }

    if (config.dialogue.length === 0) {
      throw new Error('Level10ParkingIntroCinematicSystem: se requiere al menos una línea de diálogo.');
    }

    if (!config.objectiveAfterCinematic.id.trim()) {
      throw new Error('Level10ParkingIntroCinematicSystem: objectiveAfterCinematic.id es obligatorio.');
    }

    if (!config.objectiveAfterCinematic.label.trim()) {
      throw new Error('Level10ParkingIntroCinematicSystem: objectiveAfterCinematic.label es obligatorio.');
    }
  }
}
