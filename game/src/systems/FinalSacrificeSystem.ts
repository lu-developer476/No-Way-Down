import Phaser from 'phaser';

export interface FinalSacrificeDialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface FinalSacrificeAlly {
  id: string;
  name: string;
  status?: string[];
  profile?: {
    hairColor?: string;
    skinTone?: string;
    shirt?: string;
    nickname?: string;
  };
}

export interface FinalSacrificeEscapeTransition {
  destination: string;
  objectiveId: string;
  objectiveLabel: string;
}

export interface FinalSacrificeConfig {
  levelId: string;
  eventId: string;
  triggerId: string;
  lockMovement: boolean;
  preSceneDelayMs: number;
  holdTheLineDurationMs: number;
  sacrificeAllies: string[];
  requiredTraitsByAllyId?: Record<
    string,
    {
      hairColor?: string;
      skinTone?: string;
      shirt?: string;
      nickname?: string;
      requiredStatuses?: string[];
    }
  >;
  dialogue: FinalSacrificeDialogueLine[];
  escapeTransition: FinalSacrificeEscapeTransition;
}

export interface FinalSacrificePresentation {
  showDialogueLine: (line: FinalSacrificeDialogueLine, context: { eventId: string; lineIndex: number }) => void;
  clearDialogue: (context: { eventId: string }) => void;
  showStageBanner?: (banner: { stage: FinalSacrificeStage; title: string; subtitle?: string }) => void;
}

export type FinalSacrificeStage = 'intro' | 'hold-the-line' | 'fall' | 'escape-transition';

export interface FinalSacrificeCallbacks {
  onSequenceStarted?: (context: { eventId: string; triggerId: string }) => void;
  onSequenceFinished?: (context: { eventId: string; triggerId: string }) => void;
  onMovementLockChanged?: (locked: boolean, context: { eventId: string }) => void;
  onStageChanged?: (context: { eventId: string; stage: FinalSacrificeStage }) => void;
  onAlliesRemovedPermanently?: (context: {
    eventId: string;
    removedAllies: FinalSacrificeAlly[];
    remainingGroup: FinalSacrificeAlly[];
  }) => void;
  onPermanentRemovalConfirmed?: (context: { eventId: string; allyId: string }) => void;
  onEscapeTransitionRequested?: (transition: FinalSacrificeEscapeTransition) => void;
  onObjectiveUpdated?: (objective: { id: string; label: string }) => void;
}

const DEFAULT_LINE_DURATION_MS = 2300;

/**
 * Sistema narrativo/jugable para el sacrificio final del Nivel 9.
 *
 * Flujo:
 * 1) Introducción breve al llegar a la escalera del 3° subsuelo.
 * 2) "Hold the line": dos aliados contienen a los infectados mientras el resto se repliega.
 * 3) Caída: ambos aliados son removidos de forma permanente por sobrepaso numérico.
 * 4) Escape: se emite transición para que el grupo superviviente continúe.
 */
export class FinalSacrificeSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: FinalSacrificeConfig;
  private readonly presentation: FinalSacrificePresentation;
  private readonly callbacks: FinalSacrificeCallbacks;
  private readonly groupById: Map<string, FinalSacrificeAlly>;

  private played = false;
  private activeSequence?: Promise<void>;

  static fromJson(
    scene: Phaser.Scene,
    config: FinalSacrificeConfig,
    initialGroup: FinalSacrificeAlly[],
    presentation: FinalSacrificePresentation,
    callbacks: FinalSacrificeCallbacks = {}
  ): FinalSacrificeSystem {
    return new FinalSacrificeSystem(scene, config, initialGroup, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: FinalSacrificeConfig,
    initialGroup: FinalSacrificeAlly[],
    presentation: FinalSacrificePresentation,
    callbacks: FinalSacrificeCallbacks = {}
  ) {
    this.scene = scene;
    this.config = config;
    this.presentation = presentation;
    this.callbacks = callbacks;
    this.groupById = new Map(initialGroup.map((ally) => [ally.id, ally]));

    this.validateConfig(config, initialGroup);
  }

  hasPlayed(): boolean {
    return this.played;
  }

  isPlaying(): boolean {
    return Boolean(this.activeSequence);
  }

  getRemainingGroup(): FinalSacrificeAlly[] {
    return [...this.groupById.values()];
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
    const eventContext = { eventId: this.config.eventId };
    const triggerContext = { eventId: this.config.eventId, triggerId: this.config.triggerId };

    this.callbacks.onSequenceStarted?.(triggerContext);

    if (this.config.lockMovement) {
      this.callbacks.onMovementLockChanged?.(true, eventContext);
    }

    await this.wait(this.config.preSceneDelayMs);

    this.emitStage('intro');
    await this.playDialogue();

    this.emitStage('hold-the-line');
    this.presentation.showStageBanner?.({
      stage: 'hold-the-line',
      title: '¡Corran al 3° subsuelo!',
      subtitle: 'Ellos cubren la retirada'
    });
    await this.wait(this.config.holdTheLineDurationMs);

    this.emitStage('fall');
    const removedAllies = this.removeSacrificeAllies();
    const remainingGroup = this.getRemainingGroup();

    this.callbacks.onAlliesRemovedPermanently?.({
      eventId: this.config.eventId,
      removedAllies,
      remainingGroup
    });

    removedAllies.forEach((ally) => {
      this.callbacks.onPermanentRemovalConfirmed?.({
        eventId: this.config.eventId,
        allyId: ally.id
      });
    });

    this.emitStage('escape-transition');
    this.callbacks.onObjectiveUpdated?.({
      id: this.config.escapeTransition.objectiveId,
      label: this.config.escapeTransition.objectiveLabel
    });
    this.callbacks.onEscapeTransitionRequested?.(this.config.escapeTransition);

    if (this.config.lockMovement) {
      this.callbacks.onMovementLockChanged?.(false, eventContext);
    }

    this.callbacks.onSequenceFinished?.(triggerContext);
    this.played = true;
  }

  private async playDialogue(): Promise<void> {
    for (let lineIndex = 0; lineIndex < this.config.dialogue.length; lineIndex += 1) {
      const line = this.config.dialogue[lineIndex];
      this.presentation.showDialogueLine(line, {
        eventId: this.config.eventId,
        lineIndex
      });

      await this.wait(line.durationMs ?? DEFAULT_LINE_DURATION_MS);
    }

    this.presentation.clearDialogue({ eventId: this.config.eventId });
  }

  private emitStage(stage: FinalSacrificeStage): void {
    this.callbacks.onStageChanged?.({
      eventId: this.config.eventId,
      stage
    });
  }

  private removeSacrificeAllies(): FinalSacrificeAlly[] {
    const removed: FinalSacrificeAlly[] = [];

    this.config.sacrificeAllies.forEach((allyId) => {
      const ally = this.groupById.get(allyId);
      if (!ally) {
        throw new Error(`FinalSacrificeSystem: no se encontró al aliado "${allyId}" al removerlo.`);
      }

      this.groupById.delete(allyId);
      removed.push(ally);
    });

    return removed;
  }

  private wait(durationMs: number): Promise<void> {
    const normalizedDuration = Math.max(0, durationMs);

    return new Promise((resolve) => {
      this.scene.time.delayedCall(normalizedDuration, () => resolve());
    });
  }

  private validateConfig(config: FinalSacrificeConfig, initialGroup: FinalSacrificeAlly[]): void {
    if (!config.levelId.trim()) {
      throw new Error('FinalSacrificeSystem: levelId es obligatorio.');
    }

    if (!config.eventId.trim()) {
      throw new Error('FinalSacrificeSystem: eventId es obligatorio.');
    }

    if (!config.triggerId.trim()) {
      throw new Error('FinalSacrificeSystem: triggerId es obligatorio.');
    }

    if (config.sacrificeAllies.length !== 2) {
      throw new Error('FinalSacrificeSystem: sacrificeAllies debe contener exactamente 2 aliados.');
    }

    if (config.dialogue.length === 0) {
      throw new Error('FinalSacrificeSystem: se requiere al menos una línea de diálogo.');
    }

    if (!config.escapeTransition.destination.trim()) {
      throw new Error('FinalSacrificeSystem: escapeTransition.destination es obligatorio.');
    }

    if (!config.escapeTransition.objectiveId.trim()) {
      throw new Error('FinalSacrificeSystem: escapeTransition.objectiveId es obligatorio.');
    }

    if (!config.escapeTransition.objectiveLabel.trim()) {
      throw new Error('FinalSacrificeSystem: escapeTransition.objectiveLabel es obligatorio.');
    }

    const uniqueIds = new Set(config.sacrificeAllies);
    if (uniqueIds.size !== config.sacrificeAllies.length) {
      throw new Error('FinalSacrificeSystem: no puede haber IDs duplicados en sacrificeAllies.');
    }

    config.sacrificeAllies.forEach((allyId) => {
      const ally = initialGroup.find((member) => member.id === allyId);
      if (!ally) {
        throw new Error(`FinalSacrificeSystem: el aliado "${allyId}" no existe en el grupo inicial.`);
      }

      const requiredTraits = config.requiredTraitsByAllyId?.[allyId];
      if (!requiredTraits) {
        return;
      }

      if (requiredTraits.hairColor && ally.profile?.hairColor !== requiredTraits.hairColor) {
        throw new Error(`FinalSacrificeSystem: ${allyId} no cumple hairColor="${requiredTraits.hairColor}".`);
      }

      if (requiredTraits.skinTone && ally.profile?.skinTone !== requiredTraits.skinTone) {
        throw new Error(`FinalSacrificeSystem: ${allyId} no cumple skinTone="${requiredTraits.skinTone}".`);
      }

      if (requiredTraits.shirt && ally.profile?.shirt !== requiredTraits.shirt) {
        throw new Error(`FinalSacrificeSystem: ${allyId} no cumple shirt="${requiredTraits.shirt}".`);
      }

      if (requiredTraits.nickname && ally.profile?.nickname !== requiredTraits.nickname) {
        throw new Error(`FinalSacrificeSystem: ${allyId} no cumple nickname="${requiredTraits.nickname}".`);
      }

      const allyStatuses = new Set(ally.status ?? []);
      requiredTraits.requiredStatuses?.forEach((status) => {
        if (!allyStatuses.has(status)) {
          throw new Error(`FinalSacrificeSystem: ${allyId} no cumple el estado requerido "${status}".`);
        }
      });
    });
  }
}
