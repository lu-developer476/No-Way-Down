import Phaser from 'phaser';
import { DialogueChoice, DialogueLine, DialogueSystem } from './DialogueSystem';

export interface CinematicLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface CinematicAction {
  id: string;
  payload?: Record<string, string | number | boolean>;
  durationMs?: number;
}

export interface CinematicStep {
  kind: 'line' | 'action';
  line?: CinematicLine;
  action?: CinematicAction;
}

export interface LegacyCinematicConfig {
  cinematicId: string;
  movementLocked?: boolean;
  preDelayMs?: number;
  steps: CinematicStep[];
}

export interface CinematicPresentation {
  showLine: (line: CinematicLine, context: { cinematicId: string; index: number }) => void;
  showAction?: (action: CinematicAction, context: { cinematicId: string; index: number }) => void;
  clear: (context: { cinematicId: string }) => void;
}

export interface CinematicCallbacks {
  onStart?: (context: { cinematicId: string }) => void;
  onEnd?: (context: { cinematicId: string }) => void;
  onMovementLock?: (locked: boolean, context: { cinematicId: string }) => void;
  onAction?: (action: CinematicAction, context: { cinematicId: string; index: number }) => void;
  consumeAdvance?: () => boolean;
  isSkipRequested?: () => boolean;
}

export interface CameraPathPoint {
  x: number;
  y: number;
  zoom?: number;
  holdMs?: number;
}

export interface CinematicConfig {
  cinematic_id: string;
  cameraPath: CameraPathPoint[];
  dialogueSequence: DialogueLine[];
  duration: number;
  pauseGameplay?: boolean;
}

export interface DataCinematicCallbacks {
  onGameplayPauseChanged?: (paused: boolean, cinematicId: string) => void;
  onCinematicStarted?: (cinematicId: string) => void;
  onCinematicCompleted?: (cinematicId: string) => void;
  onDialogueChoiceRequested?: (
    line: DialogueLine,
    choices: DialogueChoice[],
    context: { cinematicId: string; lineIndex: number }
  ) => Promise<number> | number;
  isDialogueInterrupted?: (context: { cinematicId: string }) => boolean;
}

export class CinematicSystem {
  private readonly scene: Phaser.Scene;
  private readonly cinematicsById = new Map<string, CinematicConfig>();
  private readonly dialogueSystem?: DialogueSystem;
  private readonly dataCallbacks: DataCinematicCallbacks;
  private activeCinematic?: Promise<void>;

  constructor(
    scene: Phaser.Scene,
    cinematics: CinematicConfig[] = [],
    dialogueSystem?: DialogueSystem,
    callbacks: DataCinematicCallbacks = {}
  ) {
    this.scene = scene;
    this.dialogueSystem = dialogueSystem;
    this.dataCallbacks = callbacks;

    cinematics.forEach((cinematic) => {
      this.cinematicsById.set(cinematic.cinematic_id, cinematic);
    });
  }

  isPlaying(): boolean {
    return Boolean(this.activeCinematic);
  }

  async play(config: LegacyCinematicConfig, presentation: CinematicPresentation, callbacks: CinematicCallbacks = {}): Promise<void> {
    const context = { cinematicId: config.cinematicId };
    callbacks.onStart?.(context);

    if (config.movementLocked) {
      callbacks.onMovementLock?.(true, context);
    }

    await this.waitWithControl(config.preDelayMs ?? 0, callbacks, false);

    for (let index = 0; index < config.steps.length; index += 1) {
      const step = config.steps[index];
      if (step.kind === 'line' && step.line) {
        presentation.showLine(step.line, { cinematicId: config.cinematicId, index });
        await this.waitWithControl(step.line.durationMs ?? 1800, callbacks, true);
      }

      if (callbacks.isSkipRequested?.()) {
        break;
      }

      if (step.kind === 'action' && step.action) {
        presentation.showAction?.(step.action, { cinematicId: config.cinematicId, index });
        callbacks.onAction?.(step.action, { cinematicId: config.cinematicId, index });
        await this.waitWithControl(step.action.durationMs ?? 800, callbacks, false);
      }

      if (callbacks.isSkipRequested?.()) {
        break;
      }
    }

    presentation.clear(context);

    if (config.movementLocked) {
      callbacks.onMovementLock?.(false, context);
    }

    callbacks.onEnd?.(context);
  }

  playById(cinematicId: string): Promise<void> {
    const cinematic = this.cinematicsById.get(cinematicId);
    if (!cinematic || !this.dialogueSystem) {
      return Promise.resolve();
    }

    if (this.activeCinematic) {
      return this.activeCinematic;
    }

    this.activeCinematic = this.runDataDriven(cinematic).finally(() => {
      this.activeCinematic = undefined;
    });

    return this.activeCinematic;
  }

  private async runDataDriven(config: CinematicConfig): Promise<void> {
    this.dataCallbacks.onCinematicStarted?.(config.cinematic_id);

    const shouldPauseGameplay = config.pauseGameplay ?? true;
    if (shouldPauseGameplay) {
      this.dataCallbacks.onGameplayPauseChanged?.(true, config.cinematic_id);
    }

    const totalDurationMs = Math.max(0, config.duration);
    const cameraTimeline = this.playCameraPath(config.cameraPath, totalDurationMs);
    const dialogueTimeline = this.playDialogue(config.dialogueSequence, totalDurationMs, config.cinematic_id);

    await Promise.all([cameraTimeline, dialogueTimeline, this.wait(totalDurationMs)]);

    this.dialogueSystem?.clear(config.cinematic_id);

    if (shouldPauseGameplay) {
      this.dataCallbacks.onGameplayPauseChanged?.(false, config.cinematic_id);
    }

    this.dataCallbacks.onCinematicCompleted?.(config.cinematic_id);
  }

  private async playCameraPath(cameraPath: CameraPathPoint[], totalDurationMs: number): Promise<void> {
    if (cameraPath.length === 0 || totalDurationMs <= 0) {
      return;
    }

    const camera = this.scene.cameras.main;
    const segmentDuration = Math.max(1, Math.round(totalDurationMs / cameraPath.length));

    for (const point of cameraPath) {
      camera.pan(point.x, point.y, segmentDuration, Phaser.Math.Easing.Sine.InOut, true);
      if (typeof point.zoom === 'number') {
        camera.zoomTo(point.zoom, segmentDuration, Phaser.Math.Easing.Sine.InOut, true);
      }

      await this.wait(segmentDuration + Math.max(0, point.holdMs ?? 0));
    }
  }

  private async playDialogue(lines: DialogueLine[], totalDurationMs: number, cinematicId: string): Promise<void> {
    if (lines.length === 0 || totalDurationMs <= 0 || !this.dialogueSystem) {
      return;
    }

    const lineDuration = Math.max(1, Math.round(totalDurationMs / lines.length));

    await this.dialogueSystem.playSequence(lines, {
      context: { cinematicId },
      onLine: (line) => this.wait(line.durationMs ?? lineDuration),
      onChoiceRequested: (line, choices) => this.dataCallbacks.onDialogueChoiceRequested?.(line, choices, {
        cinematicId,
        lineIndex: lines.indexOf(line)
      }) ?? 0,
      shouldInterrupt: () => this.dataCallbacks.isDialogueInterrupted?.({ cinematicId }) ?? false
    });
  }

  private wait(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.time.delayedCall(Math.max(0, durationMs), () => resolve());
    });
  }

  private waitWithControl(durationMs: number, callbacks: CinematicCallbacks, allowAdvance: boolean): Promise<void> {
    return new Promise((resolve) => {
      const timeoutEvent = this.scene.time.delayedCall(Math.max(0, durationMs), () => {
        pollEvent.remove(false);
        resolve();
      });

      const pollEvent = this.scene.time.addEvent({
        delay: 50,
        loop: true,
        callback: () => {
          const shouldSkip = callbacks.isSkipRequested?.() ?? false;
          const shouldAdvance = allowAdvance && (callbacks.consumeAdvance?.() ?? false);

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
}
