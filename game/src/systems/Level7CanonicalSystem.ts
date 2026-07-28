export type Level7CanonicalPhase =
  | 'briefing_cinematic'
  | 'resource_inventory'
  | 'descent_to_subsuelo2'
  | 'infected_corridor'
  | 'link_to_level8'
  | 'completed';

export type Level7CanonicalGameplayEventType = 'floor-reached' | 'corridor-zone-cleared' | 'level-link-triggered';

export interface Level7CanonicalDialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
}

export interface Level7ResourceInventory {
  ammo: Record<string, number>;
  healing: Record<string, number>;
  utility: Record<string, number>;
}

export interface Level7CanonicalCorridorZone {
  id: string;
  label: string;
}

export interface Level7CanonicalGameplayEvent {
  type: Level7CanonicalGameplayEventType;
  floor?: number;
  targetId?: string;
}

export interface Level7CanonicalConfig {
  levelId: string;
  registryKey?: string;
  cinematicId: string;
  cinematicDialogue: Level7CanonicalDialogueLine[];
  inventory: Level7ResourceInventory;
  descentObjective: string;
  infectedCorridorObjective: string;
  level8LinkObjective: string;
  corridorZones: Level7CanonicalCorridorZone[];
  level8Link: {
    triggerId: string;
    nextLevelId: string;
  };
}

export interface Level7CanonicalSnapshot {
  levelId: string;
  phase: Level7CanonicalPhase;
  currentObjective: string;
  cinematicPlayed: boolean;
  inventoryReviewed: boolean;
  reachedSubsuelo2: boolean;
  clearedCorridorZones: string[];
  nextLevelId?: string;
}

export interface Level7CanonicalCallbacks {
  onCinematicStarted?: (payload: { cinematicId: string; dialogue: Level7CanonicalDialogueLine[] }) => void;
  onInventoryShown?: (payload: { inventory: Level7ResourceInventory }) => void;
  onObjectiveUpdated?: (objective: string, snapshot: Level7CanonicalSnapshot) => void;
  onCorridorProgress?: (payload: { cleared: number; total: number; zoneId: string }, snapshot: Level7CanonicalSnapshot) => void;
  onLevel8LinkReady?: (payload: { triggerId: string; nextLevelId: string }, snapshot: Level7CanonicalSnapshot) => void;
  onCompleted?: (snapshot: Level7CanonicalSnapshot) => void;
  onStateChanged?: (snapshot: Level7CanonicalSnapshot) => void;
}

export class Level7CanonicalSystem {
  private readonly config: Level7CanonicalConfig;
  private readonly callbacks: Level7CanonicalCallbacks;
  private readonly registryKey: string;
  private readonly clearedCorridorZones = new Set<string>();

  private phase: Level7CanonicalPhase = 'briefing_cinematic';
  private currentObjective = 'Presenciá la discusión del grupo y definí la ruta de escape.';
  private cinematicPlayed = false;
  private inventoryReviewed = false;
  private reachedSubsuelo2 = false;

  constructor(config: Level7CanonicalConfig, callbacks: Level7CanonicalCallbacks = {}) {
    this.validateConfig(config);
    this.config = config;
    this.callbacks = callbacks;
    this.registryKey = config.registryKey ?? 'level7CanonicalState';
  }

  startBriefing(): void {
    if (this.phase !== 'briefing_cinematic') {
      return;
    }

    this.callbacks.onCinematicStarted?.({
      cinematicId: this.config.cinematicId,
      dialogue: this.config.cinematicDialogue
    });

    this.cinematicPlayed = true;
    this.phase = 'resource_inventory';
    this.currentObjective = 'Revisá el inventario y municiones antes de retomar el descenso.';
    this.callbacks.onInventoryShown?.({ inventory: this.config.inventory });
    this.publishState();
  }

  confirmInventoryAndResumeGameplay(): void {
    if (this.phase !== 'resource_inventory') {
      return;
    }

    this.inventoryReviewed = true;
    this.phase = 'descent_to_subsuelo2';
    this.currentObjective = this.config.descentObjective;
    this.publishState();
  }

  processGameplayEvent(event: Level7CanonicalGameplayEvent): void {
    if (this.phase === 'completed') {
      return;
    }

    if (event.type === 'floor-reached' && event.floor === 2 && this.phase === 'descent_to_subsuelo2') {
      this.reachedSubsuelo2 = true;
      this.phase = 'infected_corridor';
      this.currentObjective = this.config.infectedCorridorObjective;
      this.publishState();
      return;
    }

    if (event.type === 'corridor-zone-cleared' && this.phase === 'infected_corridor' && event.targetId) {
      const zoneExists = this.config.corridorZones.some((zone) => zone.id === event.targetId);
      if (!zoneExists || this.clearedCorridorZones.has(event.targetId)) {
        return;
      }

      this.clearedCorridorZones.add(event.targetId);
      this.callbacks.onCorridorProgress?.(
        {
          cleared: this.clearedCorridorZones.size,
          total: this.config.corridorZones.length,
          zoneId: event.targetId
        },
        this.getSnapshot()
      );

      if (this.clearedCorridorZones.size === this.config.corridorZones.length) {
        this.phase = 'link_to_level8';
        this.currentObjective = this.config.level8LinkObjective;
        this.callbacks.onLevel8LinkReady?.(
          {
            triggerId: this.config.level8Link.triggerId,
            nextLevelId: this.config.level8Link.nextLevelId
          },
          this.getSnapshot()
        );
      }

      this.publishState();
      return;
    }

    if (
      event.type === 'level-link-triggered' &&
      this.phase === 'link_to_level8' &&
      event.targetId === this.config.level8Link.triggerId
    ) {
      this.phase = 'completed';
      this.currentObjective = `Transición lista hacia ${this.config.level8Link.nextLevelId}.`;
      const snapshot = this.getSnapshot();
      this.callbacks.onCompleted?.(snapshot);
      this.publishState();
    }
  }

  getSnapshot(): Level7CanonicalSnapshot {
    return {
      levelId: this.config.levelId,
      phase: this.phase,
      currentObjective: this.currentObjective,
      cinematicPlayed: this.cinematicPlayed,
      inventoryReviewed: this.inventoryReviewed,
      reachedSubsuelo2: this.reachedSubsuelo2,
      clearedCorridorZones: [...this.clearedCorridorZones.values()],
      nextLevelId: this.phase === 'completed' || this.phase === 'link_to_level8' ? this.config.level8Link.nextLevelId : undefined
    };
  }

  getRegistryKey(): string {
    return this.registryKey;
  }

  private publishState(): void {
    const snapshot = this.getSnapshot();
    this.callbacks.onObjectiveUpdated?.(this.currentObjective, snapshot);
    this.callbacks.onStateChanged?.(snapshot);
  }

  private validateConfig(config: Level7CanonicalConfig): void {
    if (!config.levelId.trim()) {
      throw new Error('Level7CanonicalSystem: levelId es obligatorio.');
    }

    if (!config.cinematicId.trim()) {
      throw new Error('Level7CanonicalSystem: cinematicId es obligatorio.');
    }

    if (config.cinematicDialogue.length < 6) {
      throw new Error('Level7CanonicalSystem: la discusión narrativa debe incluir al menos 6 líneas.');
    }

    if (config.corridorZones.length === 0) {
      throw new Error('Level7CanonicalSystem: se requiere al menos una zona del pasillo infectado.');
    }

    if (!config.level8Link.triggerId.trim() || !config.level8Link.nextLevelId.trim()) {
      throw new Error('Level7CanonicalSystem: el enlace al nivel 8 debe declarar triggerId y nextLevelId.');
    }
  }
}
