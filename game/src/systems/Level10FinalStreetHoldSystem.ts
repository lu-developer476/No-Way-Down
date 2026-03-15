import Phaser from 'phaser';
import { CombatEvent, CombatEventSystem } from './core/CombatEventSystem';

export type Level10FinalStreetHoldState = 'idle' | 'armed' | 'active' | 'completed' | 'failed';

export interface Level10FinalStreetHoldTimerConfig {
  durationMs: number;
  warningThresholdMs: number;
  format: 'mm:ss' | 'm:ss';
}

export interface Level10FinalStreetHoldSurvivorConfig {
  protagonistId: string;
  allyId: string;
}

export interface Level10FinalStreetHoldSpawnPhaseConfig {
  id: string;
  label: string;
  startAtMs: number;
  spawnIntervalMs: number;
  enemiesPerSpawn: number;
  spawnPointIds: string[];
}

export interface Level10FinalStreetHoldConfig {
  levelId: string;
  holdId: string;
  previousCinematicId: string;
  previousCinematicTriggerId: string;
  finalCinematicTriggerId: string;
  objectiveId: string;
  objectiveLabel: string;
  survivors: Level10FinalStreetHoldSurvivorConfig;
  timer: Level10FinalStreetHoldTimerConfig;
  spawnPhases: Level10FinalStreetHoldSpawnPhaseConfig[];
}

export interface Level10FinalStreetHoldSnapshot {
  levelId: string;
  holdId: string;
  state: Level10FinalStreetHoldState;
  elapsedMs: number;
  remainingMs: number;
  warningState: boolean;
  timerLabel: string;
  objectiveId: string;
  objectiveLabel: string;
  currentPhaseId?: string;
  survivors: string[];
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
}

export interface Level10FinalStreetSpawnRequest {
  holdId: string;
  phaseId: string;
  spawnPointId: string;
  count: number;
}

export interface Level10FinalStreetHoldCallbacks {
  onHoldArmed?: (snapshot: Level10FinalStreetHoldSnapshot) => void;
  onObjectiveUpdated?: (objective: { id: string; label: string }, snapshot: Level10FinalStreetHoldSnapshot) => void;
  onHoldStarted?: (
    context: {
      holdId: string;
      previousCinematicId: string;
      previousCinematicTriggerId: string;
      finalCinematicTriggerId: string;
    },
    snapshot: Level10FinalStreetHoldSnapshot
  ) => void;
  onTimerTick?: (snapshot: Level10FinalStreetHoldSnapshot) => void;
  onSpawnRequested?: (request: Level10FinalStreetSpawnRequest, snapshot: Level10FinalStreetHoldSnapshot) => void;
  onCombatEvent?: (event: CombatEvent, snapshot: Level10FinalStreetHoldSnapshot) => void;
  onHoldFailed?: (context: { defeatedSurvivorId: string }, snapshot: Level10FinalStreetHoldSnapshot) => void;
  onHoldCompleted?: (
    context: { holdId: string; finalCinematicTriggerId: string },
    snapshot: Level10FinalStreetHoldSnapshot
  ) => void;
}

/**
 * Sistema de resistencia final para la calle previa a San Telmo en Nivel 10.
 *
 * - Se arma cuando termina la cinemática de trayecto (dos cuadras antes del barrio).
 * - Limita participantes a los dos supervivientes definidos en JSON.
 * - Ejecuta una defensa breve e intensa de 2 minutos con fases de presión configurables.
 * - Al completar el temporizador, devuelve un trigger para enganchar la cinemática final.
 */
export class Level10FinalStreetHoldSystem {
  private readonly config: Level10FinalStreetHoldConfig;
  private readonly callbacks: Level10FinalStreetHoldCallbacks;
  private readonly coreCombatEvents: CombatEventSystem;

  private state: Level10FinalStreetHoldState = 'idle';
  private startedAt?: number;
  private completedAt?: number;
  private failedAt?: number;
  private elapsedMs = 0;
  private currentPhaseId?: string;
  private startedPhaseIds = new Set<string>();
  private readonly lastSpawnByPhaseId = new Map<string, number>();

  static fromJson(
    config: Level10FinalStreetHoldConfig,
    callbacks: Level10FinalStreetHoldCallbacks = {}
  ): Level10FinalStreetHoldSystem {
    return new Level10FinalStreetHoldSystem(config, callbacks);
  }

  constructor(config: Level10FinalStreetHoldConfig, callbacks: Level10FinalStreetHoldCallbacks = {}) {
    this.validateConfig(config);
    this.config = {
      ...config,
      spawnPhases: [...config.spawnPhases].sort((a, b) => a.startAtMs - b.startAtMs)
    };
    this.callbacks = callbacks;
    this.coreCombatEvents = new CombatEventSystem([this.config.holdId]);
  }

  armFromPreviousCinematic(context: { cinematicId: string; triggerId: string }): boolean {
    const isExpectedCinematic =
      context.cinematicId === this.config.previousCinematicId
      && context.triggerId === this.config.previousCinematicTriggerId;

    if (!isExpectedCinematic || this.state !== 'idle') {
      return false;
    }

    this.state = 'armed';
    const snapshot = this.getSnapshot();
    this.callbacks.onHoldArmed?.(snapshot);
    this.callbacks.onObjectiveUpdated?.({ id: this.config.objectiveId, label: this.config.objectiveLabel }, snapshot);
    return true;
  }

  start(now: number): boolean {
    if (this.state !== 'armed') {
      return false;
    }

    this.state = 'active';
    this.startedAt = now;
    this.completedAt = undefined;
    this.failedAt = undefined;
    this.elapsedMs = 0;
    this.currentPhaseId = undefined;
    this.lastSpawnByPhaseId.clear();
    this.startedPhaseIds.clear();

    const snapshot = this.getSnapshot();
    this.emitCombatEvent({ type: 'zone-activated', zoneId: this.config.holdId });
    this.emitCombatEvent({ type: 'wave-started', zoneId: this.config.holdId, waveId: 'hold-start' });
    this.callbacks.onHoldStarted?.({
      holdId: this.config.holdId,
      previousCinematicId: this.config.previousCinematicId,
      previousCinematicTriggerId: this.config.previousCinematicTriggerId,
      finalCinematicTriggerId: this.config.finalCinematicTriggerId
    }, snapshot);
    this.callbacks.onTimerTick?.(snapshot);

    return true;
  }

  update(now: number): void {
    if (this.state !== 'active' || typeof this.startedAt !== 'number') {
      return;
    }

    this.elapsedMs = Math.min(this.config.timer.durationMs, Math.max(0, now - this.startedAt));

    this.dispatchSpawnRequests();

    const snapshot = this.getSnapshot();
    this.emitCombatEvent({
      type: 'spawn-triggered',
      zoneId: this.config.holdId,
      waveId: this.currentPhaseId ?? 'hold-start',
      metadata: {
        elapsedMs: this.elapsedMs,
        remainingMs: snapshot.remainingMs,
        warningState: snapshot.warningState
      }
    });
    this.callbacks.onTimerTick?.(snapshot);

    if (this.elapsedMs >= this.config.timer.durationMs) {
      this.state = 'completed';
      this.completedAt = now;
      const completedSnapshot = this.getSnapshot();
      this.emitCombatEvent({ type: 'zone-cleared', zoneId: this.config.holdId });
      this.callbacks.onHoldCompleted?.(
        {
          holdId: this.config.holdId,
          finalCinematicTriggerId: this.config.finalCinematicTriggerId
        },
        completedSnapshot
      );
    }
  }

  markSurvivorDefeated(survivorId: string, now: number): boolean {
    if (this.state !== 'active' || !this.isAllowedCombatant(survivorId)) {
      return false;
    }

    this.state = 'failed';
    this.failedAt = now;
    this.emitCombatEvent({
      type: 'combat-closed',
      zoneId: this.config.holdId,
      metadata: { failed: true, defeatedSurvivorId: survivorId }
    });
    this.callbacks.onHoldFailed?.({ defeatedSurvivorId: survivorId }, this.getSnapshot());
    return true;
  }

  isAllowedCombatant(entityId: string): boolean {
    return this.getSurvivorIds().includes(entityId);
  }

  getSnapshot(): Level10FinalStreetHoldSnapshot {
    const remainingMs = Math.max(0, this.config.timer.durationMs - this.elapsedMs);

    return {
      levelId: this.config.levelId,
      holdId: this.config.holdId,
      state: this.state,
      elapsedMs: this.elapsedMs,
      remainingMs,
      warningState: remainingMs <= this.config.timer.warningThresholdMs,
      timerLabel: this.formatTimer(remainingMs),
      objectiveId: this.config.objectiveId,
      objectiveLabel: this.config.objectiveLabel,
      currentPhaseId: this.currentPhaseId,
      survivors: this.getSurvivorIds(),
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      failedAt: this.failedAt
    };
  }

  private dispatchSpawnRequests(): void {
    const activePhases = this.config.spawnPhases.filter((phase) => this.elapsedMs >= phase.startAtMs);
    const currentPhase = activePhases[activePhases.length - 1];

    if (!currentPhase) {
      this.currentPhaseId = undefined;
      return;
    }

    this.currentPhaseId = currentPhase.id;

    if (!this.startedPhaseIds.has(currentPhase.id)) {
      this.startedPhaseIds.add(currentPhase.id);
      this.emitCombatEvent({ type: 'wave-started', zoneId: this.config.holdId, waveId: currentPhase.id });
    }

    const lastSpawnAt = this.lastSpawnByPhaseId.get(currentPhase.id) ?? (currentPhase.startAtMs - currentPhase.spawnIntervalMs);
    const shouldSpawn = this.elapsedMs - lastSpawnAt >= currentPhase.spawnIntervalMs;
    if (!shouldSpawn) {
      return;
    }

    this.lastSpawnByPhaseId.set(currentPhase.id, this.elapsedMs);

    const spawnPointId = this.pickSpawnPoint(currentPhase.spawnPointIds);
    const request: Level10FinalStreetSpawnRequest = {
      holdId: this.config.holdId,
      phaseId: currentPhase.id,
      spawnPointId,
      count: currentPhase.enemiesPerSpawn
    };

    this.callbacks.onSpawnRequested?.(request, this.getSnapshot());
  }

  private emitCombatEvent(event: CombatEvent): void {
    this.coreCombatEvents.applyEvent(event);
    this.callbacks.onCombatEvent?.(event, this.getSnapshot());
  }

  private pickSpawnPoint(spawnPointIds: string[]): string {
    const index = Phaser.Math.Between(0, spawnPointIds.length - 1);
    return spawnPointIds[index];
  }

  private getSurvivorIds(): string[] {
    return [this.config.survivors.protagonistId, this.config.survivors.allyId];
  }

  private formatTimer(remainingMs: number): string {
    const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (this.config.timer.format === 'm:ss') {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private validateConfig(config: Level10FinalStreetHoldConfig): void {
    if (!config.levelId.trim()) {
      throw new Error('Level10FinalStreetHoldSystem: levelId es obligatorio.');
    }

    if (!config.holdId.trim()) {
      throw new Error('Level10FinalStreetHoldSystem: holdId es obligatorio.');
    }

    if (!config.previousCinematicId.trim() || !config.previousCinematicTriggerId.trim()) {
      throw new Error('Level10FinalStreetHoldSystem: previousCinematicId y previousCinematicTriggerId son obligatorios.');
    }

    if (!config.finalCinematicTriggerId.trim()) {
      throw new Error('Level10FinalStreetHoldSystem: finalCinematicTriggerId es obligatorio.');
    }

    if (!config.objectiveId.trim() || !config.objectiveLabel.trim()) {
      throw new Error('Level10FinalStreetHoldSystem: objectiveId y objectiveLabel son obligatorios.');
    }

    if (!config.survivors.protagonistId.trim() || !config.survivors.allyId.trim()) {
      throw new Error('Level10FinalStreetHoldSystem: survivors requiere protagonistId y allyId.');
    }

    if (config.survivors.protagonistId === config.survivors.allyId) {
      throw new Error('Level10FinalStreetHoldSystem: survivors debe contener exactamente dos IDs distintos.');
    }

    if (config.timer.durationMs !== 120000) {
      throw new Error('Level10FinalStreetHoldSystem: timer.durationMs debe ser exactamente 120000 (2 minutos).');
    }

    if (config.timer.warningThresholdMs < 0 || config.timer.warningThresholdMs >= config.timer.durationMs) {
      throw new Error('Level10FinalStreetHoldSystem: warningThresholdMs debe estar entre 0 y durationMs.');
    }

    if (config.spawnPhases.length === 0) {
      throw new Error('Level10FinalStreetHoldSystem: spawnPhases debe tener al menos una fase.');
    }

    const phaseIds = new Set<string>();
    config.spawnPhases.forEach((phase) => {
      if (!phase.id.trim()) {
        throw new Error('Level10FinalStreetHoldSystem: cada fase requiere id.');
      }

      if (phaseIds.has(phase.id)) {
        throw new Error(`Level10FinalStreetHoldSystem: fase duplicada "${phase.id}".`);
      }
      phaseIds.add(phase.id);

      if (phase.startAtMs < 0 || phase.startAtMs >= config.timer.durationMs) {
        throw new Error(`Level10FinalStreetHoldSystem: fase "${phase.id}" requiere startAtMs dentro del temporizador.`);
      }

      if (phase.spawnIntervalMs <= 0) {
        throw new Error(`Level10FinalStreetHoldSystem: fase "${phase.id}" requiere spawnIntervalMs > 0.`);
      }

      if (phase.enemiesPerSpawn <= 0) {
        throw new Error(`Level10FinalStreetHoldSystem: fase "${phase.id}" requiere enemiesPerSpawn > 0.`);
      }

      if (phase.spawnPointIds.length === 0) {
        throw new Error(`Level10FinalStreetHoldSystem: fase "${phase.id}" requiere spawnPointIds.`);
      }
    });
  }
}
