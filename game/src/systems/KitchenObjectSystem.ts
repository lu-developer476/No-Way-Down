import Phaser from 'phaser';

export type KitchenObjectType =
  | 'mesada_acero'
  | 'horno_industrial'
  | 'carro_comida'
  | 'bandeja'
  | 'camara_frigorifica';

export interface KitchenVector2 {
  x: number;
  y: number;
}

export interface KitchenObjectSize {
  width: number;
  height: number;
}

export interface KitchenObjectCollision {
  enabled: boolean;
  shape: 'rectangle';
  offset: KitchenVector2;
  isBlocking: boolean;
}

export interface KitchenObjectDefinition {
  id: string;
  type: KitchenObjectType;
  position: KitchenVector2;
  size: KitchenObjectSize;
  collision: KitchenObjectCollision;
  destructible: boolean;
}

export interface KitchenObjectSystemConfig {
  kitchenObjects: KitchenObjectDefinition[];
}

export interface KitchenRuntimeObject extends KitchenObjectDefinition {
  bounds: Phaser.Geom.Rectangle;
  hp: number;
}

const DEFAULT_DESTRUCTIBLE_HP = 100;

export class KitchenObjectSystem {
  private readonly objects: KitchenRuntimeObject[];

  constructor(config: KitchenObjectSystemConfig) {
    this.objects = config.kitchenObjects.map((objectDef) => {
      const originX = objectDef.position.x - objectDef.size.width * 0.5;
      const originY = objectDef.position.y - objectDef.size.height * 0.5;

      return {
        ...objectDef,
        bounds: new Phaser.Geom.Rectangle(
          originX + objectDef.collision.offset.x,
          originY + objectDef.collision.offset.y,
          objectDef.size.width,
          objectDef.size.height
        ),
        hp: objectDef.destructible ? DEFAULT_DESTRUCTIBLE_HP : Number.POSITIVE_INFINITY
      };
    });
  }

  static fromJSON(input: string | KitchenObjectSystemConfig): KitchenObjectSystem {
    const parsed = typeof input === 'string'
      ? (JSON.parse(input) as KitchenObjectSystemConfig)
      : input;

    return new KitchenObjectSystem(parsed);
  }

  getAllObjects(): KitchenRuntimeObject[] {
    return this.objects;
  }

  getBlockingObjects(): KitchenRuntimeObject[] {
    return this.objects.filter((objectDef) => objectDef.collision.enabled && objectDef.collision.isBlocking);
  }

  isPointBlocked(worldPoint: KitchenVector2): boolean {
    return this.getBlockingObjects().some((objectDef) => objectDef.bounds.contains(worldPoint.x, worldPoint.y));
  }

  applyDamage(objectId: string, damage: number): boolean {
    const objectDef = this.objects.find((entry) => entry.id === objectId);
    if (!objectDef || !objectDef.destructible) {
      return false;
    }

    objectDef.hp = Math.max(0, objectDef.hp - Math.max(0, damage));

    if (objectDef.hp === 0) {
      objectDef.collision.isBlocking = false;
      return true;
    }

    return false;
  }

  /**
   * Creates static Arcade Physics bodies to integrate with Phaser collisions.
   * If you already have physics objects, use `getBlockingObjects()` and wire collisions manually.
   */
  createCollisionBodies(
    scene: Phaser.Scene,
    target: Phaser.Types.Physics.Arcade.ArcadeColliderType
  ): Phaser.Physics.Arcade.StaticGroup {
    const blockers = this.getBlockingObjects();
    const group = scene.physics.add.staticGroup();

    blockers.forEach((objectDef) => {
      const bodyObject = scene.add.zone(objectDef.position.x, objectDef.position.y, objectDef.size.width, objectDef.size.height);
      scene.physics.add.existing(bodyObject, true);

      const body = bodyObject.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(objectDef.size.width, objectDef.size.height);
      body.setOffset(
        objectDef.collision.offset.x - objectDef.size.width * 0.5,
        objectDef.collision.offset.y - objectDef.size.height * 0.5
      );

      group.add(bodyObject);
    });

    scene.physics.add.collider(target, group);

    return group;
  }
}
