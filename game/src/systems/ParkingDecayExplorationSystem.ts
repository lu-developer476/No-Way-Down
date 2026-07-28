export type ParkingLightState = 'active' | 'dimmed' | 'flickering' | 'off';

export interface ParkingDecayLightConfig {
  id: string;
  baseIntensity?: number;
  critical?: boolean;
}

export interface ParkingDecayEnvironmentalEvent {
  id: string;
  type: 'metal-creak' | 'distant-impact' | 'vehicle-alarm' | 'radio-static' | 'wind-gust';
  hint?: string;
  intensity?: number;
  nonBlocking?: boolean;
}

export interface ParkingDecayStageConfig {
  id: string;
  progress: number;
  targetActiveLights: number;
  dimmedIntensity?: number;
  flickerChance?: number;
  offChance?: number;
  environmentalEvents?: ParkingDecayEnvironmentalEvent[];
}

export interface ParkingDecaySpatialEventConfig {
  id: string;
  triggerX: number;
  event: ParkingDecayEnvironmentalEvent;
  once?: boolean;
}

export interface ParkingDecayExplorationConfig {
  levelId: string;
  progression: {
    startX: number;
    endX: number;
  };
  minimumActiveLights?: 1 | 2;
  lights: ParkingDecayLightConfig[];
  stages: ParkingDecayStageConfig[];
  spatialEvents?: ParkingDecaySpatialEventConfig[];
}

export interface ParkingDecayLightSnapshot {
  id: string;
  state: ParkingLightState;
  intensity: number;
}

export interface ParkingDecaySnapshot {
  levelId: string;
  stageId: string;
  progress: number;
  farthestX: number;
  activeLights: number;
  lights: ParkingDecayLightSnapshot[];
  triggeredEvents: string[];
}

export interface ParkingDecayExplorationCallbacks {
  onStageChanged?: (stage: ParkingDecayStageConfig, snapshot: ParkingDecaySnapshot) => void;
  onLightingUpdated?: (snapshot: ParkingDecaySnapshot) => void;
  onEnvironmentalEvent?: (event: ParkingDecayEnvironmentalEvent, snapshot: ParkingDecaySnapshot) => void;
}

interface RuntimeLight {
  config: ParkingDecayLightConfig;
  state: ParkingLightState;
  intensity: number;
}

const DEFAULT_DIMMED_INTENSITY = 0.28;
const DEFAULT_FLICKER_CHANCE = 0.2;
const DEFAULT_OFF_CHANCE = 0.45;

/**
 * Sistema unilateral de deterioro ambiental para exploración del estacionamiento.
 *
 * - El progreso solo avanza hacia delante (farthestX).
 * - Cada stage degrada iluminación y dispara eventos ambientales no bloqueantes.
 * - Siempre preserva `minimumActiveLights` luces activas para mantener legibilidad/inspección.
 */
export class ParkingDecayExplorationSystem {
  private readonly config: ParkingDecayExplorationConfig;
  private readonly callbacks: ParkingDecayExplorationCallbacks;
  private readonly runtimeLights: RuntimeLight[];
  private readonly triggeredEvents = new Set<string>();
  private farthestX: number;
  private currentStageIndex = 0;

  static fromJson(
    config: ParkingDecayExplorationConfig,
    callbacks: ParkingDecayExplorationCallbacks = {}
  ): ParkingDecayExplorationSystem {
    return new ParkingDecayExplorationSystem(config, callbacks);
  }

  constructor(
    config: ParkingDecayExplorationConfig,
    callbacks: ParkingDecayExplorationCallbacks = {}
  ) {
    this.validateConfig(config);
    this.config = {
      ...config,
      minimumActiveLights: config.minimumActiveLights ?? 2,
      spatialEvents: config.spatialEvents ?? []
    };
    this.callbacks = callbacks;
    this.farthestX = config.progression.startX;
    this.runtimeLights = config.lights.map((light) => ({
      config: light,
      state: 'active',
      intensity: this.clampIntensity(light.baseIntensity ?? 1)
    }));

    this.applyStage(0, false);
  }

  updatePlayerPosition(currentX: number): ParkingDecaySnapshot {
    if (currentX > this.farthestX) {
      this.farthestX = currentX;
    }

    this.triggerSpatialEvents();
    this.updateStageByProgress();

    const snapshot = this.getSnapshot();
    this.callbacks.onLightingUpdated?.(snapshot);
    return snapshot;
  }

  getSnapshot(): ParkingDecaySnapshot {
    return {
      levelId: this.config.levelId,
      stageId: this.config.stages[this.currentStageIndex].id,
      progress: this.getProgress(),
      farthestX: this.farthestX,
      activeLights: this.runtimeLights.filter((light) => light.state !== 'off').length,
      lights: this.runtimeLights.map((light) => ({
        id: light.config.id,
        state: light.state,
        intensity: light.intensity
      })),
      triggeredEvents: [...this.triggeredEvents.values()]
    };
  }

  private updateStageByProgress(): void {
    const progress = this.getProgress();
    let nextStageIndex = this.currentStageIndex;

    while (
      nextStageIndex + 1 < this.config.stages.length
      && progress >= this.config.stages[nextStageIndex + 1].progress
    ) {
      nextStageIndex += 1;
    }

    if (nextStageIndex !== this.currentStageIndex) {
      this.applyStage(nextStageIndex, true);
    }
  }

  private applyStage(stageIndex: number, emitCallbacks: boolean): void {
    this.currentStageIndex = stageIndex;
    const stage = this.config.stages[stageIndex];

    const minActive = this.config.minimumActiveLights ?? 2;
    const targetActive = Math.max(minActive, Math.min(this.runtimeLights.length, stage.targetActiveLights));

    const prioritized = [...this.runtimeLights].sort((a, b) => Number(b.config.critical ?? false) - Number(a.config.critical ?? false));
    const activeIds = new Set(prioritized.slice(0, targetActive).map((light) => light.config.id));

    this.runtimeLights.forEach((light) => {
      const base = this.clampIntensity(light.config.baseIntensity ?? 1);
      if (activeIds.has(light.config.id)) {
        const flickerChance = stage.flickerChance ?? DEFAULT_FLICKER_CHANCE;
        const isFlickering = Math.random() < flickerChance;
        light.state = isFlickering ? 'flickering' : 'active';
        light.intensity = isFlickering ? this.clampIntensity(base * 0.72) : base;
        return;
      }

      const offChance = stage.offChance ?? DEFAULT_OFF_CHANCE;
      if (Math.random() < offChance) {
        light.state = 'off';
        light.intensity = 0;
      } else {
        light.state = 'dimmed';
        light.intensity = this.clampIntensity(stage.dimmedIntensity ?? DEFAULT_DIMMED_INTENSITY);
      }
    });

    stage.environmentalEvents?.forEach((event) => this.emitEnvironmentalEvent(event));

    if (emitCallbacks) {
      const snapshot = this.getSnapshot();
      this.callbacks.onStageChanged?.(stage, snapshot);
      this.callbacks.onLightingUpdated?.(snapshot);
    }
  }

  private triggerSpatialEvents(): void {
    (this.config.spatialEvents ?? []).forEach((spatialEvent) => {
      const wasTriggered = this.triggeredEvents.has(spatialEvent.id);
      if (wasTriggered && (spatialEvent.once ?? true)) {
        return;
      }

      if (this.farthestX >= spatialEvent.triggerX) {
        this.emitEnvironmentalEvent(spatialEvent.event, spatialEvent.id);
      }
    });
  }

  private emitEnvironmentalEvent(event: ParkingDecayEnvironmentalEvent, eventId?: string): void {
    const resolvedId = eventId ?? event.id;
    if (this.triggeredEvents.has(resolvedId)) {
      return;
    }

    this.triggeredEvents.add(resolvedId);
    this.callbacks.onEnvironmentalEvent?.(
      { ...event, nonBlocking: event.nonBlocking ?? true },
      this.getSnapshot()
    );
  }

  private getProgress(): number {
    const { startX, endX } = this.config.progression;
    const distance = Math.max(1, endX - startX);
    return Math.max(0, Math.min(1, (this.farthestX - startX) / distance));
  }

  private clampIntensity(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private validateConfig(config: ParkingDecayExplorationConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('ParkingDecayExplorationSystem: levelId es obligatorio.');
    }

    if (config.lights.length < 2) {
      throw new Error('ParkingDecayExplorationSystem: se requieren al menos 2 luces para degradación progresiva.');
    }

    if (config.stages.length === 0) {
      throw new Error('ParkingDecayExplorationSystem: stages requiere al menos un estado de deterioro.');
    }

    const sortedStages = [...config.stages].sort((a, b) => a.progress - b.progress);
    const hasChangedOrder = sortedStages.some((entry, index) => entry.id !== config.stages[index].id);
    if (hasChangedOrder) {
      throw new Error('ParkingDecayExplorationSystem: stages debe estar ordenado por progress ascendente.');
    }

    const lightIds = new Set<string>();
    config.lights.forEach((light) => {
      if (light.id.trim().length === 0) {
        throw new Error('ParkingDecayExplorationSystem: cada luz requiere id no vacío.');
      }

      if (lightIds.has(light.id)) {
        throw new Error(`ParkingDecayExplorationSystem: luz duplicada "${light.id}".`);
      }

      lightIds.add(light.id);
    });
  }
}
