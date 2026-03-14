import Phaser from 'phaser';

export type Level6AmbientEventType =
  | 'vapor-de-cocina'
  | 'alarmas-de-cocina'
  | 'ruido-de-utensilios'
  | 'luces-parpadeantes'
  | 'puertas-de-cocina-golpeandose';

export interface Level6AmbientEventRenderConfig {
  durationMs?: number;
  intensity?: number;
  tintColor?: number;
  textHint?: string;
}

export interface Level6AmbientEventConfig {
  type: Level6AmbientEventType;
  enabled?: boolean;
  cooldownMs?: number;
  render?: Level6AmbientEventRenderConfig;
}

export interface Level6AmbientTriggerConfig {
  id: string;
  kind: 'segment' | 'trigger';
  x: number;
  y: number;
  width: number;
  height: number;
  once?: boolean;
  events: Level6AmbientEventConfig[];
}

export interface Level6AmbientEventsConfig {
  triggers: Level6AmbientTriggerConfig[];
  overlayDepth?: number;
  corridorTopY: number;
  floorY: number;
  levelWidth: number;
  audioKeys?: Partial<Record<Level6AmbientEventType, string>>;
}

interface RuntimeTrigger {
  config: Required<Level6AmbientTriggerConfig>;
  zone: Phaser.GameObjects.Zone;
  activated: boolean;
}

const DEFAULT_RENDER: Required<Level6AmbientEventRenderConfig> = {
  durationMs: 1400,
  intensity: 0.75,
  tintColor: 0xe2e8f0,
  textHint: ''
};

const DEFAULT_EVENT_COOLDOWN_MS = 1800;

/**
 * Eventos ambientales para Nivel 6 (comedor/cocina).
 *
 * - Configurable desde JSON: triggers + eventos + render/audio por key.
 * - Sin depender de archivos binarios: todo feedback visual/textual es procedural.
 */
export class Level6AmbientEvents {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly config: Required<Level6AmbientEventsConfig>;
  private readonly runtimeTriggers: RuntimeTrigger[] = [];
  private readonly cooldownByEvent = new Map<Level6AmbientEventType, number>();

  constructor(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    config: Level6AmbientEventsConfig
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

      const resolvedTrigger: Required<Level6AmbientTriggerConfig> = {
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

  trigger(eventType: Level6AmbientEventType): boolean {
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

  private activateEvent(eventConfig: Level6AmbientEventConfig): void {
    const render = {
      ...DEFAULT_RENDER,
      ...eventConfig.render
    };

    if (this.isOnCooldown(eventConfig.type)) {
      return;
    }

    switch (eventConfig.type) {
      case 'vapor-de-cocina':
        this.runKitchenSteam(render);
        break;
      case 'alarmas-de-cocina':
        this.runKitchenAlarms(render);
        break;
      case 'ruido-de-utensilios':
        this.runUtensilNoise(render);
        break;
      case 'luces-parpadeantes':
        this.runFlickeringLights(render);
        break;
      case 'puertas-de-cocina-golpeandose':
        this.runKitchenDoorsSlamming(render);
        break;
      default: {
        const exhaustive: never = eventConfig.type;
        throw new Error(`Evento ambiental de Nivel 6 no soportado: ${String(exhaustive)}`);
      }
    }

    this.cooldownByEvent.set(
      eventConfig.type,
      this.scene.time.now + Math.max(100, eventConfig.cooldownMs ?? DEFAULT_EVENT_COOLDOWN_MS)
    );
  }

  private isOnCooldown(eventType: Level6AmbientEventType): boolean {
    return (this.cooldownByEvent.get(eventType) ?? 0) > this.scene.time.now;
  }

  private runKitchenSteam(render: Required<Level6AmbientEventRenderConfig>): void {
    this.playAudio('vapor-de-cocina', 0.26 * render.intensity, 90);

    const originX = Phaser.Math.Clamp(this.getLeadPlayerX(), 80, this.config.levelWidth - 80);
    const baseY = this.config.floorY - 46;

    const puffs = Array.from({ length: 6 }, (_, index) => {
      const xJitter = Phaser.Math.Between(-28, 28);
      const yJitter = Phaser.Math.Between(-10, 10);
      return this.scene.add.ellipse(originX + xJitter, baseY + yJitter + index * 2, 44, 24, render.tintColor, 0.22)
        .setDepth(this.config.overlayDepth + 0.35)
        .setAlpha(0.02);
    });

    this.scene.tweens.add({
      targets: puffs,
      alpha: { from: 0.05, to: 0.3 },
      y: '-=54',
      x: '+=12',
      scaleX: { from: 0.9, to: 1.35 },
      scaleY: { from: 0.9, to: 1.45 },
      duration: Math.max(360, Math.floor(render.durationMs * 0.85)),
      stagger: 70,
      onComplete: () => puffs.forEach((puff) => puff.destroy())
    });
  }

  private runKitchenAlarms(render: Required<Level6AmbientEventRenderConfig>): void {
    this.playAudio('alarmas-de-cocina', 0.35 * render.intensity, 140);

    const overlay = this.scene.add.rectangle(
      this.config.levelWidth * 0.5,
      (this.config.corridorTopY + this.config.floorY) * 0.5,
      this.config.levelWidth,
      this.config.floorY - this.config.corridorTopY,
      0xef4444,
      0.06 * render.intensity
    ).setDepth(this.config.overlayDepth + 0.2);

    this.scene.tweens.add({
      targets: overlay,
      alpha: { from: overlay.alpha, to: 0.01 },
      duration: Math.max(220, Math.floor(render.durationMs * 0.8)),
      repeat: 2,
      yoyo: true,
      onComplete: () => overlay.destroy()
    });
  }

  private runUtensilNoise(render: Required<Level6AmbientEventRenderConfig>): void {
    this.playAudio('ruido-de-utensilios', 0.3 * render.intensity, 120);

    const leadX = Phaser.Math.Clamp(this.getLeadPlayerX(), 100, this.config.levelWidth - 100);
    const y = this.config.floorY - 58;

    const left = this.scene.add.rectangle(leadX - 34, y, 28, 4, 0x94a3b8, 0.95)
      .setDepth(this.config.overlayDepth + 0.4)
      .setAngle(-14);
    const right = this.scene.add.rectangle(leadX + 34, y + 4, 24, 4, 0xcbd5e1, 0.95)
      .setDepth(this.config.overlayDepth + 0.4)
      .setAngle(18);

    this.spawnFloatingText(
      render.textHint || '¡Clang! Los utensilios chocan en la cocina...',
      '#e2e8f0',
      '#1e293b',
      Math.floor(render.durationMs * 0.8)
    );

    this.scene.tweens.add({
      targets: [left, right],
      x: {
        from: (target: Phaser.GameObjects.Rectangle) => target.x,
        to: (target: Phaser.GameObjects.Rectangle) => target.x + (target === left ? 10 : -10)
      },
      y: '-=4',
      alpha: { from: 0.95, to: 0.2 },
      duration: Math.max(220, Math.floor(render.durationMs * 0.4)),
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        left.destroy();
        right.destroy();
      }
    });
  }

  private runFlickeringLights(render: Required<Level6AmbientEventRenderConfig>): void {
    const x = Phaser.Math.Between(90, this.config.levelWidth - 90);
    const y = this.config.corridorTopY + 26;

    const fixture = this.scene.add.rectangle(x, y, 128, 14, 0xf8fafc, 0.84)
      .setDepth(this.config.overlayDepth);
    const halo = this.scene.add.ellipse(x, y + 34, 196, 46, render.tintColor, 0.14 * render.intensity)
      .setDepth(this.config.overlayDepth - 0.1);

    this.scene.tweens.add({
      targets: [fixture, halo],
      alpha: { from: 0.95, to: 0.16 },
      duration: Math.max(85, Math.floor(render.durationMs / 9)),
      yoyo: true,
      repeat: 7,
      onComplete: () => {
        fixture.destroy();
        halo.destroy();
      }
    });
  }

  private runKitchenDoorsSlamming(render: Required<Level6AmbientEventRenderConfig>): void {
    this.playAudio('puertas-de-cocina-golpeandose', 0.28 * render.intensity, 90);

    const centerX = Phaser.Math.Clamp(this.getLeadPlayerX(), 120, this.config.levelWidth - 120);
    const y = this.config.floorY - 82;

    const leftDoor = this.scene.add.rectangle(centerX - 72, y, 54, 146, 0x475569, 0.92)
      .setDepth(this.config.overlayDepth + 0.3)
      .setStrokeStyle(2, 0x0f172a, 0.5);
    const rightDoor = this.scene.add.rectangle(centerX + 72, y, 54, 146, 0x475569, 0.92)
      .setDepth(this.config.overlayDepth + 0.3)
      .setStrokeStyle(2, 0x0f172a, 0.5);

    this.scene.tweens.add({
      targets: [leftDoor, rightDoor],
      x: {
        from: (target: Phaser.GameObjects.Rectangle) => target.x,
        to: (target: Phaser.GameObjects.Rectangle) => target.x + (target === leftDoor ? 18 : -18)
      },
      duration: Math.max(160, Math.floor(render.durationMs * 0.42)),
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        leftDoor.destroy();
        rightDoor.destroy();
      }
    });
  }

  private playAudio(eventType: Level6AmbientEventType, volume: number, detuneRange: number): void {
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
    const label = this.scene.add.text(this.getLeadPlayerX(), this.config.corridorTopY + 52, text, {
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
      hold: Math.max(240, Math.floor(durationMs * 0.4)),
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
