import Phaser from 'phaser';

export interface Subsuelo2DialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface Subsuelo2SquadMember {
  id: string;
  name: string;
  status?: string[];
  profile?: {
    gender?: 'masculino' | 'femenino' | 'no_binario';
    skinTone?: string;
    hairColor?: string;
  };
}

export interface Subsuelo2Objective {
  id: string;
  label: string;
}

export interface Subsuelo2FollowUpEncounter {
  enabled: boolean;
  type: 'small-zombie-combat' | 'zombie-aftermath-scene';
  encounterId: string;
  nearbyZombieCount: number;
}

export interface Subsuelo2InfectionCinematicConfig {
  levelId: string;
  cinematicId: string;
  triggerId: string;
  movementLocked: boolean;
  preDialoguePauseMs: number;
  victimMemberId: string;
  victimMustHaveStatus: string[];
  dialogue: Subsuelo2DialogueLine[];
  objectiveAfterCinematic: Subsuelo2Objective;
  followUpEncounter: Subsuelo2FollowUpEncounter;
}

export interface Subsuelo2Presentation {
  showDialogueLine: (line: Subsuelo2DialogueLine, context: { cinematicId: string; lineIndex: number }) => void;
  clearDialogue: (context: { cinematicId: string }) => void;
}

export interface Subsuelo2Callbacks {
  onCinematicStarted?: (context: { cinematicId: string; triggerId: string }) => void;
  onCinematicCompleted?: (context: { cinematicId: string; triggerId: string }) => void;
  onMovementLockChanged?: (locked: boolean, context: { cinematicId: string }) => void;
  onObjectiveUpdated?: (objective: Subsuelo2Objective) => void;
  onGroupCompositionUpdated?: (context: {
    cinematicId: string;
    removedMember: Subsuelo2SquadMember;
    remainingMembers: Subsuelo2SquadMember[];
  }) => void;
  onPermanentRemovalConfirmed?: (context: { cinematicId: string; memberId: string }) => void;
  onFollowUpEncounterRequested?: (encounter: Subsuelo2FollowUpEncounter) => void;
}

const DEFAULT_LINE_DURATION_MS = 2200;

/**
 * Cinemática del 2° subsuelo del Nivel 9.
 *
 * Flujo narrativo:
 * 1) Se activa por trigger y se bloquea movimiento para forzar foco dramático.
 * 2) El infectado (ya esguinzado) comunica su decisión y se ejecuta el diálogo completo.
 * 3) El sistema remueve al personaje de forma permanente de la composición del grupo.
 * 4) Se actualiza el objetivo y se habilita combate/escena posterior con zombies cercanos.
 */
export class Subsuelo2InfectionCinematicSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: Subsuelo2InfectionCinematicConfig;
  private readonly presentation: Subsuelo2Presentation;
  private readonly callbacks: Subsuelo2Callbacks;

  private readonly squadById: Map<string, Subsuelo2SquadMember>;
  private played = false;
  private activeSequence?: Promise<void>;

  static fromJson(
    scene: Phaser.Scene,
    config: Subsuelo2InfectionCinematicConfig,
    initialSquad: Subsuelo2SquadMember[],
    presentation: Subsuelo2Presentation,
    callbacks: Subsuelo2Callbacks = {}
  ): Subsuelo2InfectionCinematicSystem {
    return new Subsuelo2InfectionCinematicSystem(scene, config, initialSquad, presentation, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    config: Subsuelo2InfectionCinematicConfig,
    initialSquad: Subsuelo2SquadMember[],
    presentation: Subsuelo2Presentation,
    callbacks: Subsuelo2Callbacks = {}
  ) {
    this.scene = scene;
    this.config = config;
    this.presentation = presentation;
    this.callbacks = callbacks;
    this.squadById = new Map(initialSquad.map((member) => [member.id, member]));

    this.validateConfig(config, initialSquad);
  }

  hasPlayed(): boolean {
    return this.played;
  }

  isPlaying(): boolean {
    return Boolean(this.activeSequence);
  }

  getGroupComposition(): Subsuelo2SquadMember[] {
    return [...this.squadById.values()];
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

    await this.wait(this.config.preDialoguePauseMs);

    for (let lineIndex = 0; lineIndex < this.config.dialogue.length; lineIndex += 1) {
      const line = this.config.dialogue[lineIndex];
      this.presentation.showDialogueLine(line, {
        cinematicId: this.config.cinematicId,
        lineIndex
      });

      await this.wait(line.durationMs ?? DEFAULT_LINE_DURATION_MS);
    }

    this.presentation.clearDialogue(cinematicContext);

    const removedMember = this.removeVictimFromGroup();
    const remainingMembers = this.getGroupComposition();

    this.callbacks.onGroupCompositionUpdated?.({
      cinematicId: this.config.cinematicId,
      removedMember,
      remainingMembers
    });
    this.callbacks.onPermanentRemovalConfirmed?.({
      cinematicId: this.config.cinematicId,
      memberId: removedMember.id
    });

    this.callbacks.onObjectiveUpdated?.(this.config.objectiveAfterCinematic);

    if (this.config.followUpEncounter.enabled) {
      this.callbacks.onFollowUpEncounterRequested?.(this.config.followUpEncounter);
    }

    if (this.config.movementLocked) {
      this.callbacks.onMovementLockChanged?.(false, cinematicContext);
    }

    this.callbacks.onCinematicCompleted?.(callbackContext);
    this.played = true;
  }

  private removeVictimFromGroup(): Subsuelo2SquadMember {
    const victim = this.squadById.get(this.config.victimMemberId);

    if (!victim) {
      throw new Error(
        `Subsuelo2InfectionCinematicSystem: no se encontró al miembro víctima "${this.config.victimMemberId}" al removerlo.`
      );
    }

    this.squadById.delete(victim.id);
    return victim;
  }

  private wait(durationMs: number): Promise<void> {
    const normalizedDuration = Math.max(0, durationMs);

    return new Promise((resolve) => {
      this.scene.time.delayedCall(normalizedDuration, () => resolve());
    });
  }

  private validateConfig(config: Subsuelo2InfectionCinematicConfig, initialSquad: Subsuelo2SquadMember[]): void {
    if (!config.levelId.trim()) {
      throw new Error('Subsuelo2InfectionCinematicSystem: levelId es obligatorio.');
    }

    if (!config.cinematicId.trim()) {
      throw new Error('Subsuelo2InfectionCinematicSystem: cinematicId es obligatorio.');
    }

    if (!config.triggerId.trim()) {
      throw new Error('Subsuelo2InfectionCinematicSystem: triggerId es obligatorio.');
    }

    if (config.dialogue.length === 0) {
      throw new Error('Subsuelo2InfectionCinematicSystem: se requiere al menos una línea de diálogo.');
    }

    if (!config.victimMemberId.trim()) {
      throw new Error('Subsuelo2InfectionCinematicSystem: victimMemberId es obligatorio.');
    }

    const victim = initialSquad.find((member) => member.id === config.victimMemberId);
    if (!victim) {
      throw new Error(`Subsuelo2InfectionCinematicSystem: victimMemberId "${config.victimMemberId}" no existe en la escuadra inicial.`);
    }

    if (victim.profile?.gender !== 'masculino') {
      throw new Error('Subsuelo2InfectionCinematicSystem: la víctima debe ser masculina.');
    }

    if (victim.profile?.skinTone !== 'clara') {
      throw new Error('Subsuelo2InfectionCinematicSystem: la víctima debe ser de piel clara.');
    }

    if (victim.profile?.hairColor !== 'negro') {
      throw new Error('Subsuelo2InfectionCinematicSystem: la víctima debe tener pelo negro.');
    }

    const victimStatuses = new Set(victim.status ?? []);
    config.victimMustHaveStatus.forEach((status) => {
      if (!victimStatuses.has(status)) {
        throw new Error(`Subsuelo2InfectionCinematicSystem: la víctima no cumple el estado requerido "${status}".`);
      }
    });

    if (!config.objectiveAfterCinematic.id.trim()) {
      throw new Error('Subsuelo2InfectionCinematicSystem: objectiveAfterCinematic.id es obligatorio.');
    }

    if (!config.objectiveAfterCinematic.label.trim()) {
      throw new Error('Subsuelo2InfectionCinematicSystem: objectiveAfterCinematic.label es obligatorio.');
    }

    if (!config.followUpEncounter.encounterId.trim()) {
      throw new Error('Subsuelo2InfectionCinematicSystem: followUpEncounter.encounterId es obligatorio.');
    }

    if (config.followUpEncounter.nearbyZombieCount < 0) {
      throw new Error('Subsuelo2InfectionCinematicSystem: followUpEncounter.nearbyZombieCount no puede ser negativo.');
    }
  }
}
