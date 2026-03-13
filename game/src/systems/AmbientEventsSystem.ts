import Phaser from 'phaser';

export type AmbientEventType =
  | 'luz_parpadeante'
  | 'sonido_lejano_zombies'
  | 'objetos_volcados'
  | 'pantalla_rota'
  | 'manchas_en_el_piso';

export interface AmbientSegment {
  index: number;
  startX: number;
  endX: number;
}

export interface AmbientSegmentEventConfig {
  segmentIndex: number;
  events: AmbientEventType[];
  once?: boolean;
}

export interface AmbientEventsSystemConfig {
  corridorTopY: number;
  floorY: number;
  layerDepth?: number;
  zombieAmbientSoundKey?: string;
}

interface SegmentRuntime {
  zone: Phaser.GameObjects.Zone;
  config: AmbientSegmentEventConfig;
  activated: boolean;
}

/**
 * Sistema de ambientación para eventos no jugables del pasillo del subsuelo.
 *
 * Características:
 * - Activa eventos al entrar en segmentos específicos.
 * - No crea colisiones ni altera daño, IA o bloqueo de camino.
 * - Permite combinar varios eventos por segmento.
 */
export class AmbientEventsSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly config: Required<AmbientEventsSystemConfig>;
  private readonly runtimeSegments: SegmentRuntime[] = [];
  private readonly renderObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    config: AmbientEventsSystemConfig
  ) {
    this.scene = scene;
    this.players = players;
    this.config = {
      corridorTopY: config.corridorTopY,
      floorY: config.floorY,
      layerDepth: config.layerDepth ?? 3.2,
      zombieAmbientSoundKey: config.zombieAmbientSoundKey ?? 'ambient-zombie-distant'
    };
  }

  registerSegmentEvents(segments: AmbientSegment[], segmentEvents: AmbientSegmentEventConfig[]): void {
    this.clear();

    const segmentsByIndex = new Map<number, AmbientSegment>(
      segments.map((segment) => [segment.index, segment])
    );

    segmentEvents.forEach((segmentEvent) => {
      const segment = segmentsByIndex.get(segmentEvent.segmentIndex);
      if (!segment) {
        return;
      }

      const segmentWidth = Math.max(8, segment.endX - segment.startX);
      const zone = this.scene.add.zone(
        segment.startX + segmentWidth * 0.5,
        (this.config.corridorTopY + this.config.floorY) * 0.5,
        segmentWidth,
        this.config.floorY - this.config.corridorTopY
      );

      this.scene.physics.add.existing(zone, true);

      const runtime: SegmentRuntime = {
        zone,
        config: {
          ...segmentEvent,
          once: segmentEvent.once ?? true
        },
        activated: false
      };

      this.runtimeSegments.push(runtime);
      this.bindOverlap(runtime);
    });
  }

  clear(): void {
    this.runtimeSegments.forEach((runtime) => runtime.zone.destroy());
    this.runtimeSegments.length = 0;

    this.renderObjects.forEach((entry) => entry.destroy());
    this.renderObjects.length = 0;
  }

  private bindOverlap(runtime: SegmentRuntime): void {
    this.players.forEach((player) => {
      this.scene.physics.add.overlap(player, runtime.zone, () => {
        this.activateSegment(runtime);
      });
    });
  }

  private activateSegment(runtime: SegmentRuntime): void {
    if (runtime.activated && runtime.config.once) {
      return;
    }

    runtime.activated = true;

    const body = runtime.zone.body as Phaser.Physics.Arcade.StaticBody;
    if (runtime.config.once) {
      body.enable = false;
      runtime.zone.setActive(false).setVisible(false);
    }

    const centerX = runtime.zone.x;

    runtime.config.events.forEach((eventType, eventIndex) => {
      switch (eventType) {
        case 'luz_parpadeante':
          this.triggerFlickeringLight(centerX, eventIndex);
          break;
        case 'sonido_lejano_zombies':
          this.triggerDistantZombieSound(centerX);
          break;
        case 'objetos_volcados':
          this.spawnTippedObjects(centerX, eventIndex);
          break;
        case 'pantalla_rota':
          this.spawnBrokenScreen(centerX, eventIndex);
          break;
        case 'manchas_en_el_piso':
          this.spawnFloorStains(centerX, eventIndex);
          break;
        default: {
          const exhaustiveCheck: never = eventType;
          throw new Error(`Evento ambiental no soportado: ${String(exhaustiveCheck)}`);
        }
      }
    });
  }

  private triggerFlickeringLight(centerX: number, offsetIndex: number): void {
    const light = this.scene.add.rectangle(
      centerX + offsetIndex * 24,
      this.config.corridorTopY + 26,
      110,
      18,
      0xf8fafc,
      0.65
    )
      .setDepth(this.config.layerDepth + 0.8);

    const glow = this.scene.add.ellipse(
      light.x,
      light.y + 38,
      170,
      52,
      0xbfdbfe,
      0.12
    )
      .setDepth(this.config.layerDepth + 0.5);

    this.renderObjects.push(light, glow);

    this.scene.tweens.add({
      targets: [light, glow],
      alpha: { from: 0.85, to: 0.2 },
      duration: 95,
      yoyo: true,
      repeat: 7,
      ease: 'Sine.easeInOut'
    });
  }

  private triggerDistantZombieSound(centerX: number): void {
    if (this.scene.sound.get(this.config.zombieAmbientSoundKey) || this.scene.cache.audio.has(this.config.zombieAmbientSoundKey)) {
      this.scene.sound.play(this.config.zombieAmbientSoundKey, {
        volume: 0.22,
        detune: Phaser.Math.Between(-140, 120)
      });
      return;
    }

    const hint = this.scene.add.text(centerX, this.config.corridorTopY + 52, 'Grrrr... (lejos)', {
      fontSize: '16px',
      color: '#fecaca',
      backgroundColor: '#1f2937',
      padding: { x: 8, y: 4 }
    })
      .setOrigin(0.5)
      .setDepth(this.config.layerDepth + 1.1)
      .setAlpha(0);

    this.renderObjects.push(hint);

    this.scene.tweens.add({
      targets: hint,
      alpha: { from: 0, to: 0.95 },
      y: hint.y - 10,
      duration: 260,
      yoyo: true,
      hold: 280,
      onComplete: () => hint.destroy()
    });
  }

  private spawnTippedObjects(centerX: number, offsetIndex: number): void {
    const baseX = centerX + (offsetIndex - 1) * 42;
    const y = this.config.floorY - 18;

    const crate = this.scene.add.rectangle(baseX - 24, y, 44, 28, 0x6b4f3a, 0.95)
      .setAngle(-24)
      .setDepth(this.config.layerDepth + 0.3)
      .setStrokeStyle(2, 0x1f2937, 0.4);

    const cone = this.scene.add.rectangle(baseX + 22, y + 2, 20, 26, 0xf97316, 0.92)
      .setAngle(68)
      .setDepth(this.config.layerDepth + 0.35)
      .setStrokeStyle(2, 0x7c2d12, 0.4);

    this.renderObjects.push(crate, cone);
  }

  private spawnBrokenScreen(centerX: number, offsetIndex: number): void {
    const x = centerX + (offsetIndex % 2 === 0 ? -36 : 36);
    const y = this.config.floorY - 84;

    const frame = this.scene.add.rectangle(x, y, 64, 96, 0x111827, 0.95)
      .setDepth(this.config.layerDepth + 0.4)
      .setStrokeStyle(2, 0x6b7280, 0.45);

    const glass = this.scene.add.rectangle(x, y - 6, 50, 64, 0x60a5fa, 0.24)
      .setDepth(this.config.layerDepth + 0.45);

    const crackA = this.scene.add.line(x, y - 6, -14, -22, 10, 6, 0xe2e8f0, 0.8)
      .setDepth(this.config.layerDepth + 0.5)
      .setLineWidth(2, 2);

    const crackB = this.scene.add.line(x, y - 6, -2, -12, 12, -28, 0xe2e8f0, 0.75)
      .setDepth(this.config.layerDepth + 0.5)
      .setLineWidth(2, 2);

    this.renderObjects.push(frame, glass, crackA, crackB);
  }

  private spawnFloorStains(centerX: number, offsetIndex: number): void {
    const baseX = centerX + (offsetIndex - 1) * 36;
    const y = this.config.floorY - 4;

    const stainA = this.scene.add.ellipse(baseX - 16, y, 42, 14, 0x7f1d1d, 0.32)
      .setDepth(this.config.layerDepth + 0.1);

    const stainB = this.scene.add.ellipse(baseX + 14, y + 2, 30, 12, 0x450a0a, 0.28)
      .setDepth(this.config.layerDepth + 0.1);

    this.renderObjects.push(stainA, stainB);
  }
}
