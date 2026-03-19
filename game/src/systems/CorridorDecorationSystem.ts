import Phaser from 'phaser';

export type CorridorDecorationType =
  | 'cajero_automatico'
  | 'columna'
  | 'caja'
  | 'pantalla'
  | 'banco';

export interface CorridorSegment {
  index: number;
  startX: number;
  endX: number;
}

export interface CorridorDecorationConfig {
  floorY: number;
  pathCenterY: number;
  pathHalfHeight: number;
  sidePadding?: number;
  randomSeed?: string;
}

export interface CorridorDecorationInstance {
  id: string;
  type: CorridorDecorationType;
  segmentIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  blocksMainPath: boolean;
  breakable: boolean;
  body: Phaser.GameObjects.Rectangle;
  parts: Phaser.GameObjects.GameObject[];
  isBroken: boolean;
}

interface DecorationTemplate {
  type: CorridorDecorationType;
  width: number;
  height: number;
  color: number;
  accentColor: number;
  breakable: boolean;
  blockChance: number;
  baseWeight: number;
}

const DECORATION_TEMPLATES: DecorationTemplate[] = [
  {
    type: 'cajero_automatico',
    width: 44,
    height: 82,
    color: 0x3c566f,
    accentColor: 0xa7f3d0,
    breakable: true,
    blockChance: 0.55,
    baseWeight: 1.1
  },
  {
    type: 'columna',
    width: 54,
    height: 118,
    color: 0x6b7280,
    accentColor: 0xcbd5e1,
    breakable: false,
    blockChance: 0.35,
    baseWeight: 1.0
  },
  {
    type: 'caja',
    width: 40,
    height: 44,
    color: 0x8b5e3c,
    accentColor: 0xeab308,
    breakable: true,
    blockChance: 0.2,
    baseWeight: 1.25
  },
  {
    type: 'pantalla',
    width: 36,
    height: 90,
    color: 0x1f2937,
    accentColor: 0x60a5fa,
    breakable: true,
    blockChance: 0.25,
    baseWeight: 0.9
  },
  {
    type: 'banco',
    width: 98,
    height: 32,
    color: 0x4b5563,
    accentColor: 0x9ca3af,
    breakable: true,
    blockChance: 0.65,
    baseWeight: 1.2
  }
];

const COHERENT_BACKGROUND = 0x0f172a;

export class CorridorDecorationSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: Required<CorridorDecorationConfig>;
  private readonly rng: Phaser.Math.RandomDataGenerator;
  private readonly staticBlockers: Phaser.Physics.Arcade.StaticGroup;
  private readonly decorativeParts: Phaser.GameObjects.GameObject[] = [];
  private readonly instances = new Map<string, CorridorDecorationInstance>();
  private idSequence = 0;

  constructor(scene: Phaser.Scene, config: CorridorDecorationConfig) {
    this.scene = scene;
    this.config = {
      floorY: config.floorY,
      pathCenterY: config.pathCenterY,
      pathHalfHeight: config.pathHalfHeight,
      sidePadding: config.sidePadding ?? 18,
      randomSeed: config.randomSeed ?? `corridor-${Date.now()}`
    };

    this.rng = new Phaser.Math.RandomDataGenerator([this.config.randomSeed]);
    this.staticBlockers = this.scene.physics.add.staticGroup();
  }

  buildFromSegments(segments: CorridorSegment[]): CorridorDecorationInstance[] {
    this.clear();

    const created: CorridorDecorationInstance[] = [];

    segments.forEach((segment) => {
      const template = this.chooseTemplate(segment.index);
      const blocksMainPath = this.rollBlocksMainPath(template, segment.index);
      const x = this.rng.between(
        Math.round(segment.startX + this.config.sidePadding),
        Math.round(segment.endX - this.config.sidePadding)
      );
      const y = this.resolveY(template, blocksMainPath);

      const instance = this.createInstance(segment, template, x, y, blocksMainPath);
      created.push(instance);
      this.instances.set(instance.id, instance);
    });

    return created;
  }

  getBlockingBodies(): Phaser.Physics.Arcade.StaticGroup {
    return this.staticBlockers;
  }

  getInstances(): CorridorDecorationInstance[] {
    return [...this.instances.values()];
  }

  breakBlockingObject(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance || !instance.breakable || instance.isBroken || !instance.blocksMainPath) {
      return false;
    }

    instance.isBroken = true;
    instance.body.fillColor = COHERENT_BACKGROUND;
    instance.body.setAlpha(0.4);

    instance.parts.forEach((part) => {
      if (part instanceof Phaser.GameObjects.Shape) {
        part.setAlpha(0.35);
      }
    });

    this.staticBlockers.remove(instance.body, true, false);
    if (instance.body.body) {
      (instance.body.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    }

    return true;
  }

  clear(): void {
    this.instances.clear();
    this.idSequence = 0;

    this.staticBlockers.clear(true, true);

    this.decorativeParts.forEach((part) => part.destroy());
    this.decorativeParts.length = 0;
  }

  private createInstance(
    segment: CorridorSegment,
    template: DecorationTemplate,
    x: number,
    y: number,
    blocksMainPath: boolean
  ): CorridorDecorationInstance {
    const body = this.scene.add
      .rectangle(x, y, template.width, template.height, template.color, blocksMainPath ? 0.18 : 0.1)
      .setOrigin(0.5, 1)
      .setStrokeStyle(0);

    const baseShadow = this.scene.add
      .ellipse(x, this.config.floorY + 3, template.width * 0.92, 12, 0x020617, 0.3)
      .setOrigin(0.5, 0.5);

    const art = this.buildDecorationArt(template.type, x, y, template.width, template.height);

    this.decorativeParts.push(baseShadow, ...art);

    const instance: CorridorDecorationInstance = {
      id: `corridor-decoration-${this.idSequence++}`,
      type: template.type,
      segmentIndex: segment.index,
      x,
      y,
      width: template.width,
      height: template.height,
      blocksMainPath,
      breakable: template.breakable,
      body,
      parts: [baseShadow, ...art],
      isBroken: false
    };

    if (blocksMainPath) {
      this.staticBlockers.add(body);
    }

    return instance;
  }

  private chooseTemplate(segmentIndex: number): DecorationTemplate {
    const weighted = DECORATION_TEMPLATES.map((template) => {
      const parityBoost = segmentIndex % 2 === 0 && template.type === 'columna' ? 0.2 : 0;
      const rhythmBoost = segmentIndex % 3 === 0 && template.type === 'banco' ? 0.25 : 0;
      return {
        template,
        weight: template.baseWeight + parityBoost + rhythmBoost
      };
    });

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.rng.frac() * totalWeight;

    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.template;
      }
    }

    return DECORATION_TEMPLATES[0];
  }

  private rollBlocksMainPath(template: DecorationTemplate, segmentIndex: number): boolean {
    const guaranteedBlocker = segmentIndex > 0 && segmentIndex % 4 === 0;
    if (guaranteedBlocker && template.breakable) {
      return true;
    }

    return this.rng.frac() < template.blockChance;
  }

  private resolveY(template: DecorationTemplate, blocksMainPath: boolean): number {
    if (blocksMainPath) {
      return this.config.pathCenterY + this.rng.between(-8, 8);
    }

    const topLane = this.config.pathCenterY - this.config.pathHalfHeight - 14;
    const bottomLane = this.config.pathCenterY + this.config.pathHalfHeight + template.height * 0.26;
    return this.rng.frac() > 0.5 ? topLane : bottomLane;
  }

  private buildDecorationArt(
    type: CorridorDecorationType,
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.GameObject[] {
    switch (type) {
      case 'cajero_automatico':
        return [this.scene.add.image(x, y - height / 2, 'prop-atm').setDisplaySize(width + 12, height + 16).setOrigin(0.5, 0.5)];
      case 'columna':
        return [this.scene.add.image(x, y - height / 2 + 6, 'prop-stone-column').setDisplaySize(width + 6, height + 16).setOrigin(0.5, 0.5)];
      case 'caja':
        return [this.scene.add.image(x, y - height / 2 + 8, 'prop-recycling-box').setDisplaySize(width + 10, height + 18).setOrigin(0.5, 0.5)];
      case 'pantalla':
        return [this.scene.add.image(x, y - height / 2 + 4, 'prop-info-screen').setDisplaySize(width + 10, height + 8).setOrigin(0.5, 0.5)];
      case 'banco':
        return [this.scene.add.image(x, y - height / 2 + 8, 'prop-bench').setDisplaySize(width, height + 10).setOrigin(0.5, 0.5)];
      default:
        return [];
    }
  }
}

