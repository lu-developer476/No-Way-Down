import Phaser from 'phaser';

export interface SecurityPostPosition {
  x: number;
  y: number;
}

export interface SecurityPostSize {
  width: number;
  height: number;
}

export interface SecurityPostResource {
  id: string;
  type: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

export interface SecurityPostEvent {
  id: string;
  trigger: 'on_enter' | 'on_interact' | 'on_alert';
  description: string;
  payload?: Record<string, unknown>;
}

export interface SecurityPostDefinition {
  id: string;
  floor: number;
  position: SecurityPostPosition;
  size: SecurityPostSize;
  blocksVision: boolean;
  providesCover: boolean;
  isCollidable?: boolean;
  resources?: SecurityPostResource[];
  events?: SecurityPostEvent[];
}

export interface SecurityPostSystemConfig {
  posts: SecurityPostDefinition[];
  collisionPadding?: number;
  coverPadding?: number;
}

interface RuntimeSecurityPost {
  definition: SecurityPostDefinition;
  bounds: Phaser.Geom.Rectangle;
}

const DEFAULT_COLLISION_PADDING = 0;
const DEFAULT_COVER_PADDING = 6;

export class SecurityPostSystem {
  private readonly posts: RuntimeSecurityPost[];
  private readonly collisionPadding: number;
  private readonly coverPadding: number;

  constructor(config: SecurityPostSystemConfig) {
    this.collisionPadding = config.collisionPadding ?? DEFAULT_COLLISION_PADDING;
    this.coverPadding = config.coverPadding ?? DEFAULT_COVER_PADDING;

    this.posts = config.posts.map((definition) => ({
      definition: {
        ...definition,
        isCollidable: definition.isCollidable ?? true,
        resources: definition.resources ?? [],
        events: definition.events ?? []
      },
      bounds: new Phaser.Geom.Rectangle(
        definition.position.x,
        definition.position.y,
        definition.size.width,
        definition.size.height
      )
    }));
  }

  static fromJSON(input: string | SecurityPostSystemConfig): SecurityPostSystem {
    const parsed = typeof input === 'string' ? (JSON.parse(input) as SecurityPostSystemConfig) : input;
    return new SecurityPostSystem(parsed);
  }

  getPosts(floor?: number): SecurityPostDefinition[] {
    return this.posts
      .filter((post) => floor === undefined || post.definition.floor === floor)
      .map((post) => post.definition);
  }

  getPostById(id: string): SecurityPostDefinition | null {
    const runtimePost = this.posts.find((post) => post.definition.id === id);
    return runtimePost?.definition ?? null;
  }

  getCoverPostAt(worldX: number, worldY: number): SecurityPostDefinition | null {
    for (const post of this.posts) {
      if (!post.definition.providesCover) {
        continue;
      }

      const expanded = Phaser.Geom.Rectangle.Clone(post.bounds);
      expanded.x -= this.coverPadding;
      expanded.y -= this.coverPadding;
      expanded.width += this.coverPadding * 2;
      expanded.height += this.coverPadding * 2;

      if (expanded.contains(worldX, worldY)) {
        return post.definition;
      }
    }

    return null;
  }

  hasCollisionAt(worldX: number, worldY: number): boolean {
    return this.getCollidingPostAt(worldX, worldY) !== null;
  }

  getCollidingPostAt(worldX: number, worldY: number): SecurityPostDefinition | null {
    for (const post of this.posts) {
      if (!post.definition.isCollidable) {
        continue;
      }

      const collisionRect = Phaser.Geom.Rectangle.Clone(post.bounds);
      collisionRect.x -= this.collisionPadding;
      collisionRect.y -= this.collisionPadding;
      collisionRect.width += this.collisionPadding * 2;
      collisionRect.height += this.collisionPadding * 2;

      if (collisionRect.contains(worldX, worldY)) {
        return post.definition;
      }
    }

    return null;
  }

  isVisionBlocked(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2): boolean {
    const line = new Phaser.Geom.Line(from.x, from.y, to.x, to.y);

    for (const post of this.posts) {
      if (!post.definition.blocksVision) {
        continue;
      }

      if (Phaser.Geom.Intersects.LineToRectangle(line, post.bounds)) {
        return true;
      }
    }

    return false;
  }

  getResources(postId: string): SecurityPostResource[] {
    return this.getPostById(postId)?.resources ?? [];
  }

  getEvents(postId: string): SecurityPostEvent[] {
    return this.getPostById(postId)?.events ?? [];
  }

  createStaticCollisionBodies(scene: Phaser.Scene): Phaser.Physics.Arcade.StaticGroup {
    const group = scene.physics.add.staticGroup();

    this.posts.forEach(({ definition, bounds }) => {
      if (!definition.isCollidable) {
        return;
      }

      const centerX = bounds.centerX;
      const centerY = bounds.centerY;
      const body = group.create(centerX, centerY) as Phaser.Physics.Arcade.Image;
      body.setVisible(false);
      body.setSize(bounds.width, bounds.height);
      body.refreshBody();
      body.setData('securityPostId', definition.id);
      body.setData('providesCover', definition.providesCover);
      body.setData('blocksVision', definition.blocksVision);
    });

    return group;
  }
}
