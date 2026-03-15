import Phaser from 'phaser';

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

export interface CinematicConfig {
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
}

export class CinematicSystem {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  async play(config: CinematicConfig, presentation: CinematicPresentation, callbacks: CinematicCallbacks = {}): Promise<void> {
    const context = { cinematicId: config.cinematicId };
    callbacks.onStart?.(context);

    if (config.movementLocked) {
      callbacks.onMovementLock?.(true, context);
    }

    await this.wait(config.preDelayMs ?? 0);

    for (let index = 0; index < config.steps.length; index += 1) {
      const step = config.steps[index];
      if (step.kind === 'line' && step.line) {
        presentation.showLine(step.line, { cinematicId: config.cinematicId, index });
        await this.wait(step.line.durationMs ?? 1800);
      }

      if (step.kind === 'action' && step.action) {
        presentation.showAction?.(step.action, { cinematicId: config.cinematicId, index });
        callbacks.onAction?.(step.action, { cinematicId: config.cinematicId, index });
        await this.wait(step.action.durationMs ?? 800);
      }
    }

    presentation.clear(context);

    if (config.movementLocked) {
      callbacks.onMovementLock?.(false, context);
    }

    callbacks.onEnd?.(context);
  }

  private wait(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.time.delayedCall(Math.max(0, durationMs), () => resolve());
    });
  }
}
