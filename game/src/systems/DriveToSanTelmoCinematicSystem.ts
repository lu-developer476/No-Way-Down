import Phaser from 'phaser';

export interface DriveDialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
  mood?: 'tension' | 'cansancio' | 'quebrado' | 'determinacion';
}

export interface DriveRouteBeat {
  id: string;
  label: string;
  distanceToBarrioBlocks: number;
}

export interface DriveAmbushTriggerConfig {
  id: string;
  distanceToBarrioBlocks: number;
  objectiveId: string;
  objectiveLabel: string;
}

export interface DriveToSanTelmoCinematicConfig {
  levelId: string;
  cinematicId: string;
  triggerId: string;
  movementLocked: boolean;
  cameraShakeOnStartMs: number;
  preDialoguePauseMs: number;
  routeBeats: DriveRouteBeat[];
  dialogue: DriveDialogueLine[];
  ambushTrigger: DriveAmbushTriggerConfig;
}

export interface DriveToSanTelmoPresentation {
  showDialogueLine: (
    line: DriveDialogueLine,
    context: { cinematicId: string; lineIndex: number; routeBeatId: string }
  ) => void;
  showRouteBeat: (beat: DriveRouteBeat, context: { cinematicId: string; routeBeatIndex: number }) => void;
  clearDialogue: (context: { cinematicId: string }) => void;
}

export interface DriveToSanTelmoCallbacks {
  onCinematicStarted?: (context: { cinematicId: string; triggerId: string }) => void;
  onCinematicCompleted?: (context: { cinematicId: string; triggerId: string }) => void;
  onMovementLockChanged?: (locked: boolean, context: { cinematicId: string }) => void;
  onFinalAmbushPrepared?: (trigger: DriveAmbushTriggerConfig, context: { cinematicId: string }) => void;
}

const DEFAULT_LINE_DURATION_MS = 2400;

/**
 * Epílogo intermedio de trayecto en auto para Nivel 10.
 *
 * Flujo:
 * 1) Se activa al escapar del edificio y congela input para priorizar lectura narrativa.
 * 2) Recorre beats de ruta hacia San Telmo con diálogo quebrado de los dos sobrevivientes.
 * 3) Cierra preparando el trigger de emboscada final exactamente a dos cuadras del barrio.
 */
export class DriveToSanTelmoCinematicSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: DriveToSanTelmoCinematicConfig;
  private readonly presentation: DriveToSanTelmoPresentation;
  private readonly callbacks: DriveToSanTelmoCallbacks;

  private played = false;
  private activeSequence?: Promise<void>;

  static fromJson(
    scene: Phaser.Scene,
    config: DriveToSanTelmoCinematicConfig,
    presentation: DriveToSanTelmoPresentation,
    callbacks: DriveToSanTelmoCallbacks = {}
  ): DriveToSanTelmoCinematicSystem {
    return new DriveToSanTelmoCinematicSystem(scene, config, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: DriveToSanTelmoCinematicConfig,
    presentation: DriveToSanTelmoPresentation,
    callbacks: DriveToSanTelmoCallbacks = {}
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
    }

    if (this.config.cameraShakeOnStartMs > 0) {
      this.scene.cameras.main.shake(this.config.cameraShakeOnStartMs, 0.0018, true);
    }

    await this.wait(this.config.preDialoguePauseMs);

    for (let lineIndex = 0; lineIndex < this.config.dialogue.length; lineIndex += 1) {
      const line = this.config.dialogue[lineIndex];
      const routeBeat = this.config.routeBeats[Math.min(lineIndex, this.config.routeBeats.length - 1)];

      this.presentation.showRouteBeat(routeBeat, {
        cinematicId: this.config.cinematicId,
        routeBeatIndex: Math.min(lineIndex, this.config.routeBeats.length - 1)
      });

      this.presentation.showDialogueLine(line, {
        cinematicId: this.config.cinematicId,
        lineIndex,
        routeBeatId: routeBeat.id
      });

      await this.wait(line.durationMs ?? DEFAULT_LINE_DURATION_MS);
    }

    this.callbacks.onFinalAmbushPrepared?.(this.config.ambushTrigger, cinematicContext);
    this.presentation.clearDialogue(cinematicContext);

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(false, cinematicContext);
    }

    this.callbacks.onCinematicCompleted?.(callbackContext);
    this.played = true;
  }

  private wait(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.time.delayedCall(Math.max(0, durationMs), () => resolve());
    });
  }

  private validateConfig(config: DriveToSanTelmoCinematicConfig): void {
    if (!config.levelId.trim()) {
      throw new Error('DriveToSanTelmoCinematicSystem: levelId es obligatorio.');
    }

    if (!config.cinematicId.trim()) {
      throw new Error('DriveToSanTelmoCinematicSystem: cinematicId es obligatorio.');
    }

    if (!config.triggerId.trim()) {
      throw new Error('DriveToSanTelmoCinematicSystem: triggerId es obligatorio.');
    }

    if (config.dialogue.length === 0) {
      throw new Error('DriveToSanTelmoCinematicSystem: se requiere al menos una línea de diálogo.');
    }

    if (config.routeBeats.length === 0) {
      throw new Error('DriveToSanTelmoCinematicSystem: routeBeats debe contener al menos un punto narrativo.');
    }

    if (!config.ambushTrigger.id.trim()) {
      throw new Error('DriveToSanTelmoCinematicSystem: ambushTrigger.id es obligatorio.');
    }

    if (config.ambushTrigger.distanceToBarrioBlocks !== 2) {
      throw new Error('DriveToSanTelmoCinematicSystem: la emboscada final debe quedar a dos cuadras del barrio.');
    }

    if (!config.ambushTrigger.objectiveId.trim() || !config.ambushTrigger.objectiveLabel.trim()) {
      throw new Error('DriveToSanTelmoCinematicSystem: objectiveId y objectiveLabel son obligatorios para la emboscada.');
    }
  }
}
