export type IrreversibleLossEventType =
  | 'exit-evaluated'
  | 'wave-overrun-confirmed'
  | 'cinematic-confirmed'
  | 'manual-trigger';

export interface SquadMember {
  id: string;
  name: string;
  profile?: {
    gender?: 'masculino' | 'femenino' | 'no_binario';
    skinTone?: string;
    hairColor?: string;
  };
}

export interface IrreversibleLossEventTriggerRule {
  type: IrreversibleLossEventType;
  exitId?: string;
  eventId?: string;
}

export interface IrreversibleLossEventConfig {
  levelId: string;
  eventId: string;
  routeId: string;
  title: string;
  unavoidable: boolean;
  trigger: IrreversibleLossEventTriggerRule;
  casualties: SquadMember[];
  narrative: {
    objectiveAfterLoss?: string;
    statePatch?: Record<string, unknown>;
    confirmationLine?: string;
  };
  hud?: {
    bannerText?: string;
    logLine?: string;
  };
}

export interface IrreversibleLossInputEvent {
  type: IrreversibleLossEventType;
  exitId?: string;
  eventId?: string;
}

export interface IrreversibleLossSnapshot {
  levelId: string;
  eventId: string;
  routeId: string;
  title: string;
  unavoidable: boolean;
  status: 'pending' | 'triggered';
  removedMemberIds: string[];
  remainingMemberIds: string[];
  narrative: {
    objectiveAfterLoss?: string;
    confirmationLine?: string;
    statePatch?: Record<string, unknown>;
  };
  hud: {
    bannerText?: string;
    logLine?: string;
  };
}

export interface IrreversibleLossEventCallbacks {
  onLossTriggered?: (snapshot: IrreversibleLossSnapshot) => void;
  onGroupCompositionChanged?: (remainingMembers: SquadMember[], removedMembers: SquadMember[]) => void;
  onObjectiveUpdated?: (objectiveText: string) => void;
  onHudMessageRequested?: (message: { bannerText?: string; logLine?: string }) => void;
  onNarrativeStatePatched?: (statePatch: Record<string, unknown>) => void;
}

/**
 * Sistema narrativo para pérdidas irreversibles (Nivel 9 / salida B).
 *
 * Responsabilidades:
 * - declarar que la pérdida es inevitable (config.unavoidable)
 * - remover miembros concretos de la escuadra de forma permanente
 * - exponer callbacks para HUD y estado narrativo
 * - ser totalmente configurable por JSON
 */
export class IrreversibleLossEventSystem {
  private readonly config: IrreversibleLossEventConfig;
  private readonly callbacks: IrreversibleLossEventCallbacks;
  private readonly initialSquadById: Map<string, SquadMember>;
  private readonly removedMemberIds = new Set<string>();
  private status: 'pending' | 'triggered' = 'pending';

  static fromJson(
    config: IrreversibleLossEventConfig,
    initialSquad: SquadMember[],
    callbacks: IrreversibleLossEventCallbacks = {}
  ): IrreversibleLossEventSystem {
    return new IrreversibleLossEventSystem(config, initialSquad, callbacks);
  }

  constructor(config: IrreversibleLossEventConfig, initialSquad: SquadMember[], callbacks: IrreversibleLossEventCallbacks = {}) {
    this.validateConfig(config, initialSquad);
    this.config = config;
    this.callbacks = callbacks;
    this.initialSquadById = new Map(initialSquad.map((member) => [member.id, member]));
  }

  processEvent(event: IrreversibleLossInputEvent): boolean {
    if (this.status === 'triggered') {
      return false;
    }

    if (!this.matchesTriggerRule(event)) {
      return false;
    }

    this.applyIrreversibleLoss();
    return true;
  }

  getSnapshot(): IrreversibleLossSnapshot {
    return {
      levelId: this.config.levelId,
      eventId: this.config.eventId,
      routeId: this.config.routeId,
      title: this.config.title,
      unavoidable: this.config.unavoidable,
      status: this.status,
      removedMemberIds: this.getRemovedMembers().map((member) => member.id),
      remainingMemberIds: this.getRemainingMembers().map((member) => member.id),
      narrative: {
        objectiveAfterLoss: this.config.narrative.objectiveAfterLoss,
        confirmationLine: this.config.narrative.confirmationLine,
        statePatch: this.config.narrative.statePatch
      },
      hud: {
        bannerText: this.config.hud?.bannerText,
        logLine: this.config.hud?.logLine
      }
    };
  }

  getRemainingMembers(): SquadMember[] {
    return [...this.initialSquadById.values()].filter((member) => !this.removedMemberIds.has(member.id));
  }

  getRemovedMembers(): SquadMember[] {
    return [...this.removedMemberIds]
      .map((memberId) => this.initialSquadById.get(memberId))
      .filter((member): member is SquadMember => Boolean(member));
  }

  private applyIrreversibleLoss(): void {
    this.status = 'triggered';

    this.config.casualties.forEach((member) => {
      this.removedMemberIds.add(member.id);
    });

    const removedMembers = this.getRemovedMembers();
    const remainingMembers = this.getRemainingMembers();
    const snapshot = this.getSnapshot();

    this.callbacks.onGroupCompositionChanged?.(remainingMembers, removedMembers);

    if (snapshot.narrative.objectiveAfterLoss) {
      this.callbacks.onObjectiveUpdated?.(snapshot.narrative.objectiveAfterLoss);
    }

    this.callbacks.onHudMessageRequested?.({
      bannerText: snapshot.hud.bannerText,
      logLine: snapshot.hud.logLine
    });

    if (snapshot.narrative.statePatch) {
      this.callbacks.onNarrativeStatePatched?.(snapshot.narrative.statePatch);
    }

    this.callbacks.onLossTriggered?.(snapshot);
  }

  private matchesTriggerRule(event: IrreversibleLossInputEvent): boolean {
    if (this.config.trigger.type !== event.type) {
      return false;
    }

    if (this.config.trigger.exitId && this.config.trigger.exitId !== event.exitId) {
      return false;
    }

    if (this.config.trigger.eventId && this.config.trigger.eventId !== event.eventId) {
      return false;
    }

    return true;
  }

  private validateConfig(config: IrreversibleLossEventConfig, initialSquad: SquadMember[]): void {
    if (!config.levelId.trim()) {
      throw new Error('IrreversibleLossEventSystem: levelId es obligatorio.');
    }

    if (!config.eventId.trim()) {
      throw new Error('IrreversibleLossEventSystem: eventId es obligatorio.');
    }

    if (!config.routeId.trim()) {
      throw new Error('IrreversibleLossEventSystem: routeId es obligatorio.');
    }

    if (!config.title.trim()) {
      throw new Error('IrreversibleLossEventSystem: title es obligatorio.');
    }

    if (!config.unavoidable) {
      throw new Error('IrreversibleLossEventSystem: unavoidable debe ser true para eventos irreversibles.');
    }

    if (!Array.isArray(config.casualties) || config.casualties.length === 0) {
      throw new Error('IrreversibleLossEventSystem: casualties debe contener al menos un integrante.');
    }

    const initialMemberIds = new Set(initialSquad.map((member) => member.id));
    const casualtiesSeen = new Set<string>();

    config.casualties.forEach((casualty) => {
      if (!casualty.id.trim()) {
        throw new Error('IrreversibleLossEventSystem: casualties[].id no puede ser vacío.');
      }

      if (!casualty.name.trim()) {
        throw new Error(`IrreversibleLossEventSystem: casualty "${casualty.id}" requiere name.`);
      }

      if (!initialMemberIds.has(casualty.id)) {
        throw new Error(`IrreversibleLossEventSystem: casualty "${casualty.id}" no existe en la escuadra inicial.`);
      }

      if (casualtiesSeen.has(casualty.id)) {
        throw new Error(`IrreversibleLossEventSystem: casualty duplicado "${casualty.id}".`);
      }

      casualtiesSeen.add(casualty.id);
    });
  }
}
