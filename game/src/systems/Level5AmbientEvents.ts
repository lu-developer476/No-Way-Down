import Phaser from 'phaser';

export type Level5AmbientEventType =
  | 'luces-parpadeantes'
  | 'sonidos-hall-central'
  | 'pasos-pisos-inferiores'
  | 'alarmas-internas'
  | 'puertas-golpeandose';

export interface Level5AmbientEventRenderConfig {
  durationMs?: number;
  intensity?: number;
  tintColor?: number;
  textHint?: string;
}

export interface Level5AmbientEventConfig {
  type: Level5AmbientEventType;
  enabled?: boolean;
  cooldownMs?: number;
  render?: Level5AmbientEventRenderConfig;
}

export interface Level5AmbientTriggerConfig {
  id: string;
  kind: 'segment' | 'trigger';
  x: number;
  y: number;
  width: number;
  height: number;
  once?: boolean;
  events: Level5AmbientEventConfig[];
}

export interface Level5AmbientEventsConfig {
  triggers: Level5AmbientTriggerConfig[];
  overlayDepth?: number;
  corridorTopY: number;
  floorY: number;
  levelWidth: number;
  audioKeys?: Partial<Record<Level5AmbientEventType, string>>;
}

interface RuntimeTrigger {
  config: Required<Level5AmbientTriggerConfig>;
  zone: Phaser.GameObjects.Zone;
  activated: boolean;
}

const DEFAULT_RENDER: Required<Level5AmbientEventRenderConfig> = {
  durationMs: 1300,
  intensity: 0.75,
  tintColor: 0xbfdbfe,
  textHint: ''
};

const DEFAULT_EVENT_COOLDOWN_MS = 1700;

/**
 * Eventos ambientales para Nivel 5 (tercer piso).
 *
 * Objetivos:
 * - Configurables 100% desde JSON (triggers + eventos + parámetros de render).
 * - Sin archivos binarios: los efectos usan primitives/texto y audio opcional por key.
 */
export class Level5AmbientEvents {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly config: Required<Level5AmbientEventsConfig>;
  private readonly runtimeTriggers: RuntimeTrigger[] = [];
  private readonly cooldownByEvent = new Map<Level5AmbientEventType, number>();

  constructor(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    config: Level5AmbientEventsConfig
  ) {
    this.scene = scene;
    this.players = players;
    this.config = {
      triggers: config.triggers,
      overlayDepth: config.overlayDepth ?? 8.5,
      corridorTopY: config.corridorTopY,
      floorY: config.floorY,
      levelWidth: config.levelWidth,
      audioKeys: config.audioKeys ?? {}
    };
  }

  register(): void {
    this.destroy();

    this.config.triggers.forEach((rawTrigger) => {
      if (!rawTrigger.events.some((event) => event.enabled ?? true)) {
        return;
      }

      const resolvedTrigger: Required<Level5AmbientTriggerConfig> = {
        ...rawTrigger,
        once: rawTrigger.once ?? true
      };

      const zone = this.scene.add.zone(
        resolvedTrigger.x,
        resolvedTrigger.y,
        Math.max(10, resolvedTrigger.width),
        Math.max(10, resolvedTrigger.height)
      );

      this.scene.physics.add.existing(zone, true);

      const runtime: RuntimeTrigger = {
        config: resolvedTrigger,
        zone,
        activated: false
      };

      this.runtimeTriggers.push(runtime);
      this.bindTrigger(runtime);
    });
  }

  destroy(): void {
    this.runtimeTriggers.forEach((runtime) => runtime.zone.destroy());
    this.runtimeTriggers.length = 0;
    this.cooldownByEvent.clear();
  }

  trigger(eventType: Level5AmbientEventType): boolean {
    if (this.isOnCooldown(eventType)) {
      return false;
    }

    this.activateEvent({ type: eventType });
    return true;
  }

  private bindTrigger(runtime: RuntimeTrigger): void {
    this.players.forEach((player) => {
      this.scene.physics.add.overlap(player, runtime.zone, () => this.activateTrigger(runtime));
    });
  }

  private activateTrigger(runtime: RuntimeTrigger): void {
    if (runtime.activated && runtime.config.once) {
      return;
    }

    runtime.activated = true;

    if (runtime.config.once) {
      const body = runtime.zone.body as Phaser.Physics.Arcade.StaticBody;
      body.enable = false;
      runtime.zone.setActive(false).setVisible(false);
    }

    runtime.config.events
      .filter((entry) => entry.enabled ?? true)
      .forEach((eventConfig) => this.activateEvent(eventConfig));
  }

  private activateEvent(eventConfig: Level5AmbientEventConfig): void {
    const render = {
      ...DEFAULT_RENDER,
      ...eventConfig.render
    };

    if (this.isOnCooldown(eventConfig.type)) {
      return;
    }

    switch (eventConfig.type) {
      case 'luces-parpadeantes':
        this.runFlickeringLights(render);
        break;
      case 'sonidos-hall-central':
        this.runCentralHallSound(render);
        break;
      case 'pasos-pisos-inferiores':
        this.runLowerFloorSteps(render);
        break;
      case 'alarmas-internas':
        this.runInternalAlarms(render);
        break;
      case 'puertas-golpeandose':
        this.runSlammingDoors(render);
        break;
      default: {
        const exhaustive: never = eventConfig.type;
        throw new Error(`Evento ambiental de Nivel 5 no soportado: ${String(exhaustive)}`);
      }
    }

    this.cooldownByEvent.set(
      eventConfig.type,
      this.scene.time.now + Math.max(100, eventConfig.cooldownMs ?? DEFAULT_EVENT_COOLDOWN_MS)
    );
  }

  private isOnCooldown(eventType: Level5AmbientEventType): boolean {
    return (this.cooldownByEvent.get(eventType) ?? 0) > this.scene.time.now;
  }

  private runFlickeringLights(render: Required<Level5AmbientEventRenderConfig>): void {
    const x = Phaser.Math.Between(80, this.config.levelWidth - 80);
    const y = this.config.corridorTopY + 28;

    const tube = this.scene.add.rectangle(x, y, 126, 14, 0xf8fafc, 0.84)
      .setDepth(this.config.overlayDepth);
    const halo = this.scene.add.ellipse(x, y + 32, 196, 48, render.tintColor, 0.12 * render.intensity)
      .setDepth(this.config.overlayDepth - 0.1);

    this.scene.tweens.add({
      targets: [tube, halo],
      alpha: { from: 0.96, to: 0.15 },
      duration: Math.max(80, Math.floor(render.durationMs / 8)),
      yoyo: true,
      repeat: 7,
      onComplete: () => {
        tube.destroy();
        halo.destroy();
      }
    });
  }

  private runCentralHallSound(render: Required<Level5AmbientEventRenderConfig>): void {
    this.playAudio('sonidos-hall-central', 0.28 * render.intensity, 90);
    this.spawnFloatingText(
      render.textHint || 'Resuenan sonidos del hall central...',
      '#bfdbfe',
      '#0f172a',
      render.durationMs
    );
  }

  private runLowerFloorSteps(render: Required<Level5AmbientEventRenderConfig>): void {
    this.playAudio('pasos-pisos-inferiores', 0.26 * render.intensity, 110);

    const baseY = this.config.floorY - 8;
    const startX = this.getLeadPlayerX() - 54;
    const stepMarks = Array.from({ length: 4 }, (_, index) => {
      return this.scene.add.ellipse(startX + index * 34, baseY + ((index + 1) % 2) * 6, 14, 8, 0x334155, 0.5)
        .setDepth(this.config.overlayDepth + 0.2);
    });

    this.scene.tweens.add({
      targets: stepMarks,
      alpha: { from: 0.65, to: 0.05 },
      x: '+=12',
      duration: Math.max(240, Math.floor(render.durationMs * 0.72)),
      stagger: 85,
      onComplete: () => stepMarks.forEach((mark) => mark.destroy())
    });
  }

  private runInternalAlarms(render: Required<Level5AmbientEventRenderConfig>): void {
    this.playAudio('alarmas-internas', 0.34 * render.intensity, 140);

    const overlay = this.scene.add.rectangle(
      this.config.levelWidth * 0.5,
      (this.config.corridorTopY + this.config.floorY) * 0.5,
      this.config.levelWidth,
      this.config.floorY - this.config.corridorTopY,
      0xdc2626,
      0.06 * render.intensity
    ).setDepth(this.config.overlayDepth + 0.3);

    this.scene.tweens.add({
      targets: overlay,
      alpha: { from: overlay.alpha, to: 0.02 },
      duration: Math.max(220, Math.floor(render.durationMs * 0.9)),
      repeat: 2,
      yoyo: true,
      onComplete: () => overlay.destroy()
    });
  }

  private runSlammingDoors(render: Required<Level5AmbientEventRenderConfig>): void {
    this.playAudio('puertas-golpeandose', 0.3 * render.intensity, 100);

    const centerX = Phaser.Math.Clamp(this.getLeadPlayerX(), 110, this.config.levelWidth - 110);
    const y = this.config.floorY - 76;

    const leftDoor = this.scene.add.rectangle(centerX - 70, y, 52, 150, 0x475569, 0.92)
      .setDepth(this.config.overlayDepth + 0.3)
      .setStrokeStyle(2, 0x0f172a, 0.45);
    const rightDoor = this.scene.add.rectangle(centerX + 70, y, 52, 150, 0x475569, 0.92)
      .setDepth(this.config.overlayDepth + 0.3)
      .setStrokeStyle(2, 0x0f172a, 0.45);

    this.scene.tweens.add({
      targets: [leftDoor, rightDoor],
      x: {
        from: (target: Phaser.GameObjects.Rectangle) => target.x,
        to: (target: Phaser.GameObjects.Rectangle) => target.x + (target === leftDoor ? 16 : -16)
      },
      duration: Math.max(160, Math.floor(render.durationMs * 0.45)),
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        leftDoor.destroy();
        rightDoor.destroy();
      }
    });
  }

  private playAudio(eventType: Level5AmbientEventType, volume: number, detuneRange: number): void {
    const key = this.config.audioKeys[eventType];
    if (!key || (!this.scene.cache.audio.has(key) && !this.scene.sound.get(key))) {
      return;
    }

    this.scene.sound.play(key, {
      volume,
      detune: Phaser.Math.Between(-detuneRange, detuneRange)
    });
  }

  private spawnFloatingText(text: string, color: string, background: string, durationMs: number): void {
    const label = this.scene.add.text(this.getLeadPlayerX(), this.config.corridorTopY + 50, text, {
      fontSize: '16px',
      color,
      backgroundColor: background,
      padding: { x: 8, y: 5 }
    })
      .setOrigin(0.5)
      .setDepth(this.config.overlayDepth + 1)
      .setAlpha(0);

    this.scene.tweens.add({
      targets: label,
      alpha: { from: 0, to: 0.95 },
      y: label.y - 12,
      duration: Math.max(200, Math.floor(durationMs * 0.25)),
      yoyo: true,
      hold: Math.max(260, Math.floor(durationMs * 0.4)),
      onComplete: () => label.destroy()
    });
  }

  private getLeadPlayerX(): number {
    if (this.players.length === 0) {
      return this.config.levelWidth * 0.5;
    }

    const total = this.players.reduce((acc, player) => acc + (player as Phaser.GameObjects.GameObject & { x: number }).x, 0);
    return total / this.players.length;
  }
}
