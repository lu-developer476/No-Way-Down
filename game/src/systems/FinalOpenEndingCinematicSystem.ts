import Phaser from 'phaser';

export type FinalOpenEndingActionId =
  | 'survivors_enter_vehicle'
  | 'shared_silence_breath'
  | 'engine_ignition'
  | 'vehicle_departure';

export interface FinalOpenEndingDialogueStep {
  type: 'dialogue';
  speaker: string;
  text: string;
  durationMs?: number;
  mood?: 'anxiety' | 'fatigue' | 'contained';
}

export interface FinalOpenEndingSilenceStep {
  type: 'silence';
  description: string;
  durationMs?: number;
  cameraFocus?: 'hands' | 'windshield' | 'rear_mirror' | 'dashboard';
}

export interface FinalOpenEndingActionStep {
  type: 'action';
  actionId: FinalOpenEndingActionId;
  description: string;
  durationMs?: number;
}

export type FinalOpenEndingSequenceStep =
  | FinalOpenEndingDialogueStep
  | FinalOpenEndingSilenceStep
  | FinalOpenEndingActionStep;

export interface FinalOpenEndingCampaignState {
  campaignId: string;
  chapterId: string;
  status: 'completed';
  endingType: 'open';
  summary: string;
}

export interface FinalOpenEndingContinuationHook {
  id: string;
  label: string;
  uncertainty: string;
}

export interface FinalOpenEndingCinematicConfig {
  levelId: string;
  cinematicId: string;
  triggerId: string;
  lockMovement: boolean;
  preSequenceDelayMs: number;
  sequence: FinalOpenEndingSequenceStep[];
  campaignState: FinalOpenEndingCampaignState;
  continuationHook: FinalOpenEndingContinuationHook;
}

export interface FinalOpenEndingPresentation {
  showDialogueLine: (
    line: FinalOpenEndingDialogueStep,
    context: { cinematicId: string; stepIndex: number }
  ) => void;
  showSilenceBeat: (
    step: FinalOpenEndingSilenceStep,
    context: { cinematicId: string; stepIndex: number }
  ) => void;
  showActionBeat: (
    action: FinalOpenEndingActionStep,
    context: { cinematicId: string; stepIndex: number }
  ) => void;
  clearOverlay: (context: { cinematicId: string }) => void;
}

export interface FinalOpenEndingCallbacks {
  onCinematicStarted?: (context: { cinematicId: string; triggerId: string }) => void;
  onCinematicFinished?: (context: { cinematicId: string; triggerId: string }) => void;
  onMovementLockChanged?: (locked: boolean, context: { cinematicId: string }) => void;
  onCampaignStateCommitted?: (
    campaignState: FinalOpenEndingCampaignState,
    context: { cinematicId: string }
  ) => void;
  onContinuationHookPrepared?: (
    hook: FinalOpenEndingContinuationHook,
    context: { cinematicId: string }
  ) => void;
}

const DEFAULT_DIALOGUE_DURATION_MS = 1800;
const DEFAULT_SILENCE_DURATION_MS = 2500;
const DEFAULT_ACTION_DURATION_MS = 1200;

/**
 * Cinemática final abierta del Nivel 10.
 *
 * Intención narrativa:
 * 1) Cerrar la campaña como completada sin presentar una victoria total.
 * 2) Sostener el tono de supervivencia amarga con silencios y diálogo corto de despedida.
 * 3) Dejar un gancho explícito para continuación/secuela.
 */
export class FinalOpenEndingCinematicSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: FinalOpenEndingCinematicConfig;
  private readonly presentation: FinalOpenEndingPresentation;
  private readonly callbacks: FinalOpenEndingCallbacks;

  private played = false;
  private activeSequence?: Promise<void>;

  static fromJson(
    scene: Phaser.Scene,
    config: FinalOpenEndingCinematicConfig,
    presentation: FinalOpenEndingPresentation,
    callbacks: FinalOpenEndingCallbacks = {}
  ): FinalOpenEndingCinematicSystem {
    return new FinalOpenEndingCinematicSystem(scene, config, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: FinalOpenEndingCinematicConfig,
    presentation: FinalOpenEndingPresentation,
    callbacks: FinalOpenEndingCallbacks = {}
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
    const triggerContext = {
      cinematicId: this.config.cinematicId,
      triggerId: this.config.triggerId
    };

    this.callbacks.onCinematicStarted?.(triggerContext);

    if (this.config.lockMovement) {
      this.callbacks.onMovementLockChanged?.(true, cinematicContext);
    }

    await this.wait(this.config.preSequenceDelayMs);

    for (let stepIndex = 0; stepIndex < this.config.sequence.length; stepIndex += 1) {
      const step = this.config.sequence[stepIndex];

      if (step.type === 'dialogue') {
        this.presentation.showDialogueLine(step, { cinematicId: this.config.cinematicId, stepIndex });
        await this.wait(step.durationMs ?? DEFAULT_DIALOGUE_DURATION_MS);
        continue;
      }

      if (step.type === 'silence') {
        this.presentation.showSilenceBeat(step, { cinematicId: this.config.cinematicId, stepIndex });
        await this.wait(step.durationMs ?? DEFAULT_SILENCE_DURATION_MS);
        continue;
      }

      this.presentation.showActionBeat(step, { cinematicId: this.config.cinematicId, stepIndex });
      await this.wait(step.durationMs ?? DEFAULT_ACTION_DURATION_MS);
    }

    this.presentation.clearOverlay(cinematicContext);

    this.callbacks.onCampaignStateCommitted?.(this.config.campaignState, cinematicContext);
    this.callbacks.onContinuationHookPrepared?.(this.config.continuationHook, cinematicContext);

    if (this.config.lockMovement) {
      this.callbacks.onMovementLockChanged?.(false, cinematicContext);
    }

    this.callbacks.onCinematicFinished?.(triggerContext);
    this.played = true;
  }

  private wait(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.time.delayedCall(Math.max(0, durationMs), () => resolve());
    });
  }

  private validateConfig(config: FinalOpenEndingCinematicConfig): void {
    if (!config.levelId.trim()) {
      throw new Error('FinalOpenEndingCinematicSystem: levelId es obligatorio.');
    }

    if (!config.cinematicId.trim()) {
      throw new Error('FinalOpenEndingCinematicSystem: cinematicId es obligatorio.');
    }

    if (!config.triggerId.trim()) {
      throw new Error('FinalOpenEndingCinematicSystem: triggerId es obligatorio.');
    }

    if (config.sequence.length === 0) {
      throw new Error('FinalOpenEndingCinematicSystem: sequence debe contener al menos un paso.');
    }

    const silenceSteps = config.sequence.filter((step) => step.type === 'silence').length;
    if (silenceSteps === 0) {
      throw new Error('FinalOpenEndingCinematicSystem: se requiere al menos un silencio estructurado.');
    }

    const dialogueSteps = config.sequence.filter((step) => step.type === 'dialogue').length;
    if (dialogueSteps === 0 || dialogueSteps > 6) {
      throw new Error('FinalOpenEndingCinematicSystem: el cierre final admite entre 1 y 6 líneas de diálogo.');
    }

    if (config.campaignState.status !== 'completed') {
      throw new Error('FinalOpenEndingCinematicSystem: campaignState.status debe ser "completed".');
    }

    if (config.campaignState.endingType !== 'open') {
      throw new Error('FinalOpenEndingCinematicSystem: campaignState.endingType debe ser "open".');
    }

    if (!config.continuationHook.id.trim() || !config.continuationHook.label.trim()) {
      throw new Error('FinalOpenEndingCinematicSystem: continuationHook requiere id y label.');
    }

    if (!config.continuationHook.uncertainty.trim()) {
      throw new Error('FinalOpenEndingCinematicSystem: continuationHook.uncertainty es obligatorio.');
    }
  }
}
