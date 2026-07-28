import Phaser from 'phaser';

export type Level4AmbientEventType =
  | 'luces-parpadeantes'
  | 'eco-edificio'
  | 'alarma-lejana'
  | 'puertas-trabadas'
  | 'multitudes-caos-exterior'
  | 'tension-cerca-salida';

export interface Level4EventRenderConfig {
  durationMs?: number;
  intensity?: number;
  tintColor?: number;
  textHint?: string;
}

export interface Level4AmbientEventConfig {
  type: Level4AmbientEventType;
  enabled?: boolean;
  cooldownMs?: number;
  render?: Level4EventRenderConfig;
}

export interface Level4AmbientTriggerConfig {
  id: string;
  kind: 'segment' | 'trigger';
  x: number;
  y: number;
  width: number;
  height: number;
  once?: boolean;
  events: Level4AmbientEventConfig[];
}

export interface Level4AmbientEventsConfig {
  triggers: Level4AmbientTriggerConfig[];
  overlayDepth?: number;
  corridorTopY: number;
  floorY: number;
  levelWidth: number;
  nearExitThresholdX?: number;
  audioKeys?: Partial<Record<Level4AmbientEventType, string>>;
}

interface RuntimeTrigger {
  config: Required<Level4AmbientTriggerConfig>;
  zone: Phaser.GameObjects.Zone;
  activated: boolean;
}

const DEFAULT_RENDER: Required<Level4EventRenderConfig> = {
  durationMs: 1400,
  intensity: 0.75,
  tintColor: 0x93c5fd,
  textHint: ''
};

const DEFAULT_EVENT_COOLDOWN_MS = 1800;

/**
 * Sistema de ambientación para el Nivel 4.
 *
 * - Los eventos se activan por segmentos o triggers (zonas rectangulares).
 * - Son 100% configurables por JSON.
 * - No bloquean gameplay: no causan daño, no crean colisiones jugables y son efímeros.
 */
export class Level4AmbientEvents {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly config: Required<Level4AmbientEventsConfig>;
  private readonly runtimeTriggers: RuntimeTrigger[] = [];
  private readonly cooldownByEvent = new Map<Level4AmbientEventType, number>();

  constructor(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    config: Level4AmbientEventsConfig
  ) {
    this.scene = scene;
    this.players = players;
    this.config = {
      triggers: config.triggers,
      overlayDepth: config.overlayDepth ?? 8.5,
      corridorTopY: config.corridorTopY,
      floorY: config.floorY,
      levelWidth: config.levelWidth,
      nearExitThresholdX: config.nearExitThresholdX ?? Math.max(180, config.levelWidth * 0.14),
      audioKeys: config.audioKeys ?? {}
    };
  }

  register(): void {
    this.destroy();

    this.config.triggers.forEach((rawTrigger) => {
      if (!rawTrigger.events.some((entry) => entry.enabled ?? true)) {
        return;
      }

      const resolvedTrigger: Required<Level4AmbientTriggerConfig> = {
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

  trigger(eventType: Level4AmbientEventType): boolean {
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

  private activateEvent(eventConfig: Level4AmbientEventConfig): void {
    const mergedRender = {
      ...DEFAULT_RENDER,
      ...eventConfig.render
    };

    if (this.isOnCooldown(eventConfig.type)) {
      return;
    }

    switch (eventConfig.type) {
      case 'luces-parpadeantes':
        this.runFlickeringLights(mergedRender);
        break;
      case 'eco-edificio':
        this.runEchoNoise(mergedRender);
        break;
      case 'alarma-lejana':
        this.runDistantAlarm(mergedRender);
        break;
      case 'puertas-trabadas':
        this.runLockedDoors(mergedRender);
        break;
      case 'multitudes-caos-exterior':
        this.runCrowdChaos(mergedRender);
        break;
      case 'tension-cerca-salida':
        this.runExitTension(mergedRender);
        break;
      default: {
        const exhaustive: never = eventConfig.type;
        throw new Error(`Evento ambiental de Nivel 4 no soportado: ${String(exhaustive)}`);
      }
    }

    this.cooldownByEvent.set(
      eventConfig.type,
      this.scene.time.now + Math.max(100, eventConfig.cooldownMs ?? DEFAULT_EVENT_COOLDOWN_MS)
    );
  }

  private isOnCooldown(eventType: Level4AmbientEventType): boolean {
    return (this.cooldownByEvent.get(eventType) ?? 0) > this.scene.time.now;
  }

  private runFlickeringLights(render: Required<Level4EventRenderConfig>): void {
    const x = Phaser.Math.Between(80, this.config.levelWidth - 80);
    const y = this.config.corridorTopY + 24;

    const light = this.scene.add.rectangle(x, y, 120, 16, 0xf8fafc, 0.8).setDepth(this.config.overlayDepth);
    const glow = this.scene.add.ellipse(x, y + 34, 180, 44, render.tintColor, 0.14 * render.intensity)
      .setDepth(this.config.overlayDepth - 0.1);

    this.scene.tweens.add({
      targets: [light, glow],
      alpha: { from: 0.95, to: 0.18 },
      duration: Math.max(90, Math.floor(render.durationMs / 8)),
      yoyo: true,
      repeat: 7,
      onComplete: () => {
        light.destroy();
        glow.destroy();
      }
    });
  }

  private runEchoNoise(render: Required<Level4EventRenderConfig>): void {
    this.playAudio('eco-edificio', 0.24 * render.intensity, 80);
    this.spawnFloatingText(render.textHint || 'Eco metálico en los pasillos...', '#cbd5e1', '#0f172a', render.durationMs);
  }

  private runDistantAlarm(render: Required<Level4EventRenderConfig>): void {
    this.playAudio('alarma-lejana', 0.3 * render.intensity, 140);

    const overlay = this.scene.add.rectangle(
      this.config.levelWidth * 0.5,
      (this.config.corridorTopY + this.config.floorY) * 0.5,
      this.config.levelWidth,
      this.config.floorY - this.config.corridorTopY,
      0xef4444,
      0.07 * render.intensity
    ).setDepth(this.config.overlayDepth + 0.2);

    this.scene.tweens.add({
      targets: overlay,
      alpha: { from: overlay.alpha, to: 0.01 },
      duration: Math.max(260, render.durationMs),
      repeat: 2,
      yoyo: true,
      onComplete: () => overlay.destroy()
    });
  }

  private runLockedDoors(render: Required<Level4EventRenderConfig>): void {
    const y = this.config.floorY - 78;
    const nearPlayerX = this.getLeadPlayerX();

    const leftDoor = this.scene.add.rectangle(nearPlayerX - 74, y, 56, 154, 0x475569, 0.9)
      .setDepth(this.config.overlayDepth + 0.3)
      .setStrokeStyle(2, 0x1e293b, 0.5);
    const rightDoor = this.scene.add.rectangle(nearPlayerX + 74, y, 56, 154, 0x475569, 0.9)
      .setDepth(this.config.overlayDepth + 0.3)
      .setStrokeStyle(2, 0x1e293b, 0.5);

    this.playAudio('puertas-trabadas', 0.25 * render.intensity, 120);

    this.scene.tweens.add({
      targets: [leftDoor, rightDoor],
      x: { from: (target: Phaser.GameObjects.Rectangle) => target.x, to: (target: Phaser.GameObjects.Rectangle) => target.x + (target === leftDoor ? 12 : -12) },
      yoyo: true,
      duration: Math.max(180, Math.floor(render.durationMs * 0.45)),
      repeat: 2,
      onComplete: () => {
        leftDoor.destroy();
        rightDoor.destroy();
      }
    });
  }

  private runCrowdChaos(render: Required<Level4EventRenderConfig>): void {
    this.playAudio('multitudes-caos-exterior', 0.32 * render.intensity, 180);
    this.spawnFloatingText(render.textHint || 'Gritos y caos afuera del edificio...', '#fde68a', '#1f2937', render.durationMs);
  }

  private runExitTension(render: Required<Level4EventRenderConfig>): void {
    const leadPlayerX = this.getLeadPlayerX();
    const distanceToExit = Math.max(0, this.config.levelWidth - leadPlayerX);

    if (distanceToExit > this.config.nearExitThresholdX) {
      return;
    }

    const proximityFactor = 1 - distanceToExit / this.config.nearExitThresholdX;
    const intensity = Phaser.Math.Clamp(render.intensity + proximityFactor * 0.5, 0, 1.4);

    this.playAudio('tension-cerca-salida', 0.26 * intensity, 90);

    const vignette = this.scene.add.rectangle(
      this.config.levelWidth * 0.5,
      (this.config.corridorTopY + this.config.floorY) * 0.5,
      this.config.levelWidth,
      this.config.floorY - this.config.corridorTopY,
      0x7f1d1d,
      0.04 + 0.09 * proximityFactor
    ).setDepth(this.config.overlayDepth + 0.25);

    this.scene.tweens.add({
      targets: vignette,
      alpha: { from: vignette.alpha, to: 0.01 },
      duration: Math.max(280, Math.floor(render.durationMs * 0.8)),
      yoyo: true,
      repeat: 1,
      onComplete: () => vignette.destroy()
    });
  }

  private playAudio(eventType: Level4AmbientEventType, volume: number, detuneRange: number): void {
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
    const label = this.scene.add.text(this.getLeadPlayerX(), this.config.corridorTopY + 48, text, {
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
      duration: Math.max(220, Math.floor(durationMs * 0.25)),
      yoyo: true,
      hold: Math.max(260, Math.floor(durationMs * 0.35)),
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
