import { PartyMember, PartyStateSystem } from './core/PartyStateSystem';

export type Level8CanonicalPhase =
  | 'mass_infected_assault'
  | 'damian_reveal_cinematic'
  | 'staircase_pursuit'
  | 'sacrifice_decision_cinematic'
  | 'sacrifice_last_stand_cinematic'
  | 'completed';

export type Level8CanonicalEventType =
  | 'zombie-killed'
  | 'damian-cinematic-finished'
  | 'stair-segment-cleared'
  | 'stairs-reached'
  | 'sacrifice-cinematic-finished'
  | 'manual-complete';

export interface Level8CanonicalDialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface Level8CanonicalMassAssaultConfig {
  waveId: string;
  requiredKills: number;
  introObjective: string;
}

export interface Level8CanonicalPursuitConfig {
  objective: string;
  stairsTargetId: string;
  minStragglersToClear: number;
}

export interface Level8CanonicalSacrificeConfig {
  optionalSacrificeIds: string[];
  protectIds: string[];
  decisionCinematicId: string;
  lastStandCinematicId: string;
}

export interface Level8CanonicalConfig {
  levelId: string;
  registryKey?: string;
  massAssault: Level8CanonicalMassAssaultConfig;
  damianId: string;
  damianCinematicId: string;
  damianCinematicDialogue: Level8CanonicalDialogueLine[];
  pursuit: Level8CanonicalPursuitConfig;
  sacrifice: Level8CanonicalSacrificeConfig;
  nextLevelId: string;
}

export interface Level8CanonicalEvent {
  type: Level8CanonicalEventType;
  targetId?: string;
  waveId?: string;
}

export interface Level8CanonicalSnapshot {
  levelId: string;
  phase: Level8CanonicalPhase;
  currentObjective: string;
  killCounter: {
    current: number;
    required: number;
    waveId: string;
  };
  pursuit: {
    stragglersCleared: number;
    required: number;
    stairsReached: boolean;
  };
  damian: {
    id: string;
    infected: boolean;
    deceased: boolean;
  };
  sacrifice: {
    availableCandidates: string[];
    selected: string[];
    resolved: boolean;
  };
  survivingParty: string[];
  nextLevelId?: string;
}

export interface Level8CanonicalCallbacks {
  onObjectiveUpdated?: (objective: string, snapshot: Level8CanonicalSnapshot) => void;
  onKillCounterChanged?: (payload: { current: number; required: number; waveId: string }, snapshot: Level8CanonicalSnapshot) => void;
  onMassAssaultCompleted?: (payload: { waveId: string; kills: number }, snapshot: Level8CanonicalSnapshot) => void;
  onDamianCinematicRequested?: (payload: { cinematicId: string; dialogue: Level8CanonicalDialogueLine[] }) => void;
  onDamianFateResolved?: (payload: { damianId: string; infected: boolean; deceased: boolean }, snapshot: Level8CanonicalSnapshot) => void;
  onPursuitStarted?: (payload: { objective: string; stairsTargetId: string }, snapshot: Level8CanonicalSnapshot) => void;
  onSacrificeDecisionStarted?: (payload: {
    cinematicId: string;
    selectedSacrificeIds: string[];
    protectIds: string[];
  }) => void;
  onSacrificeLastStandStarted?: (payload: { cinematicId: string; selectedSacrificeIds: string[] }) => void;
  onPartyAdjustedForNextLevel?: (payload: { nextLevelId: string; survivingPartyIds: string[] }, snapshot: Level8CanonicalSnapshot) => void;
  onStateChanged?: (snapshot: Level8CanonicalSnapshot) => void;
}

export class Level8CanonicalSystem {
  private readonly config: Level8CanonicalConfig;
  private readonly callbacks: Level8CanonicalCallbacks;
  private readonly partyState: PartyStateSystem;

  private phase: Level8CanonicalPhase = 'mass_infected_assault';
  private currentObjective: string;
  private killCount = 0;
  private stragglersCleared = 0;
  private stairsReached = false;
  private damianInfected = false;
  private damianDeceased = false;
  private selectedSacrificeIds: string[] = [];

  constructor(config: Level8CanonicalConfig, initialParty: PartyMember[], callbacks: Level8CanonicalCallbacks = {}) {
    this.validateConfig(config, initialParty);
    this.config = config;
    this.callbacks = callbacks;
    this.partyState = new PartyStateSystem(initialParty);
    this.currentObjective = config.massAssault.introObjective;

    this.publishState();
  }

  processEvent(event: Level8CanonicalEvent): void {
    if (this.phase === 'completed') {
      return;
    }

    switch (this.phase) {
      case 'mass_infected_assault':
        this.processMassAssaultEvent(event);
        return;
      case 'damian_reveal_cinematic':
        this.processDamianCinematicEvent(event);
        return;
      case 'staircase_pursuit':
        this.processPursuitEvent(event);
        return;
      case 'sacrifice_decision_cinematic':
        this.processSacrificeDecisionEvent(event);
        return;
      case 'sacrifice_last_stand_cinematic':
        this.processSacrificeLastStandEvent(event);
        return;
      default:
        if (event.type === 'manual-complete') {
          this.completeLevel();
        }
    }
  }

  getSnapshot(): Level8CanonicalSnapshot {
    return {
      levelId: this.config.levelId,
      phase: this.phase,
      currentObjective: this.currentObjective,
      killCounter: {
        current: this.killCount,
        required: this.config.massAssault.requiredKills,
        waveId: this.config.massAssault.waveId
      },
      pursuit: {
        stragglersCleared: this.stragglersCleared,
        required: this.config.pursuit.minStragglersToClear,
        stairsReached: this.stairsReached
      },
      damian: {
        id: this.config.damianId,
        infected: this.damianInfected,
        deceased: this.damianDeceased
      },
      sacrifice: {
        availableCandidates: this.getAvailableSacrificeCandidates(),
        selected: [...this.selectedSacrificeIds],
        resolved: this.phase === 'completed'
      },
      survivingParty: this.getSurvivingPartyIds(),
      nextLevelId: this.phase === 'completed' ? this.config.nextLevelId : undefined
    };
  }

  private processMassAssaultEvent(event: Level8CanonicalEvent): void {
    if (event.type !== 'zombie-killed') {
      if (event.type === 'manual-complete') {
        this.transitionToDamianCinematic();
      }
      return;
    }

    if (event.waveId !== this.config.massAssault.waveId) {
      return;
    }

    if (this.killCount >= this.config.massAssault.requiredKills) {
      return;
    }

    this.killCount += 1;
    this.callbacks.onKillCounterChanged?.(
      {
        current: this.killCount,
        required: this.config.massAssault.requiredKills,
        waveId: this.config.massAssault.waveId
      },
      this.getSnapshot()
    );

    if (this.killCount >= this.config.massAssault.requiredKills) {
      this.callbacks.onMassAssaultCompleted?.(
        {
          waveId: this.config.massAssault.waveId,
          kills: this.killCount
        },
        this.getSnapshot()
      );
      this.transitionToDamianCinematic();
      return;
    }

    this.publishState();
  }

  private transitionToDamianCinematic(): void {
    this.phase = 'damian_reveal_cinematic';
    this.currentObjective = 'Intentar descansar; la infección de Damián se revela y estalla la tragedia.';

    this.callbacks.onDamianCinematicRequested?.({
      cinematicId: this.config.damianCinematicId,
      dialogue: this.config.damianCinematicDialogue
    });

    this.publishState();
  }

  private processDamianCinematicEvent(event: Level8CanonicalEvent): void {
    if (event.type !== 'damian-cinematic-finished' && event.type !== 'manual-complete') {
      return;
    }

    this.damianInfected = true;
    this.damianDeceased = true;
    this.partyState.markInfected(this.config.damianId);
    this.partyState.markDead(this.config.damianId);

    this.callbacks.onDamianFateResolved?.(
      {
        damianId: this.config.damianId,
        infected: true,
        deceased: true
      },
      this.getSnapshot()
    );

    this.phase = 'staircase_pursuit';
    this.currentObjective = this.config.pursuit.objective;

    this.callbacks.onPursuitStarted?.(
      {
        objective: this.config.pursuit.objective,
        stairsTargetId: this.config.pursuit.stairsTargetId
      },
      this.getSnapshot()
    );

    this.publishState();
  }

  private processPursuitEvent(event: Level8CanonicalEvent): void {
    if (event.type === 'stair-segment-cleared' && event.targetId) {
      this.stragglersCleared += 1;
      this.publishState();
      return;
    }

    if (event.type === 'stairs-reached' && event.targetId === this.config.pursuit.stairsTargetId) {
      if (this.stragglersCleared < this.config.pursuit.minStragglersToClear) {
        return;
      }

      this.stairsReached = true;
      this.startSacrificeDecision();
      return;
    }

    if (event.type === 'manual-complete') {
      this.stairsReached = true;
      this.startSacrificeDecision();
    }
  }

  private startSacrificeDecision(): void {
    this.phase = 'sacrifice_decision_cinematic';
    this.selectedSacrificeIds = this.getAvailableSacrificeCandidates();
    this.currentObjective =
      this.selectedSacrificeIds.length > 0
        ? 'Hernán y/o Yamil se quedan para frenar a la horda mientras el resto baja al 3° subsuelo.'
        : 'Nadie puede quedarse: el grupo completo se repliega al 3° subsuelo.';

    this.callbacks.onSacrificeDecisionStarted?.({
      cinematicId: this.config.sacrifice.decisionCinematicId,
      selectedSacrificeIds: [...this.selectedSacrificeIds],
      protectIds: [...this.config.sacrifice.protectIds]
    });

    this.publishState();
  }

  private processSacrificeDecisionEvent(event: Level8CanonicalEvent): void {
    if (event.type !== 'sacrifice-cinematic-finished' && event.type !== 'manual-complete') {
      return;
    }

    if (this.selectedSacrificeIds.length === 0) {
      this.completeLevel();
      return;
    }

    this.phase = 'sacrifice_last_stand_cinematic';
    this.currentObjective = 'Resistir los últimos minutos del sacrificio mientras el grupo escapa.';

    this.callbacks.onSacrificeLastStandStarted?.({
      cinematicId: this.config.sacrifice.lastStandCinematicId,
      selectedSacrificeIds: [...this.selectedSacrificeIds]
    });

    this.publishState();
  }

  private processSacrificeLastStandEvent(event: Level8CanonicalEvent): void {
    if (event.type !== 'sacrifice-cinematic-finished' && event.type !== 'manual-complete') {
      return;
    }

    this.selectedSacrificeIds.forEach((id) => {
      this.partyState.markDead(id);
    });

    this.completeLevel();
  }

  private completeLevel(): void {
    this.phase = 'completed';
    this.currentObjective = `El grupo superviviente escapa hacia ${this.config.nextLevelId}.`;

    this.callbacks.onPartyAdjustedForNextLevel?.(
      {
        nextLevelId: this.config.nextLevelId,
        survivingPartyIds: this.getSurvivingPartyIds()
      },
      this.getSnapshot()
    );

    this.publishState();
  }

  private getAvailableSacrificeCandidates(): string[] {
    return this.config.sacrifice.optionalSacrificeIds.filter((id) => {
      const partyMember = this.partyState.getSnapshot().find((member) => member.id === id);
      if (!partyMember) {
        return false;
      }

      return partyMember.status === 'active' || partyMember.status === 'rescued';
    });
  }

  private getSurvivingPartyIds(): string[] {
    return this.partyState
      .getSnapshot()
      .filter((member) => member.status !== 'dead' && member.status !== 'removed')
      .map((member) => member.id);
  }

  private publishState(): void {
    const snapshot = this.getSnapshot();
    this.callbacks.onObjectiveUpdated?.(snapshot.currentObjective, snapshot);
    this.callbacks.onStateChanged?.(snapshot);
  }

  private validateConfig(config: Level8CanonicalConfig, initialParty: PartyMember[]): void {
    if (!config.levelId.trim()) {
      throw new Error('Level8CanonicalSystem: levelId es obligatorio.');
    }

    if (config.massAssault.requiredKills !== 105) {
      throw new Error('Level8CanonicalSystem: la oleada canónica requiere exactamente 105 bajas.');
    }

    if (!config.massAssault.waveId.trim()) {
      throw new Error('Level8CanonicalSystem: massAssault.waveId es obligatorio.');
    }

    if (config.sacrifice.optionalSacrificeIds.length !== 2) {
      throw new Error('Level8CanonicalSystem: optionalSacrificeIds debe incluir exactamente a Hernán y Yamil.');
    }

    const requiredCharacterIds = new Set([
      config.damianId,
      ...config.sacrifice.protectIds,
      ...config.sacrifice.optionalSacrificeIds
    ]);

    requiredCharacterIds.forEach((characterId) => {
      const existsInParty = initialParty.some((member) => member.id === characterId);
      if (!existsInParty && config.sacrifice.optionalSacrificeIds.includes(characterId)) {
        return;
      }

      if (!existsInParty) {
        throw new Error(`Level8CanonicalSystem: el personaje requerido "${characterId}" no está en la party inicial.`);
      }
    });
  }
}
