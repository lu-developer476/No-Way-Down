import Phaser from 'phaser';

export type PostCinematicTransitionState = 'idle' | 'scene' | 'combat_or_chase' | 'advance_to_final' | 'completed';

export type PostCinematicFollowUpMode = 'combat' | 'short-chase';

export interface PostCinematicSceneBeat {
  id: string;
  text: string;
  durationMs?: number;
}

export interface PostCinematicObjective {
  id: string;
  label: string;
}

export interface PostCinematicFollowUp {
  enabled: boolean;
  mode: PostCinematicFollowUpMode;
  encounterId: string;
  nearbyZombieCount: number;
  minDurationMs?: number;
}

export interface PostCinematicFinalAdvance {
  enabled: boolean;
  objectiveBeforeFinalPoint: PostCinematicObjective;
  finalSacrificePointId: string;
}

export interface PostCinematicCombatTransitionConfig {
  levelId: string;
  transitionId: string;
  previousEventId: string;
  movementLockedDuringScene: boolean;
  preSceneDelayMs: number;
  sceneBeats: PostCinematicSceneBeat[];
  postSceneDelayMs: number;
  followUp: PostCinematicFollowUp;
  finalAdvance: PostCinematicFinalAdvance;
}

export interface PostCinematicCombatTransitionPresentation {
  showSceneBeat?: (beat: PostCinematicSceneBeat, context: { transitionId: string; beatIndex: number }) => void;
  clearSceneBeat?: (context: { transitionId: string }) => void;
}

export interface PostCinematicCombatTransitionCallbacks {
  onTransitionStarted?: (context: { transitionId: string; previousEventId: string }) => void;
  onTransitionStateChanged?: (state: PostCinematicTransitionState, context: { transitionId: string }) => void;
  onMovementLockChanged?: (locked: boolean, context: { transitionId: string }) => void;
  onFollowUpActivated?: (
    followUp: PostCinematicFollowUp,
    context: { transitionId: string; previousEventId: string }
  ) => void;
  onObjectiveUpdated?: (objective: PostCinematicObjective, context: { transitionId: string }) => void;
  onAdvanceToFinalEnabled?: (context: { transitionId: string; finalSacrificePointId: string }) => void;
  onFinalSacrificePointReached?: (context: { transitionId: string; finalSacrificePointId: string }) => void;
  onTransitionCompleted?: (context: { transitionId: string; previousEventId: string }) => void;
}

export interface PostCinematicTransitionSnapshot {
  levelId: string;
  transitionId: string;
  previousEventId: string;
  state: PostCinematicTransitionState;
  started: boolean;
  completed: boolean;
  waitingForFollowUpResolution: boolean;
  waitingForFinalSacrificePoint: boolean;
}

const DEFAULT_SCENE_BEAT_DURATION_MS = 1900;

/**
 * Transición post-cinemática para 2° subsuelo (Nivel 9).
 *
 * Flujo:
 * 1) Escena breve para evitar corte brusco tras la cinemática anterior.
 * 2) Activación de combate o persecución corta.
 * 3) Avance final con objetivo hacia el punto de sacrificio.
 */
export class PostCinematicCombatTransitionSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: PostCinematicCombatTransitionConfig;
  private readonly presentation: PostCinematicCombatTransitionPresentation;
  private readonly callbacks: PostCinematicCombatTransitionCallbacks;

  private state: PostCinematicTransitionState = 'idle';
  private started = false;
  private completed = false;
  private waitingForFollowUpResolution = false;
  private waitingForFinalSacrificePoint = false;
  private activeSequence?: Promise<void>;

  static fromJson(
    scene: Phaser.Scene,
    jsonConfig: PostCinematicCombatTransitionConfig,
    presentation: PostCinematicCombatTransitionPresentation = {},
    callbacks: PostCinematicCombatTransitionCallbacks = {}
  ): PostCinematicCombatTransitionSystem {
    return new PostCinematicCombatTransitionSystem(scene, jsonConfig, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: PostCinematicCombatTransitionConfig,
    presentation: PostCinematicCombatTransitionPresentation = {},
    callbacks: PostCinematicCombatTransitionCallbacks = {}
  ) {
    this.scene = scene;
    this.config = config;
    this.presentation = presentation;
    this.callbacks = callbacks;

    this.validateConfig(config);
  }

  getSnapshot(): PostCinematicTransitionSnapshot {
    return {
      levelId: this.config.levelId,
      transitionId: this.config.transitionId,
      previousEventId: this.config.previousEventId,
      state: this.state,
      started: this.started,
      completed: this.completed,
      waitingForFollowUpResolution: this.waitingForFollowUpResolution,
      waitingForFinalSacrificePoint: this.waitingForFinalSacrificePoint
    };
  }

  /**
   * Debe invocarse cuando se confirma el evento narrativo/cinemático previo.
   */
  beginFromPreviousEvent(previousEventId: string): Promise<void> {
    if (this.completed || previousEventId !== this.config.previousEventId) {
      return Promise.resolve();
    }

    if (this.activeSequence) {
      return this.activeSequence;
    }

    this.activeSequence = this.runSceneBridge().finally(() => {
      this.activeSequence = undefined;
    });

    return this.activeSequence;
  }

  /**
   * Notifica que el combate/persecución corto ya terminó.
   */
  resolveFollowUp(encounterId: string): void {
    if (!this.waitingForFollowUpResolution) {
      return;
    }

    if (encounterId !== this.config.followUp.encounterId) {
      return;
    }

    this.waitingForFollowUpResolution = false;
    this.enableAdvanceToFinal();
  }

  /**
   * Notifica llegada al punto de sacrificio final (3° subsuelo).
   */
  notifyFinalSacrificePointReached(pointId: string): void {
    if (!this.waitingForFinalSacrificePoint) {
      return;
    }

    if (pointId !== this.config.finalAdvance.finalSacrificePointId) {
      return;
    }

    this.waitingForFinalSacrificePoint = false;
    this.state = 'completed';
    this.completed = true;
    this.emitStateChanged();

    this.callbacks.onFinalSacrificePointReached?.({
      transitionId: this.config.transitionId,
      finalSacrificePointId: this.config.finalAdvance.finalSacrificePointId
    });

    this.callbacks.onTransitionCompleted?.({
      transitionId: this.config.transitionId,
      previousEventId: this.config.previousEventId
    });
  }

  private async runSceneBridge(): Promise<void> {
    const transitionContext = {
      transitionId: this.config.transitionId,
      previousEventId: this.config.previousEventId
    };

    this.started = true;
    this.callbacks.onTransitionStarted?.(transitionContext);

    this.state = 'scene';
    this.emitStateChanged();

    if (this.config.movementLockedDuringScene) {
      this.callbacks.onMovementLockChanged?.(true, { transitionId: this.config.transitionId });
    }

    await this.wait(this.config.preSceneDelayMs);

    for (let beatIndex = 0; beatIndex < this.config.sceneBeats.length; beatIndex += 1) {
      const beat = this.config.sceneBeats[beatIndex];
      this.presentation.showSceneBeat?.(beat, {
        transitionId: this.config.transitionId,
        beatIndex
      });

      await this.wait(beat.durationMs ?? DEFAULT_SCENE_BEAT_DURATION_MS);
    }

    this.presentation.clearSceneBeat?.({ transitionId: this.config.transitionId });
    await this.wait(this.config.postSceneDelayMs);

    if (this.config.movementLockedDuringScene) {
      this.callbacks.onMovementLockChanged?.(false, { transitionId: this.config.transitionId });
    }

    this.activateFollowUp();
  }

  private activateFollowUp(): void {
    this.state = 'combat_or_chase';
    this.emitStateChanged();

    if (!this.config.followUp.enabled) {
      this.enableAdvanceToFinal();
      return;
    }

    this.waitingForFollowUpResolution = true;
    this.callbacks.onFollowUpActivated?.(this.config.followUp, {
      transitionId: this.config.transitionId,
      previousEventId: this.config.previousEventId
    });

    if (typeof this.config.followUp.minDurationMs === 'number' && this.config.followUp.minDurationMs > 0) {
      this.wait(this.config.followUp.minDurationMs).then(() => {
        if (!this.waitingForFollowUpResolution) {
          return;
        }

        // Mantiene el sistema preparado para que otro subsistema decida cuándo cerrar la fase.
      });
    }
  }

  private enableAdvanceToFinal(): void {
    if (!this.config.finalAdvance.enabled) {
      this.state = 'completed';
      this.completed = true;
      this.emitStateChanged();
      this.callbacks.onTransitionCompleted?.({
        transitionId: this.config.transitionId,
        previousEventId: this.config.previousEventId
      });
      return;
    }

    this.state = 'advance_to_final';
    this.waitingForFinalSacrificePoint = true;
    this.emitStateChanged();

    this.callbacks.onObjectiveUpdated?.(this.config.finalAdvance.objectiveBeforeFinalPoint, {
      transitionId: this.config.transitionId
    });

    this.callbacks.onAdvanceToFinalEnabled?.({
      transitionId: this.config.transitionId,
      finalSacrificePointId: this.config.finalAdvance.finalSacrificePointId
    });
  }

  private emitStateChanged(): void {
    this.callbacks.onTransitionStateChanged?.(this.state, { transitionId: this.config.transitionId });
  }

  private wait(durationMs: number): Promise<void> {
    const normalizedDuration = Math.max(0, durationMs);

    return new Promise((resolve) => {
      this.scene.time.delayedCall(normalizedDuration, () => resolve());
    });
  }

  private validateConfig(config: PostCinematicCombatTransitionConfig): void {
    if (!config.levelId.trim()) {
      throw new Error('PostCinematicCombatTransitionSystem: levelId es obligatorio.');
    }

    if (!config.transitionId.trim()) {
      throw new Error('PostCinematicCombatTransitionSystem: transitionId es obligatorio.');
    }

    if (!config.previousEventId.trim()) {
      throw new Error('PostCinematicCombatTransitionSystem: previousEventId es obligatorio.');
    }

    config.sceneBeats.forEach((beat, index) => {
      if (!beat.id.trim()) {
        throw new Error(`PostCinematicCombatTransitionSystem: sceneBeats[${index}].id es obligatorio.`);
      }

      if (!beat.text.trim()) {
        throw new Error(`PostCinematicCombatTransitionSystem: sceneBeats[${index}].text es obligatorio.`);
      }
    });

    if (!config.followUp.encounterId.trim()) {
      throw new Error('PostCinematicCombatTransitionSystem: followUp.encounterId es obligatorio.');
    }

    if (config.followUp.nearbyZombieCount < 0) {
      throw new Error('PostCinematicCombatTransitionSystem: followUp.nearbyZombieCount no puede ser negativo.');
    }

    if (!config.finalAdvance.objectiveBeforeFinalPoint.id.trim()) {
      throw new Error('PostCinematicCombatTransitionSystem: finalAdvance.objectiveBeforeFinalPoint.id es obligatorio.');
    }

    if (!config.finalAdvance.objectiveBeforeFinalPoint.label.trim()) {
      throw new Error('PostCinematicCombatTransitionSystem: finalAdvance.objectiveBeforeFinalPoint.label es obligatorio.');
    }

    if (!config.finalAdvance.finalSacrificePointId.trim()) {
      throw new Error('PostCinematicCombatTransitionSystem: finalAdvance.finalSacrificePointId es obligatorio.');
    }
  }
}
