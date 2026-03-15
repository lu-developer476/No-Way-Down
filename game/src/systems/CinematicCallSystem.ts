import Phaser from 'phaser';

export interface CinematicDialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface CinematicCallConfig {
  id: string;
  trigger: {
    type: 'narrative-checkpoint';
    checkpointId: string;
  };
  movementLocked: boolean;
  preDialoguePauseMs: number;
  dialogue: CinematicDialogueLine[];
  objectiveAfterCall: string;
}

export interface CinematicCallSystemConfig {
  levelId: string;
  cinematics: CinematicCallConfig[];
}

export interface CinematicCallPresentation {
  showDialogueLine: (line: CinematicDialogueLine, cinematic: CinematicCallConfig) => void;
  clearDialogue: (cinematic: CinematicCallConfig) => void;
}

export interface CinematicCallCallbacks {
  onCinematicStarted?: (cinematic: CinematicCallConfig) => void;
  onCinematicCompleted?: (cinematic: CinematicCallConfig) => void;
  onMovementLockChanged?: (locked: boolean, cinematic: CinematicCallConfig) => void;
  onObjectiveUpdated?: (objectiveText: string, cinematic: CinematicCallConfig) => void;
  consumeAdvance?: () => boolean;
  isSkipRequested?: () => boolean;
}

interface RuntimeCinematic {
  config: CinematicCallConfig;
  played: boolean;
}

const DEFAULT_LINE_DURATION_MS = 1800;

/**
 * Sistema desacoplado para cinemáticas narrativas con diálogo en Phaser.
 *
 * Flujo esperado:
 * 1) Un sistema externo (ej. NarrativeCheckpointSystem) invoca triggerByCheckpoint.
 * 2) Se bloquea el movimiento, se aplica una pausa breve y se muestran líneas de diálogo.
 * 3) Se limpia el diálogo, se actualiza objetivo y se desbloquea movimiento.
 */
export class CinematicCallSystem {
  private readonly scene: Phaser.Scene;
  private readonly presentation: CinematicCallPresentation;
  private readonly callbacks: CinematicCallCallbacks;
  private readonly cinematicsByCheckpointId = new Map<string, RuntimeCinematic>();
  private activeSequence?: Promise<void>;

  static fromJson(
    scene: Phaser.Scene,
    jsonConfig: CinematicCallSystemConfig,
    presentation: CinematicCallPresentation,
    callbacks: CinematicCallCallbacks = {}
  ): CinematicCallSystem {
    return new CinematicCallSystem(scene, jsonConfig, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: CinematicCallSystemConfig,
    presentation: CinematicCallPresentation,
    callbacks: CinematicCallCallbacks = {}
  ) {
    this.scene = scene;
    this.presentation = presentation;
    this.callbacks = callbacks;

    this.validateConfig(config);

    config.cinematics.forEach((cinematic) => {
      this.cinematicsByCheckpointId.set(cinematic.trigger.checkpointId, {
        config: cinematic,
        played: false
      });
    });
  }

  isPlaying(): boolean {
    return Boolean(this.activeSequence);
  }

  hasPlayed(checkpointId: string): boolean {
    return this.cinematicsByCheckpointId.get(checkpointId)?.played ?? false;
  }

  triggerByCheckpoint(checkpointId: string): Promise<void> {
    const runtimeCinematic = this.cinematicsByCheckpointId.get(checkpointId);
    if (!runtimeCinematic || runtimeCinematic.played) {
      return Promise.resolve();
    }

    if (this.activeSequence) {
      return this.activeSequence;
    }

    this.activeSequence = this.runCinematic(runtimeCinematic)
      .finally(() => {
        this.activeSequence = undefined;
      });

    return this.activeSequence;
  }

  private async runCinematic(runtimeCinematic: RuntimeCinematic): Promise<void> {
    const { config } = runtimeCinematic;

    this.callbacks.onCinematicStarted?.(config);

    if (config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(true, config);
    }

    await this.wait(config.preDialoguePauseMs, false);

    for (const line of config.dialogue) {
      this.presentation.showDialogueLine(line, config);
      await this.wait(line.durationMs ?? DEFAULT_LINE_DURATION_MS, true);

      if (this.callbacks.isSkipRequested?.()) {
        break;
      }
    }

    this.presentation.clearDialogue(config);
    this.callbacks.onObjectiveUpdated?.(config.objectiveAfterCall, config);

    if (config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(false, config);
    }

    runtimeCinematic.played = true;
    this.callbacks.onCinematicCompleted?.(config);
  }

  private wait(durationMs: number, allowAdvance: boolean): Promise<void> {
    const normalizedDuration = Math.max(0, durationMs);

    return new Promise((resolve) => {
      const timeoutEvent = this.scene.time.delayedCall(normalizedDuration, () => {
        pollEvent.remove(false);
        resolve();
      });

      const pollEvent = this.scene.time.addEvent({
        delay: 50,
        loop: true,
        callback: () => {
          const shouldSkip = this.callbacks.isSkipRequested?.() ?? false;
          const shouldAdvance = allowAdvance && (this.callbacks.consumeAdvance?.() ?? false);
          if (!shouldSkip && !shouldAdvance) {
            return;
          }

          timeoutEvent.remove(false);
          pollEvent.remove(false);
          resolve();
        }
      });
    });
  }

  private validateConfig(config: CinematicCallSystemConfig): void {
    if (config.cinematics.length === 0) {
      throw new Error('CinematicCallSystem: se requiere al menos una cinemática.');
    }

    const seenCinematicIds = new Set<string>();
    const seenCheckpointIds = new Set<string>();

    config.cinematics.forEach((cinematic) => {
      if (seenCinematicIds.has(cinematic.id)) {
        throw new Error(`CinematicCallSystem: id de cinemática duplicado "${cinematic.id}".`);
      }

      seenCinematicIds.add(cinematic.id);

      const checkpointId = cinematic.trigger.checkpointId.trim();
      if (checkpointId.length === 0) {
        throw new Error(`CinematicCallSystem: la cinemática "${cinematic.id}" requiere checkpointId.`);
      }

      if (seenCheckpointIds.has(checkpointId)) {
        throw new Error(`CinematicCallSystem: checkpointId duplicado "${checkpointId}".`);
      }

      seenCheckpointIds.add(checkpointId);

      if (cinematic.dialogue.length === 0) {
        throw new Error(`CinematicCallSystem: la cinemática "${cinematic.id}" requiere diálogo.`);
      }

      if (cinematic.objectiveAfterCall.trim().length === 0) {
        throw new Error(`CinematicCallSystem: la cinemática "${cinematic.id}" requiere objectiveAfterCall.`);
      }
    });
  }
}
