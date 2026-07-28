import Phaser from 'phaser';

export type HallAmbientEventType =
  | 'luces-parpadeantes'
  | 'alarma-edificio'
  | 'puertas-cerrandose'
  | 'pantallas-rotas';

export interface HallAmbientEventConfig {
  type: HallAmbientEventType;
  enabled?: boolean;
  weight?: number;
  minIntervalMs?: number;
  maxIntervalMs?: number;
  durationMs?: number;
}

export interface HallAmbientEventsSystemConfig {
  hallBounds: {
    startX: number;
    endX: number;
    topY: number;
    floorY: number;
  };
  events: HallAmbientEventConfig[];
  overlayDepth?: number;
  autoStart?: boolean;
  alarmSoundKey?: string;
}

type EventHandler = (eventConfig: Required<HallAmbientEventConfig>) => void;

const DEFAULT_EVENT_CONFIG: Omit<Required<HallAmbientEventConfig>, 'type'> = {
  enabled: true,
  weight: 1,
  minIntervalMs: 4000,
  maxIntervalMs: 9000,
  durationMs: 1200
};

/**
 * Sistema configurable de eventos ambientales para el hall.
 *
 * Eventos soportados:
 * - luces-parpadeantes
 * - alarma-edificio
 * - puertas-cerrandose
 * - pantallas-rotas
 */
export class HallAmbientEvents {
  private readonly scene: Phaser.Scene;
  private readonly config: Required<HallAmbientEventsSystemConfig>;
  private readonly handlers: Record<HallAmbientEventType, EventHandler>;
  private readonly spawnedObjects: Phaser.GameObjects.GameObject[] = [];

  private timer?: Phaser.Time.TimerEvent;
  private started = false;

  constructor(scene: Phaser.Scene, config: HallAmbientEventsSystemConfig) {
    this.scene = scene;
    this.config = {
      hallBounds: config.hallBounds,
      events: config.events,
      overlayDepth: config.overlayDepth ?? 9,
      autoStart: config.autoStart ?? true,
      alarmSoundKey: config.alarmSoundKey ?? 'hall-building-alarm'
    };

    this.handlers = {
      'luces-parpadeantes': (eventConfig) => this.runFlickeringLights(eventConfig),
      'alarma-edificio': (eventConfig) => this.runBuildingAlarm(eventConfig),
      'puertas-cerrandose': (eventConfig) => this.runClosingDoors(eventConfig),
      'pantallas-rotas': (eventConfig) => this.runBrokenScreens(eventConfig)
    };

    if (this.config.autoStart) {
      this.start();
    }
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.scheduleNextEvent();
  }

  stop(): void {
    this.started = false;
    this.timer?.remove(false);
    this.timer = undefined;
  }

  destroy(): void {
    this.stop();
    this.spawnedObjects.forEach((entry) => entry.destroy());
    this.spawnedObjects.length = 0;
  }

  trigger(eventType: HallAmbientEventType): boolean {
    const eventConfig = this.getEventConfig(eventType);
    if (!eventConfig?.enabled) {
      return false;
    }

    this.handlers[eventType](eventConfig);
    return true;
  }

  private scheduleNextEvent(): void {
    if (!this.started) {
      return;
    }

    const nextEvent = this.pickWeightedEvent();
    if (!nextEvent) {
      return;
    }

    const minDelay = Math.max(100, nextEvent.minIntervalMs);
    const maxDelay = Math.max(minDelay, nextEvent.maxIntervalMs);
    const delay = Phaser.Math.Between(minDelay, maxDelay);

    this.timer = this.scene.time.delayedCall(delay, () => {
      if (!this.started) {
        return;
      }

      this.handlers[nextEvent.type](nextEvent);
      this.scheduleNextEvent();
    });
  }

  private pickWeightedEvent(): Required<HallAmbientEventConfig> | undefined {
    const enabledEvents = this.config.events
      .map((entry) => this.withDefaults(entry))
      .filter((entry) => entry.enabled && entry.weight > 0);

    if (enabledEvents.length === 0) {
      return undefined;
    }

    const totalWeight = enabledEvents.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const eventConfig of enabledEvents) {
      roll -= eventConfig.weight;
      if (roll <= 0) {
        return eventConfig;
      }
    }

    return enabledEvents[enabledEvents.length - 1];
  }

  private getEventConfig(type: HallAmbientEventType): Required<HallAmbientEventConfig> | undefined {
    const config = this.config.events.find((entry) => entry.type === type);
    return config ? this.withDefaults(config) : undefined;
  }

  private withDefaults(config: HallAmbientEventConfig): Required<HallAmbientEventConfig> {
    return {
      type: config.type,
      enabled: config.enabled ?? DEFAULT_EVENT_CONFIG.enabled,
      weight: config.weight ?? DEFAULT_EVENT_CONFIG.weight,
      minIntervalMs: config.minIntervalMs ?? DEFAULT_EVENT_CONFIG.minIntervalMs,
      maxIntervalMs: config.maxIntervalMs ?? DEFAULT_EVENT_CONFIG.maxIntervalMs,
      durationMs: config.durationMs ?? DEFAULT_EVENT_CONFIG.durationMs
    };
  }

  private runFlickeringLights(eventConfig: Required<HallAmbientEventConfig>): void {
    const x = Phaser.Math.Between(this.config.hallBounds.startX + 40, this.config.hallBounds.endX - 40);
    const y = this.config.hallBounds.topY + 24;

    const light = this.scene.add.rectangle(x, y, 120, 16, 0xf8fafc, 0.8)
      .setDepth(this.config.overlayDepth);

    const halo = this.scene.add.ellipse(x, y + 34, 180, 42, 0xbfdbfe, 0.14)
      .setDepth(this.config.overlayDepth - 0.1);

    this.spawnedObjects.push(light, halo);

    this.scene.tweens.add({
      targets: [light, halo],
      alpha: { from: 0.9, to: 0.25 },
      duration: Math.max(60, Math.floor(eventConfig.durationMs / 8)),
      yoyo: true,
      repeat: 7,
      onComplete: () => {
        light.destroy();
        halo.destroy();
      }
    });
  }

  private runBuildingAlarm(eventConfig: Required<HallAmbientEventConfig>): void {
    if (this.scene.cache.audio.has(this.config.alarmSoundKey)) {
      this.scene.sound.play(this.config.alarmSoundKey, {
        volume: 0.35,
        detune: Phaser.Math.Between(-40, 40)
      });
    }

    const alarmOverlay = this.scene.add.rectangle(
      (this.config.hallBounds.startX + this.config.hallBounds.endX) * 0.5,
      (this.config.hallBounds.topY + this.config.hallBounds.floorY) * 0.5,
      this.config.hallBounds.endX - this.config.hallBounds.startX,
      this.config.hallBounds.floorY - this.config.hallBounds.topY,
      0xef4444,
      0.08
    )
      .setDepth(this.config.overlayDepth + 0.2);

    this.spawnedObjects.push(alarmOverlay);

    this.scene.tweens.add({
      targets: alarmOverlay,
      alpha: { from: 0.16, to: 0.02 },
      duration: Math.max(250, eventConfig.durationMs),
      repeat: 3,
      yoyo: true,
      onComplete: () => alarmOverlay.destroy()
    });
  }

  private runClosingDoors(eventConfig: Required<HallAmbientEventConfig>): void {
    const y = this.config.hallBounds.floorY - 80;
    const leftDoor = this.scene.add.rectangle(this.config.hallBounds.startX - 20, y, 70, 160, 0x475569, 0.9)
      .setOrigin(1, 0.5)
      .setDepth(this.config.overlayDepth + 0.3)
      .setStrokeStyle(2, 0x1f2937, 0.5);

    const rightDoor = this.scene.add.rectangle(this.config.hallBounds.endX + 20, y, 70, 160, 0x475569, 0.9)
      .setOrigin(0, 0.5)
      .setDepth(this.config.overlayDepth + 0.3)
      .setStrokeStyle(2, 0x1f2937, 0.5);

    this.spawnedObjects.push(leftDoor, rightDoor);

    this.scene.tweens.add({
      targets: leftDoor,
      x: this.config.hallBounds.startX + 80,
      duration: Math.max(240, Math.floor(eventConfig.durationMs * 0.8)),
      yoyo: true
    });

    this.scene.tweens.add({
      targets: rightDoor,
      x: this.config.hallBounds.endX - 80,
      duration: Math.max(240, Math.floor(eventConfig.durationMs * 0.8)),
      yoyo: true,
      onComplete: () => {
        leftDoor.destroy();
        rightDoor.destroy();
      }
    });
  }

  private runBrokenScreens(eventConfig: Required<HallAmbientEventConfig>): void {
    const x = Phaser.Math.Between(this.config.hallBounds.startX + 120, this.config.hallBounds.endX - 120);
    const y = this.config.hallBounds.floorY - 88;

    const frame = this.scene.add.rectangle(x, y, 70, 100, 0x111827, 0.95)
      .setDepth(this.config.overlayDepth + 0.1)
      .setStrokeStyle(2, 0x6b7280, 0.45);

    const glass = this.scene.add.rectangle(x, y - 8, 54, 66, 0x93c5fd, 0.22)
      .setDepth(this.config.overlayDepth + 0.15);

    const crack1 = this.scene.add.line(x, y - 10, -18, -22, 14, 6, 0xe2e8f0, 0.8)
      .setLineWidth(2, 2)
      .setDepth(this.config.overlayDepth + 0.2);

    const crack2 = this.scene.add.line(x, y - 12, -4, -14, 18, -30, 0xe2e8f0, 0.78)
      .setLineWidth(2, 2)
      .setDepth(this.config.overlayDepth + 0.2);

    this.spawnedObjects.push(frame, glass, crack1, crack2);

    this.scene.tweens.add({
      targets: [frame, glass, crack1, crack2],
      alpha: { from: 1, to: 0.35 },
      duration: Math.max(320, eventConfig.durationMs),
      yoyo: true,
      onComplete: () => {
        frame.destroy();
        glass.destroy();
        crack1.destroy();
        crack2.destroy();
      }
    });
  }
}
