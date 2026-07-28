import { CombatEventSystem } from './core/CombatEventSystem';

export interface Level10ResistanceEncounterConfig {
  id: string;
  label: string;
  durationMs: number;
  zoneId: string;
}

export interface Level10ResistanceCombatConfig {
  levelId: string;
  encounters: Level10ResistanceEncounterConfig[];
}

export interface Level10ResistanceEncounterSnapshot {
  id: string;
  label: string;
  zoneId: string;
  durationMs: number;
  remainingMs: number;
  startedAt?: number;
  completedAt?: number;
  state: 'pending' | 'running' | 'completed';
}

export interface Level10ResistanceCombatCallbacks {
  onEncounterStarted?: (encounter: Level10ResistanceEncounterSnapshot) => void;
  onEncounterTick?: (encounter: Level10ResistanceEncounterSnapshot) => void;
  onEncounterCompleted?: (encounter: Level10ResistanceEncounterSnapshot) => void;
  onAllEncountersCompleted?: (encounters: Level10ResistanceEncounterSnapshot[]) => void;
}

/**
 * Controla combates de resistencia por duración para el Nivel 10.
 *
 * Se mantiene desacoplado de la escena: la escena sólo invoca start/update
 * y responde a callbacks para UI, spawns o eventos narrativos.
 */
export class Level10ResistanceCombatSystem {
  private readonly callbacks: Level10ResistanceCombatCallbacks;
  private readonly encounters: Level10ResistanceEncounterSnapshot[];
  private readonly coreCombatEvents: CombatEventSystem;
  private activeEncounterIndex = -1;

  static fromJson(
    config: Level10ResistanceCombatConfig,
    callbacks: Level10ResistanceCombatCallbacks = {}
  ): Level10ResistanceCombatSystem {
    return new Level10ResistanceCombatSystem(config, callbacks);
  }

  constructor(config: Level10ResistanceCombatConfig, callbacks: Level10ResistanceCombatCallbacks = {}) {
    this.validateConfig(config);

    this.callbacks = callbacks;
    this.coreCombatEvents = new CombatEventSystem(config.encounters.map((encounter) => encounter.zoneId));
    this.encounters = config.encounters.map((encounter) => ({
      id: encounter.id,
      label: encounter.label,
      zoneId: encounter.zoneId,
      durationMs: encounter.durationMs,
      remainingMs: encounter.durationMs,
      state: 'pending'
    }));
  }

  startEncounter(encounterId: string, now: number): boolean {
    const encounterIndex = this.encounters.findIndex((encounter) => encounter.id === encounterId);
    if (encounterIndex === -1) {
      return false;
    }

    const encounter = this.encounters[encounterIndex];
    if (encounter.state !== 'pending') {
      return false;
    }

    this.activeEncounterIndex = encounterIndex;
    encounter.state = 'running';
    encounter.startedAt = now;
    encounter.remainingMs = encounter.durationMs;

    this.coreCombatEvents.applyEvent({ type: 'zone-activated', zoneId: encounter.zoneId });
    this.callbacks.onEncounterStarted?.({ ...encounter });
    return true;
  }

  update(now: number): void {
    const encounter = this.getActiveEncounter();
    if (!encounter || encounter.state !== 'running' || typeof encounter.startedAt !== 'number') {
      return;
    }

    const elapsedMs = Math.max(0, now - encounter.startedAt);
    encounter.remainingMs = Math.max(0, encounter.durationMs - elapsedMs);

    this.coreCombatEvents.applyEvent({ type: 'wave-started', zoneId: encounter.zoneId, waveId: encounter.id });
    this.callbacks.onEncounterTick?.({ ...encounter });

    if (encounter.remainingMs > 0) {
      return;
    }

    encounter.state = 'completed';
    encounter.completedAt = now;
    this.activeEncounterIndex = -1;

    this.coreCombatEvents.applyEvent({ type: 'combat-closed', zoneId: encounter.zoneId });
    this.callbacks.onEncounterCompleted?.({ ...encounter });

    if (this.encounters.every((item) => item.state === 'completed')) {
      this.callbacks.onAllEncountersCompleted?.(this.getSnapshot());
    }
  }

  getActiveEncounter(): Level10ResistanceEncounterSnapshot | undefined {
    if (this.activeEncounterIndex < 0) {
      return undefined;
    }

    return this.encounters[this.activeEncounterIndex];
  }

  getSnapshot(): Level10ResistanceEncounterSnapshot[] {
    return this.encounters.map((encounter) => ({ ...encounter }));
  }

  private validateConfig(config: Level10ResistanceCombatConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level10ResistanceCombatSystem: levelId es obligatorio.');
    }

    if (config.encounters.length === 0) {
      throw new Error('Level10ResistanceCombatSystem: encounters debe tener al menos 1 encuentro.');
    }

    const ids = new Set<string>();
    config.encounters.forEach((encounter) => {
      if (encounter.id.trim().length === 0) {
        throw new Error('Level10ResistanceCombatSystem: cada encounter requiere id no vacío.');
      }

      if (ids.has(encounter.id)) {
        throw new Error(`Level10ResistanceCombatSystem: encounter duplicado "${encounter.id}".`);
      }
      ids.add(encounter.id);

      if (encounter.durationMs <= 0) {
        throw new Error(`Level10ResistanceCombatSystem: encounter "${encounter.id}" requiere durationMs > 0.`);
      }
    });
  }
}
