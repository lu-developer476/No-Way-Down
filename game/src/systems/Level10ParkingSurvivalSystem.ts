import { CombatEvent, CombatEventSystem } from './core/CombatEventSystem';

export type Level10ParkingSurvivalState = 'idle' | 'active' | 'completed' | 'failed';
export type Level10ParkingPressureMode = 'waves' | 'continuous' | 'hybrid';

export interface Level10ParkingCarAnchorConfig {
  id: string;
  x: number;
  y: number;
  defenseRadius: number;
}

export interface Level10ParkingWaveConfig {
  id: string;
  label: string;
  startAtMs: number;
  durationMs: number;
  spawnIntervalMs: number;
  enemiesPerSpawn: number;
  maxAliveEnemies?: number;
  spawnPointIds: string[];
}

export interface Level10ParkingContinuousPressureConfig {
  enabled: boolean;
  baseSpawnIntervalMs: number;
  rampEveryMs: number;
  minSpawnIntervalMs: number;
  enemiesPerSpawn: number;
  spawnPointIds: string[];
}

export interface Level10ParkingNarrativeEventConfig {
  id: string;
  triggerAtMs: number;
  oneShot?: boolean;
  title: string;
  description: string;
  tags: string[];
}

export interface Level10ParkingInfectionMilestoneConfig {
  id: string;
  triggerAtMs: number;
  stageId: string;
  severity: 'leve' | 'moderada' | 'grave' | 'critica';
  hint?: string;
}

export interface Level10ParkingInfectionLinkConfig {
  enabled: boolean;
  infectionId: string;
  milestones: Level10ParkingInfectionMilestoneConfig[];
}

export interface Level10ParkingVisibleTimerConfig {
  enabled: boolean;
  format: 'mm:ss' | 'm:ss';
  warningThresholdMs: number;
}

export interface Level10ParkingSurvivalConfig {
  levelId: string;
  survivalId: string;
  durationMs: number;
  carAnchor: Level10ParkingCarAnchorConfig;
  pressureMode: Level10ParkingPressureMode;
  waves: Level10ParkingWaveConfig[];
  continuousPressure?: Level10ParkingContinuousPressureConfig;
  visibleTimer: Level10ParkingVisibleTimerConfig;
  narrativeEvents: Level10ParkingNarrativeEventConfig[];
  infectionLink: Level10ParkingInfectionLinkConfig;
}

export interface Level10ParkingSpawnRequest {
  source: 'wave' | 'continuous';
  sourceId: string;
  spawnPointId: string;
  count: number;
}

export interface Level10ParkingInfectionMilestonePayload {
  infectionId: string;
  milestoneId: string;
  stageId: string;
  severity: 'leve' | 'moderada' | 'grave' | 'critica';
  hint?: string;
}

export interface Level10ParkingNarrativePayload {
  id: string;
  title: string;
  description: string;
  tags: string[];
  elapsedMs: number;
  remainingMs: number;
}

export interface Level10ParkingSurvivalSnapshot {
  levelId: string;
  survivalId: string;
  state: Level10ParkingSurvivalState;
  elapsedMs: number;
  remainingMs: number;
  timerLabel: string;
  warningState: boolean;
  carAnchor: Level10ParkingCarAnchorConfig;
  queueSize: number;
  triggeredNarrativeEventIds: string[];
  triggeredInfectionMilestoneIds: string[];
}

export interface Level10ParkingSurvivalCallbacks {
  onStarted?: (snapshot: Level10ParkingSurvivalSnapshot) => void;
  onTimerTick?: (payload: { remainingMs: number; timerLabel: string; warningState: boolean }) => void;
  onSpawnQueued?: (request: Level10ParkingSpawnRequest, snapshot: Level10ParkingSurvivalSnapshot) => void;
  onNarrativeEvent?: (payload: Level10ParkingNarrativePayload, snapshot: Level10ParkingSurvivalSnapshot) => void;
  onInfectionMilestone?: (
    payload: Level10ParkingInfectionMilestonePayload,
    snapshot: Level10ParkingSurvivalSnapshot
  ) => void;
  onCombatEvent?: (event: CombatEvent, snapshot: Level10ParkingSurvivalSnapshot) => void;
  onCompleted?: (snapshot: Level10ParkingSurvivalSnapshot) => void;
}

export class Level10ParkingSurvivalSystem {
  private readonly config: Level10ParkingSurvivalConfig;
  private readonly callbacks: Level10ParkingSurvivalCallbacks;
  private readonly coreCombatEvents: CombatEventSystem;

  private state: Level10ParkingSurvivalState = 'idle';
  private elapsedMs = 0;
  private lastWaveSpawnById = new Map<string, number>();
  private lastContinuousSpawnAt = 0;
  private spawnQueue: Level10ParkingSpawnRequest[] = [];
  private startedWaveIds = new Set<string>();
  private continuousPressureStarted = false;
  private triggeredNarrativeEventIds = new Set<string>();
  private triggeredInfectionMilestoneIds = new Set<string>();

  static fromJson(
    config: Level10ParkingSurvivalConfig,
    callbacks: Level10ParkingSurvivalCallbacks = {}
  ): Level10ParkingSurvivalSystem {
    return new Level10ParkingSurvivalSystem(config, callbacks);
  }

  constructor(config: Level10ParkingSurvivalConfig, callbacks: Level10ParkingSurvivalCallbacks = {}) {
    this.validateConfig(config);
    this.config = {
      ...config,
      waves: [...config.waves].sort((a, b) => a.startAtMs - b.startAtMs),
      narrativeEvents: [...config.narrativeEvents].sort((a, b) => a.triggerAtMs - b.triggerAtMs),
      infectionLink: {
        ...config.infectionLink,
        milestones: [...config.infectionLink.milestones].sort((a, b) => a.triggerAtMs - b.triggerAtMs)
      }
    };
    this.callbacks = callbacks;
    this.coreCombatEvents = new CombatEventSystem([this.config.survivalId]);
  }

  start(): void {
    if (this.state !== 'idle') {
      return;
    }

    this.state = 'active';
    this.elapsedMs = 0;
    this.lastContinuousSpawnAt = 0;
    this.spawnQueue = [];
    this.triggeredNarrativeEventIds.clear();
    this.triggeredInfectionMilestoneIds.clear();
    this.lastWaveSpawnById.clear();
    this.startedWaveIds.clear();
    this.continuousPressureStarted = false;

    this.emitCombatEvent({ type: 'zone-activated', zoneId: this.config.survivalId, metadata: { mode: this.config.pressureMode } });
    this.emitCombatEvent({ type: 'wave-started', zoneId: this.config.survivalId, waveId: 'survival-start' });
    this.callbacks.onStarted?.(this.getSnapshot());
    this.emitTimerTick();
  }

  update(deltaMs: number): void {
    if (this.state !== 'active') {
      return;
    }

    this.elapsedMs = Math.min(this.config.durationMs, this.elapsedMs + Math.max(0, deltaMs));

    this.queueWavePressure();
    this.queueContinuousPressure();
    this.dispatchNarrativeEvents();
    this.dispatchInfectionMilestones();
    this.emitTimerTick();

    if (this.elapsedMs >= this.config.durationMs) {
      this.state = 'completed';
      this.emitCombatEvent({ type: 'zone-cleared', zoneId: this.config.survivalId });
      this.callbacks.onCompleted?.(this.getSnapshot());
    }
  }

  fail(): void {
    if (this.state !== 'active') {
      return;
    }

    this.state = 'failed';
    this.emitCombatEvent({
      type: 'combat-closed',
      zoneId: this.config.survivalId,
      metadata: { failed: true, reason: 'survival-failed' }
    });
  }

  consumeSpawnQueue(maxItems = Number.POSITIVE_INFINITY): Level10ParkingSpawnRequest[] {
    if (maxItems <= 0 || this.spawnQueue.length === 0) {
      return [];
    }

    const amount = Math.min(maxItems, this.spawnQueue.length);
    return this.spawnQueue.splice(0, amount);
  }

  getSnapshot(): Level10ParkingSurvivalSnapshot {
    const remainingMs = Math.max(0, this.config.durationMs - this.elapsedMs);
    return {
      levelId: this.config.levelId,
      survivalId: this.config.survivalId,
      state: this.state,
      elapsedMs: this.elapsedMs,
      remainingMs,
      timerLabel: this.formatTimer(remainingMs),
      warningState: remainingMs <= this.config.visibleTimer.warningThresholdMs,
      carAnchor: this.config.carAnchor,
      queueSize: this.spawnQueue.length,
      triggeredNarrativeEventIds: Array.from(this.triggeredNarrativeEventIds),
      triggeredInfectionMilestoneIds: Array.from(this.triggeredInfectionMilestoneIds)
    };
  }

  private queueWavePressure(): void {
    if (this.config.pressureMode === 'continuous') {
      return;
    }

    this.config.waves.forEach((wave) => {
      const inWindow = this.elapsedMs >= wave.startAtMs && this.elapsedMs <= wave.startAtMs + wave.durationMs;
      if (!inWindow) {
        return;
      }

      if (!this.startedWaveIds.has(wave.id)) {
        this.startedWaveIds.add(wave.id);
        this.emitCombatEvent({ type: 'wave-started', zoneId: this.config.survivalId, waveId: wave.id });
      }

      const lastSpawnAt = this.lastWaveSpawnById.get(wave.id) ?? wave.startAtMs - wave.spawnIntervalMs;
      if (this.elapsedMs - lastSpawnAt < wave.spawnIntervalMs) {
        return;
      }

      this.lastWaveSpawnById.set(wave.id, this.elapsedMs);
      const spawnPointId = this.pickSpawnPoint(wave.spawnPointIds);
      const request: Level10ParkingSpawnRequest = {
        source: 'wave',
        sourceId: wave.id,
        spawnPointId,
        count: wave.enemiesPerSpawn
      };
      this.spawnQueue.push(request);
      this.callbacks.onSpawnQueued?.(request, this.getSnapshot());
    });
  }

  private queueContinuousPressure(): void {
    if (this.config.pressureMode === 'waves') {
      return;
    }

    const pressure = this.config.continuousPressure;
    if (!pressure?.enabled) {
      return;
    }

    const ramps = Math.floor(this.elapsedMs / Math.max(1, pressure.rampEveryMs));
    const intervalReduction = ramps * 120;
    const dynamicIntervalMs = Math.max(pressure.minSpawnIntervalMs, pressure.baseSpawnIntervalMs - intervalReduction);

    if (this.elapsedMs - this.lastContinuousSpawnAt < dynamicIntervalMs) {
      return;
    }

    this.lastContinuousSpawnAt = this.elapsedMs;
    if (!this.continuousPressureStarted) {
      this.continuousPressureStarted = true;
      this.emitCombatEvent({ type: 'wave-started', zoneId: this.config.survivalId, waveId: 'continuous-pressure' });
    }

    const spawnPointId = this.pickSpawnPoint(pressure.spawnPointIds);
    const request: Level10ParkingSpawnRequest = {
      source: 'continuous',
      sourceId: 'continuous-pressure',
      spawnPointId,
      count: pressure.enemiesPerSpawn
    };
    this.spawnQueue.push(request);
    this.callbacks.onSpawnQueued?.(request, this.getSnapshot());
  }

  private dispatchNarrativeEvents(): void {
    this.config.narrativeEvents.forEach((event) => {
      const oneShot = event.oneShot ?? true;
      if (oneShot && this.triggeredNarrativeEventIds.has(event.id)) {
        return;
      }

      if (this.elapsedMs < event.triggerAtMs) {
        return;
      }

      if (oneShot) {
        this.triggeredNarrativeEventIds.add(event.id);
      }

      const payload: Level10ParkingNarrativePayload = {
        id: event.id,
        title: event.title,
        description: event.description,
        tags: [...event.tags],
        elapsedMs: this.elapsedMs,
        remainingMs: Math.max(0, this.config.durationMs - this.elapsedMs)
      };
      this.callbacks.onNarrativeEvent?.(payload, this.getSnapshot());
    });
  }

  private dispatchInfectionMilestones(): void {
    if (!this.config.infectionLink.enabled) {
      return;
    }

    this.config.infectionLink.milestones.forEach((milestone) => {
      if (this.triggeredInfectionMilestoneIds.has(milestone.id) || this.elapsedMs < milestone.triggerAtMs) {
        return;
      }

      this.triggeredInfectionMilestoneIds.add(milestone.id);

      this.callbacks.onInfectionMilestone?.(
        {
          infectionId: this.config.infectionLink.infectionId,
          milestoneId: milestone.id,
          stageId: milestone.stageId,
          severity: milestone.severity,
          hint: milestone.hint
        },
        this.getSnapshot()
      );
    });
  }

  private emitTimerTick(): void {
    const remainingMs = Math.max(0, this.config.durationMs - this.elapsedMs);
    this.emitCombatEvent({
      type: 'spawn-triggered',
      zoneId: this.config.survivalId,
      waveId: this.resolveProgressWaveId(),
      metadata: {
        elapsedMs: this.elapsedMs,
        remainingMs,
        warningState: remainingMs <= this.config.visibleTimer.warningThresholdMs
      }
    });
    this.callbacks.onTimerTick?.({
      remainingMs,
      timerLabel: this.formatTimer(remainingMs),
      warningState: remainingMs <= this.config.visibleTimer.warningThresholdMs
    });
  }

  private pickSpawnPoint(spawnPointIds: string[]): string {
    if (spawnPointIds.length === 0) {
      return 'parking_default_spawn';
    }

    const index = Math.floor(Math.random() * spawnPointIds.length);
    return spawnPointIds[index];
  }

  private resolveProgressWaveId(): string {
    const activeWave = this.config.waves.find(
      (wave) => this.elapsedMs >= wave.startAtMs && this.elapsedMs <= wave.startAtMs + wave.durationMs
    );

    if (activeWave) {
      return activeWave.id;
    }

    if (this.config.pressureMode !== 'waves' && this.continuousPressureStarted) {
      return 'continuous-pressure';
    }

    return 'survival-start';
  }

  private emitCombatEvent(event: CombatEvent): void {
    this.coreCombatEvents.applyEvent(event);
    this.callbacks.onCombatEvent?.(event, this.getSnapshot());
  }

  private formatTimer(remainingMs: number): string {
    const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (this.config.visibleTimer.format === 'mm:ss') {
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private validateConfig(config: Level10ParkingSurvivalConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level10ParkingSurvivalSystem: levelId es obligatorio.');
    }

    if (config.survivalId.trim().length === 0) {
      throw new Error('Level10ParkingSurvivalSystem: survivalId es obligatorio.');
    }

    if (config.durationMs <= 0) {
      throw new Error('Level10ParkingSurvivalSystem: durationMs debe ser mayor a 0.');
    }

    if (config.carAnchor.id.trim().length === 0 || config.carAnchor.defenseRadius <= 0) {
      throw new Error('Level10ParkingSurvivalSystem: carAnchor inválido.');
    }

    if (config.visibleTimer.enabled && config.visibleTimer.warningThresholdMs < 0) {
      throw new Error('Level10ParkingSurvivalSystem: warningThresholdMs no puede ser negativo.');
    }

    if (config.pressureMode !== 'continuous' && config.waves.length === 0) {
      throw new Error('Level10ParkingSurvivalSystem: se requiere al menos 1 oleada en modos waves/hybrid.');
    }

    const waveIds = new Set<string>();
    config.waves.forEach((wave) => {
      if (wave.id.trim().length === 0 || wave.label.trim().length === 0) {
        throw new Error('Level10ParkingSurvivalSystem: cada wave requiere id y label.');
      }
      if (waveIds.has(wave.id)) {
        throw new Error(`Level10ParkingSurvivalSystem: wave duplicada "${wave.id}".`);
      }
      waveIds.add(wave.id);

      if (wave.startAtMs < 0 || wave.durationMs <= 0 || wave.spawnIntervalMs <= 0 || wave.enemiesPerSpawn <= 0) {
        throw new Error(`Level10ParkingSurvivalSystem: wave "${wave.id}" tiene valores inválidos.`);
      }
    });

    const narrativeIds = new Set<string>();
    config.narrativeEvents.forEach((event) => {
      if (event.id.trim().length === 0) {
        throw new Error('Level10ParkingSurvivalSystem: narrative event requiere id.');
      }
      if (narrativeIds.has(event.id)) {
        throw new Error(`Level10ParkingSurvivalSystem: narrative event duplicado "${event.id}".`);
      }
      narrativeIds.add(event.id);
    });

    const milestoneIds = new Set<string>();
    config.infectionLink.milestones.forEach((milestone) => {
      if (milestone.id.trim().length === 0 || milestone.stageId.trim().length === 0) {
        throw new Error('Level10ParkingSurvivalSystem: milestone de infección inválido.');
      }
      if (milestoneIds.has(milestone.id)) {
        throw new Error(`Level10ParkingSurvivalSystem: milestone duplicado "${milestone.id}".`);
      }
      milestoneIds.add(milestone.id);
    });
  }
}
