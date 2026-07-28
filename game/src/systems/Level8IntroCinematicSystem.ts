import Phaser from 'phaser';
import { CinematicSystem } from './core/CinematicSystem';

export type Level8IntroNarrativeVariant = 'solo' | 'squad';

export interface Level8IntroDialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface Level8IntroObjective {
  id: string;
  label: string;
}

export interface Level8IntroDialogueConfig {
  levelId: string;
  cinematicId: string;
  movementLocked: boolean;
  preDialoguePauseMs: number;
  dialogueVariants: {
    solo: Level8IntroDialogueLine[];
    squad: Level8IntroDialogueLine[];
  };
  objectiveAfterCinematic: Level8IntroObjective;
}

export interface Level8IntroRuntimeContext {
  hasAiAllies: boolean;
}

export interface Level8IntroPresentation {
  showDialogueLine: (
    line: Level8IntroDialogueLine,
    context: { variant: Level8IntroNarrativeVariant; cinematicId: string; lineIndex: number }
  ) => void;
  clearDialogue: (context: { cinematicId: string }) => void;
}

export interface Level8IntroCallbacks {
  onCinematicStarted?: (context: { cinematicId: string; variant: Level8IntroNarrativeVariant }) => void;
  onCinematicCompleted?: (context: { cinematicId: string; variant: Level8IntroNarrativeVariant }) => void;
  onMovementLockChanged?: (locked: boolean, context: { cinematicId: string }) => void;
  onObjectiveUpdated?: (objective: Level8IntroObjective) => void;
}

/**
 * Cinemática narrativa de introducción del Nivel 8.
 *
 * Flujo:
 * 1) Inicio: bloquea movimiento (si aplica) y espera una pausa corta.
 * 2) Diálogo: reproduce la variante solo/squad en formato estructurado.
 * 3) Cierre: limpia diálogo, desbloquea movimiento y activa el nuevo objetivo.
 */
export class Level8IntroCinematicSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: Level8IntroDialogueConfig;
  private readonly presentation: Level8IntroPresentation;
  private readonly callbacks: Level8IntroCallbacks;

  private readonly cinematicSystem: CinematicSystem;
  private activeSequence?: Promise<void>;
  private played = false;

  static fromJson(
    scene: Phaser.Scene,
    jsonConfig: Level8IntroDialogueConfig,
    presentation: Level8IntroPresentation,
    callbacks: Level8IntroCallbacks = {}
  ): Level8IntroCinematicSystem {
    return new Level8IntroCinematicSystem(scene, jsonConfig, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: Level8IntroDialogueConfig,
    presentation: Level8IntroPresentation,
    callbacks: Level8IntroCallbacks = {}
  ) {
    this.scene = scene;
    this.config = config;
    this.presentation = presentation;
    this.callbacks = callbacks;
    this.cinematicSystem = new CinematicSystem(scene);

    this.validateConfig(config);
  }

  isPlaying(): boolean {
    return Boolean(this.activeSequence);
  }

  hasPlayed(): boolean {
    return this.played;
  }

  playIntro(runtimeContext: Level8IntroRuntimeContext): Promise<void> {
    if (this.played) {
      return Promise.resolve();
    }

    if (this.activeSequence) {
      return this.activeSequence;
    }

    const variant: Level8IntroNarrativeVariant = runtimeContext.hasAiAllies ? 'squad' : 'solo';

    this.activeSequence = this.runSequence(variant).finally(() => {
      this.activeSequence = undefined;
    });

    return this.activeSequence;
  }

  private async runSequence(variant: Level8IntroNarrativeVariant): Promise<void> {
    const lines = this.config.dialogueVariants[variant];

    await this.cinematicSystem.play(
      {
        cinematicId: this.config.cinematicId,
        movementLocked: this.config.movementLocked,
        preDelayMs: this.config.preDialoguePauseMs,
        steps: lines.map((line) => ({ kind: 'line' as const, line }))
      },
      {
        showLine: (line, context) => {
          this.presentation.showDialogueLine(line, {
            variant,
            cinematicId: context.cinematicId,
            lineIndex: context.index
          });
        },
        clear: ({ cinematicId }) => {
          this.presentation.clearDialogue({ cinematicId });
        }
      },
      {
        onStart: ({ cinematicId }) => {
          this.callbacks.onCinematicStarted?.({ cinematicId, variant });
        },
        onEnd: ({ cinematicId }) => {
          this.callbacks.onObjectiveUpdated?.(this.config.objectiveAfterCinematic);
          this.callbacks.onCinematicCompleted?.({ cinematicId, variant });
          this.played = true;
        },
        onMovementLock: (locked, { cinematicId }) => {
          this.callbacks.onMovementLockChanged?.(locked, { cinematicId });
        }
      }
    );
  }

  private validateConfig(config: Level8IntroDialogueConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level8IntroCinematicSystem: levelId es obligatorio.');
    }

    if (config.cinematicId.trim().length === 0) {
      throw new Error('Level8IntroCinematicSystem: cinematicId es obligatorio.');
    }

    if (config.dialogueVariants.solo.length === 0) {
      throw new Error('Level8IntroCinematicSystem: se requiere diálogo para variante solo.');
    }

    if (config.dialogueVariants.squad.length === 0) {
      throw new Error('Level8IntroCinematicSystem: se requiere diálogo para variante squad.');
    }

    if (config.objectiveAfterCinematic.id.trim().length === 0) {
      throw new Error('Level8IntroCinematicSystem: objectiveAfterCinematic.id es obligatorio.');
    }

    if (config.objectiveAfterCinematic.label.trim().length === 0) {
      throw new Error('Level8IntroCinematicSystem: objectiveAfterCinematic.label es obligatorio.');
    }
  }
}
