import Phaser from 'phaser';
import { Player } from '../entities/Player';

export interface Level9PressureBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Level9CombatDirective {
  encounterId: string;
  enemyType: string;
  count: number;
  spawnPoints: Array<{ x: number; y: number }>;
  metadata?: Record<string, unknown>;
}

export interface Level9CinematicDirective {
  cinematicId: string;
  subtitle?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface Level9FatigueModifier {
  characterId: string;
  delta: number;
  note?: string;
}

export interface Level9PressureEventConfig {
  id: string;
  label: string;
  trigger: Level9PressureBounds;
  pressureDelta: number;
  fatigueModifiers?: Level9FatigueModifier[];
  cinematic?: Level9CinematicDirective;
  combat?: Level9CombatDirective;
  narrativeHint?: string;
}

export interface Level9PressureSegmentConfig {
  id: string;
  label: string;
  order: number;
  trigger: Level9PressureBounds;
  pressureOnEnter: number;
  objectiveOnEnter?: string;
  events: Level9PressureEventConfig[];
}

export interface Level9DescentPressureConfig {
  levelId: string;
  registryKey?: string;
  maxPressure: number;
  collapseThreshold: number;
  finalSegmentId: string;
  segments: Level9PressureSegmentConfig[];
}

export interface Level9CombatRequest {
  segmentId: string;
  eventId: string;
  encounterId: string;
  enemyType: string;
  count: number;
  spawnPoints: Array<{ x: number; y: number }>;
  metadata?: Record<string, unknown>;
}

export interface Level9FatigueState {
  characterId: string;
  fatigue: number;
  notes: string[];
}

export interface Level9DescentPressureSnapshot {
  levelId: string;
  pressure: number;
  maxPressure: number;
  collapseThreshold: number;
  state: 'descending' | 'critical' | 'collapsed' | 'completed';
  currentSegmentId?: string;
  fatigueByCharacter: Level9FatigueState[];
  segments: Array<{
    id: string;
    entered: boolean;
    completed: boolean;
    eventsTriggered: string[];
  }>;
}

export interface Level9DescentPressureCallbacks {
  onSegmentEntered?: (segment: Level9PressureSegmentConfig, snapshot: Level9DescentPressureSnapshot) => void;
  onEventTriggered?: (
    payload: { segment: Level9PressureSegmentConfig; event: Level9PressureEventConfig },
    snapshot: Level9DescentPressureSnapshot
  ) => void;
  onCinematicRequested?: (payload: Level9CinematicDirective & { segmentId: string; eventId: string }) => void;
  onCombatRequested?: (payload: Level9CombatRequest) => void;
  onFatigueChanged?: (fatigueByCharacter: Level9FatigueState[], snapshot: Level9DescentPressureSnapshot) => void;
  onPressureChanged?: (snapshot: Level9DescentPressureSnapshot) => void;
  onCollapseReached?: (snapshot: Level9DescentPressureSnapshot) => void;
  onDescentCompleted?: (snapshot: Level9DescentPressureSnapshot) => void;
}

interface RuntimeEvent {
  config: Level9PressureEventConfig;
  trigger: Phaser.GameObjects.Zone;
  triggered: boolean;
}

interface RuntimeSegment {
  config: Level9PressureSegmentConfig;
  trigger: Phaser.GameObjects.Zone;
  entered: boolean;
  completed: boolean;
  events: RuntimeEvent[];
}

function disableStaticBody(zone: Phaser.GameObjects.Zone): void {
  const body = zone.body as Phaser.Physics.Arcade.StaticBody;
  body.enable = false;
}

export class Level9DescentPressureSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly config: Level9DescentPressureConfig;
  private readonly callbacks: Level9DescentPressureCallbacks;
  private readonly registryKey: string;
  private readonly segments: RuntimeSegment[];

  private pressure = 0;
  private currentSegmentId?: string;
  private collapseNotified = false;
  private completionNotified = false;
  private readonly fatigueByCharacter = new Map<string, Level9FatigueState>();

  static fromJson(
    scene: Phaser.Scene,
    players: Player[],
    config: Level9DescentPressureConfig,
    callbacks: Level9DescentPressureCallbacks = {}
  ): Level9DescentPressureSystem {
    return new Level9DescentPressureSystem(scene, players, config, callbacks);
  }

  constructor(
    scene: Phaser.Scene,
    players: Player[],
    config: Level9DescentPressureConfig,
    callbacks: Level9DescentPressureCallbacks = {}
  ) {
    this.validateConfig(config);

    this.scene = scene;
    this.players = players as Phaser.Types.Physics.Arcade.GameObjectWithBody[];
    this.config = config;
    this.callbacks = callbacks;
    this.registryKey = config.registryKey ?? 'level9DescentPressure';
    this.segments = [...config.segments]
      .sort((a, b) => a.order - b.order)
      .map((segment) => this.createRuntimeSegment(segment));

    this.bindOverlaps();
    this.publishState();
  }

  update(): void {
    if (this.getState() === 'collapsed' && !this.collapseNotified) {
      this.collapseNotified = true;
      this.callbacks.onCollapseReached?.(this.getSnapshot());
    }
  }

  destroy(): void {
    this.segments.forEach((segment) => {
      segment.trigger.destroy();
      segment.events.forEach((event) => event.trigger.destroy());
    });
  }

  getSnapshot(): Level9DescentPressureSnapshot {
    return {
      levelId: this.config.levelId,
      pressure: this.pressure,
      maxPressure: this.config.maxPressure,
      collapseThreshold: this.config.collapseThreshold,
      state: this.getState(),
      currentSegmentId: this.currentSegmentId,
      fatigueByCharacter: Array.from(this.fatigueByCharacter.values()),
      segments: this.segments.map((segment) => ({
        id: segment.config.id,
        entered: segment.entered,
        completed: segment.completed,
        eventsTriggered: segment.events.filter((event) => event.triggered).map((event) => event.config.id)
      }))
    };
  }

  private createRuntimeSegment(config: Level9PressureSegmentConfig): RuntimeSegment {
    const segmentTrigger = this.scene.add.zone(config.trigger.x, config.trigger.y, config.trigger.width, config.trigger.height);
    this.scene.physics.add.existing(segmentTrigger, true);

    const events = config.events.map<RuntimeEvent>((eventConfig) => {
      const eventTrigger = this.scene.add.zone(
        eventConfig.trigger.x,
        eventConfig.trigger.y,
        eventConfig.trigger.width,
        eventConfig.trigger.height
      );
      this.scene.physics.add.existing(eventTrigger, true);

      return {
        config: eventConfig,
        trigger: eventTrigger,
        triggered: false
      };
    });

    return {
      config,
      trigger: segmentTrigger,
      entered: false,
      completed: false,
      events
    };
  }

  private bindOverlaps(): void {
    this.segments.forEach((segment) => {
      this.players.forEach((player) => {
        this.scene.physics.add.overlap(player, segment.trigger, () => {
          this.enterSegment(segment);
        });

        segment.events.forEach((event) => {
          this.scene.physics.add.overlap(player, event.trigger, () => {
            this.triggerEvent(segment, event);
          });
        });
      });
    });
  }

  private enterSegment(segment: RuntimeSegment): void {
    if (segment.entered || this.getState() === 'collapsed') {
      return;
    }

    segment.entered = true;
    this.currentSegmentId = segment.config.id;
    this.incrementPressure(segment.config.pressureOnEnter);

    if (segment.config.objectiveOnEnter) {
      this.scene.registry.set('currentObjective', segment.config.objectiveOnEnter);
    }

    this.callbacks.onSegmentEntered?.(segment.config, this.getSnapshot());
    this.callbacks.onPressureChanged?.(this.getSnapshot());

    this.tryCompleteDescent(segment);
    this.publishState();
  }

  private triggerEvent(segment: RuntimeSegment, event: RuntimeEvent): void {
    if (!segment.entered || event.triggered || this.getState() === 'collapsed') {
      return;
    }

    event.triggered = true;
    disableStaticBody(event.trigger);
    event.trigger.setActive(false).setVisible(false);

    this.incrementPressure(event.config.pressureDelta);

    if (event.config.narrativeHint) {
      this.scene.registry.set('level9DescentHint', event.config.narrativeHint);
    }

    this.applyFatigueModifiers(event.config.fatigueModifiers ?? []);

    if (event.config.cinematic) {
      this.callbacks.onCinematicRequested?.({
        ...event.config.cinematic,
        segmentId: segment.config.id,
        eventId: event.config.id
      });
    }

    if (event.config.combat) {
      this.callbacks.onCombatRequested?.({
        segmentId: segment.config.id,
        eventId: event.config.id,
        encounterId: event.config.combat.encounterId,
        enemyType: event.config.combat.enemyType,
        count: event.config.combat.count,
        spawnPoints: event.config.combat.spawnPoints,
        metadata: event.config.combat.metadata
      });
    }

    this.callbacks.onEventTriggered?.({ segment: segment.config, event: event.config }, this.getSnapshot());
    this.callbacks.onPressureChanged?.(this.getSnapshot());

    this.tryCompleteDescent(segment);
    this.publishState();
  }

  private applyFatigueModifiers(modifiers: Level9FatigueModifier[]): void {
    if (modifiers.length === 0) {
      return;
    }

    modifiers.forEach((modifier) => {
      const previous = this.fatigueByCharacter.get(modifier.characterId);
      const updatedFatigue = Math.max(0, (previous?.fatigue ?? 0) + modifier.delta);

      this.fatigueByCharacter.set(modifier.characterId, {
        characterId: modifier.characterId,
        fatigue: updatedFatigue,
        notes: modifier.note ? [...(previous?.notes ?? []), modifier.note] : (previous?.notes ?? [])
      });
    });

    this.callbacks.onFatigueChanged?.(Array.from(this.fatigueByCharacter.values()), this.getSnapshot());
  }

  private tryCompleteDescent(segment: RuntimeSegment): void {
    if (segment.completed) {
      return;
    }

    const allEventsDone = segment.events.every((event) => event.triggered);
    if (!allEventsDone) {
      return;
    }

    segment.completed = true;
    disableStaticBody(segment.trigger);
    segment.trigger.setActive(false).setVisible(false);

    if (segment.config.id === this.config.finalSegmentId && !this.completionNotified) {
      this.completionNotified = true;
      this.callbacks.onDescentCompleted?.(this.getSnapshot());
    }
  }

  private incrementPressure(delta: number): void {
    this.pressure = Phaser.Math.Clamp(this.pressure + delta, 0, this.config.maxPressure);
  }

  private getState(): 'descending' | 'critical' | 'collapsed' | 'completed' {
    const finalSegment = this.segments.find((segment) => segment.config.id === this.config.finalSegmentId);
    if (finalSegment?.completed) {
      return 'completed';
    }

    if (this.pressure >= this.config.collapseThreshold) {
      return 'collapsed';
    }

    if (this.pressure >= Math.floor(this.config.maxPressure * 0.7)) {
      return 'critical';
    }

    return 'descending';
  }

  private publishState(): void {
    this.scene.registry.set(this.registryKey, this.getSnapshot());
  }

  private validateConfig(config: Level9DescentPressureConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level9DescentPressureSystem: levelId es obligatorio.');
    }

    if (config.segments.length === 0) {
      throw new Error('Level9DescentPressureSystem: se requiere al menos 1 segmento.');
    }

    if (config.maxPressure <= 0) {
      throw new Error('Level9DescentPressureSystem: maxPressure debe ser > 0.');
    }

    if (config.collapseThreshold <= 0 || config.collapseThreshold > config.maxPressure) {
      throw new Error('Level9DescentPressureSystem: collapseThreshold debe estar entre 1 y maxPressure.');
    }

    const segmentIds = new Set<string>();

    config.segments.forEach((segment) => {
      if (segmentIds.has(segment.id)) {
        throw new Error(`Level9DescentPressureSystem: segmento duplicado "${segment.id}".`);
      }
      segmentIds.add(segment.id);

      const eventIds = new Set<string>();
      segment.events.forEach((event) => {
        if (eventIds.has(event.id)) {
          throw new Error(`Level9DescentPressureSystem: evento duplicado "${event.id}" en "${segment.id}".`);
        }
        eventIds.add(event.id);

        if (event.combat) {
          if (event.combat.count <= 0) {
            throw new Error(
              `Level9DescentPressureSystem: combat.count inválido en evento "${event.id}" de segmento "${segment.id}".`
            );
          }

          if (event.combat.spawnPoints.length === 0) {
            throw new Error(
              `Level9DescentPressureSystem: combat.spawnPoints vacío en evento "${event.id}" de segmento "${segment.id}".`
            );
          }
        }
      });
    });

    if (!segmentIds.has(config.finalSegmentId)) {
      throw new Error(`Level9DescentPressureSystem: finalSegmentId "${config.finalSegmentId}" no existe.`);
    }
  }
}
