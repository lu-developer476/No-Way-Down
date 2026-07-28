import Phaser from 'phaser';

export type Level8OutroNarrativeVariant = 'solo' | 'squad';

export interface Level8OutroDialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface Level8OutroObjective {
  id: string;
  label: string;
}

export interface Level8OutroInventorySummary {
  resources?: Array<{ name: string; amount: number }>;
  weapons?: Array<{ name: string; ammo?: number }>;
}

export interface Level8OutroDialogueConfig {
  levelId: string;
  cinematicId: string;
  movementLocked: boolean;
  initialPauseMs: number;
  postHugPauseMs: number;
  postEscapePauseMs: number;
  dialogueVariants: {
    solo: {
      victory: Level8OutroDialogueLine[];
      hug: Level8OutroDialogueLine[];
      inventory: Level8OutroDialogueLine[];
      transition: Level8OutroDialogueLine[];
    };
    squad: {
      victory: Level8OutroDialogueLine[];
      hug: Level8OutroDialogueLine[];
      inventory: Level8OutroDialogueLine[];
      transition: Level8OutroDialogueLine[];
    };
  };
  objectiveAfterCinematic: Level8OutroObjective;
  transitionMessage: string;
  transitionDelayMs: number;
}

export interface Level8OutroRuntimeContext {
  hasAiAllies: boolean;
  inventorySummary?: Level8OutroInventorySummary;
}

export interface Level8OutroPresentation {
  showDialogueLine: (
    line: Level8OutroDialogueLine,
    context: { variant: Level8OutroNarrativeVariant; cinematicId: string; stage: Level8OutroStage; lineIndex: number }
  ) => void;
  clearDialogue: (context: { cinematicId: string }) => void;
}

export interface Level8OutroCallbacks {
  onCinematicStarted?: (context: { cinematicId: string; variant: Level8OutroNarrativeVariant }) => void;
  onCinematicCompleted?: (context: { cinematicId: string; variant: Level8OutroNarrativeVariant }) => void;
  onMovementLockChanged?: (locked: boolean, context: { cinematicId: string }) => void;
  onNpcEscapeTriggered?: (context: { cinematicId: string }) => void;
  onHugStarted?: (context: { cinematicId: string }) => void;
  onInventorySummary?: (summaryText: string, context: { cinematicId: string }) => void;
  onObjectiveUpdated?: (objective: Level8OutroObjective) => void;
  onTransitionReady?: (context: { message: string; delayMs: number; cinematicId: string }) => void;
}

type Level8OutroStage = 'victory' | 'hug' | 'inventory' | 'transition';

const DEFAULT_LINE_DURATION_MS = 2100;

/**
 * Cinemática final del Nivel 8.
 *
 * Flujo narrativo:
 * 1) Victoria parcial tras limpiar el grupo zombie.
 * 2) Abrazo emocional de las hermanas.
 * 3) Escape autónomo de los NPCs secundarios.
 * 4) Inventario rápido de recursos/armas del grupo principal.
 * 5) Habilitación de transición al Nivel 9.
 */
export class Level8OutroCinematicSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: Level8OutroDialogueConfig;
  private readonly presentation: Level8OutroPresentation;
  private readonly callbacks: Level8OutroCallbacks;

  private activeSequence?: Promise<void>;
  private played = false;

  static fromJson(
    scene: Phaser.Scene,
    jsonConfig: Level8OutroDialogueConfig,
    presentation: Level8OutroPresentation,
    callbacks: Level8OutroCallbacks = {}
  ): Level8OutroCinematicSystem {
    return new Level8OutroCinematicSystem(scene, jsonConfig, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: Level8OutroDialogueConfig,
    presentation: Level8OutroPresentation,
    callbacks: Level8OutroCallbacks = {}
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

  playOutro(runtimeContext: Level8OutroRuntimeContext): Promise<void> {
    if (this.played) {
      return Promise.resolve();
    }

    if (this.activeSequence) {
      return this.activeSequence;
    }

    const variant: Level8OutroNarrativeVariant = runtimeContext.hasAiAllies ? 'squad' : 'solo';

    this.activeSequence = this.runSequence(variant, runtimeContext).finally(() => {
      this.activeSequence = undefined;
    });

    return this.activeSequence;
  }

  private async runSequence(variant: Level8OutroNarrativeVariant, runtimeContext: Level8OutroRuntimeContext): Promise<void> {
    const cinematicContext = { cinematicId: this.config.cinematicId };
    this.callbacks.onCinematicStarted?.({ cinematicId: this.config.cinematicId, variant });

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(true, cinematicContext);
    }

    await this.wait(this.config.initialPauseMs);

    const variantConfig = this.config.dialogueVariants[variant];
    await this.playStage('victory', variantConfig.victory, variant);

    this.callbacks.onHugStarted?.(cinematicContext);
    await this.playStage('hug', variantConfig.hug, variant);
    await this.wait(this.config.postHugPauseMs);

    this.callbacks.onNpcEscapeTriggered?.(cinematicContext);
    await this.wait(this.config.postEscapePauseMs);

    await this.playStage('inventory', variantConfig.inventory, variant);
    const summaryText = this.buildInventorySummary(runtimeContext.inventorySummary);
    if (summaryText) {
      this.callbacks.onInventorySummary?.(summaryText, cinematicContext);
      this.presentation.showDialogueLine(
        {
          speaker: 'Inventario',
          text: summaryText,
          durationMs: 2400
        },
        {
          variant,
          cinematicId: this.config.cinematicId,
          stage: 'inventory',
          lineIndex: variantConfig.inventory.length
        }
      );
      await this.wait(2400);
    }

    await this.playStage('transition', variantConfig.transition, variant);

    this.presentation.clearDialogue(cinematicContext);

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(false, cinematicContext);
    }

    this.callbacks.onObjectiveUpdated?.(this.config.objectiveAfterCinematic);
    this.callbacks.onTransitionReady?.({
      message: this.config.transitionMessage,
      delayMs: this.config.transitionDelayMs,
      cinematicId: this.config.cinematicId
    });
    this.callbacks.onCinematicCompleted?.({ cinematicId: this.config.cinematicId, variant });

    this.played = true;
  }

  private async playStage(
    stage: Level8OutroStage,
    lines: Level8OutroDialogueLine[],
    variant: Level8OutroNarrativeVariant
  ): Promise<void> {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      this.presentation.showDialogueLine(line, {
        variant,
        cinematicId: this.config.cinematicId,
        stage,
        lineIndex
      });

      await this.wait(line.durationMs ?? DEFAULT_LINE_DURATION_MS);
    }
  }

  private buildInventorySummary(summary?: Level8OutroInventorySummary): string | undefined {
    if (!summary) {
      return undefined;
    }

    const resourceText = (summary.resources ?? [])
      .filter((entry) => entry.name.trim().length > 0)
      .map((entry) => `${entry.name}: ${Math.max(0, Math.floor(entry.amount))}`)
      .join(', ');

    const weaponText = (summary.weapons ?? [])
      .filter((entry) => entry.name.trim().length > 0)
      .map((entry) => {
        if (typeof entry.ammo === 'number') {
          return `${entry.name} (${Math.max(0, Math.floor(entry.ammo))})`;
        }

        return entry.name;
      })
      .join(', ');

    const segments: string[] = [];
    if (resourceText.length > 0) {
      segments.push(`Recursos: ${resourceText}`);
    }

    if (weaponText.length > 0) {
      segments.push(`Armas: ${weaponText}`);
    }

    return segments.length > 0 ? segments.join(' | ') : undefined;
  }

  private wait(durationMs: number): Promise<void> {
    const normalizedDuration = Math.max(0, durationMs);

    return new Promise((resolve) => {
      this.scene.time.delayedCall(normalizedDuration, () => resolve());
    });
  }

  private validateConfig(config: Level8OutroDialogueConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level8OutroCinematicSystem: levelId es obligatorio.');
    }

    if (config.cinematicId.trim().length === 0) {
      throw new Error('Level8OutroCinematicSystem: cinematicId es obligatorio.');
    }

    if (config.transitionMessage.trim().length === 0) {
      throw new Error('Level8OutroCinematicSystem: transitionMessage es obligatorio.');
    }

    this.validateVariant('solo', config.dialogueVariants.solo);
    this.validateVariant('squad', config.dialogueVariants.squad);

    if (config.objectiveAfterCinematic.id.trim().length === 0) {
      throw new Error('Level8OutroCinematicSystem: objectiveAfterCinematic.id es obligatorio.');
    }

    if (config.objectiveAfterCinematic.label.trim().length === 0) {
      throw new Error('Level8OutroCinematicSystem: objectiveAfterCinematic.label es obligatorio.');
    }
  }

  private validateVariant(
    variantName: Level8OutroNarrativeVariant,
    variant: Level8OutroDialogueConfig['dialogueVariants']['solo']
  ): void {
    if (variant.victory.length === 0) {
      throw new Error(`Level8OutroCinematicSystem: se requiere diálogo de victoria para variante ${variantName}.`);
    }

    if (variant.hug.length === 0) {
      throw new Error(`Level8OutroCinematicSystem: se requiere diálogo de abrazo para variante ${variantName}.`);
    }

    if (variant.inventory.length === 0) {
      throw new Error(`Level8OutroCinematicSystem: se requiere diálogo de inventario para variante ${variantName}.`);
    }

    if (variant.transition.length === 0) {
      throw new Error(`Level8OutroCinematicSystem: se requiere diálogo de transición para variante ${variantName}.`);
    }
  }
}
