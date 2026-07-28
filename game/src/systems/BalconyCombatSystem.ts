import Phaser from 'phaser';

export type BalconyHeightId = string;
export type BalconyTeamId = string;

export interface BalconyHeightBandJson {
  id: BalconyHeightId;
  minY: number;
  maxY: number;
  priority?: number;
}

export interface BalconyGalleryJson {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  heightId: BalconyHeightId;
}

export interface BalconyDetectionJson {
  horizontalRange: number;
  minVerticalDelta: number;
  maxVerticalDelta: number;
}

export interface BalconyProjectileJson {
  textureKey: string;
  speed: number;
  lifespanMs: number;
  damage: number;
  maxProjectiles?: number;
}

export interface BalconyHeightRulesJson {
  allowDownwardShots: boolean;
  allowUpwardShots: boolean;
}

export interface BalconyCombatJsonConfig {
  heights: BalconyHeightBandJson[];
  galleries?: BalconyGalleryJson[];
  detection?: Partial<BalconyDetectionJson>;
  projectile: Partial<BalconyProjectileJson> & Pick<BalconyProjectileJson, 'textureKey'>;
  rules?: Partial<BalconyHeightRulesJson>;
}

export interface BalconyCombatantRegistration {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  teamId: BalconyTeamId;
  cooldownMs?: number;
  forcedHeightId?: BalconyHeightId;
}

export interface BalconyProjectileMetadata {
  shooterId: string;
  teamId: BalconyTeamId;
  originHeightId: BalconyHeightId;
  velocityX: number;
  velocityY: number;
  spawnedAt: number;
  damage: number;
}

export interface BalconyShootResult {
  projectile: Phaser.Physics.Arcade.Image;
  shooterId: string;
  targetId: string;
  velocityX: number;
  velocityY: number;
}

interface RuntimeCombatant {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  teamId: BalconyTeamId;
  cooldownMs: number;
  nextShotAt: number;
  forcedHeightId?: BalconyHeightId;
}

const DEFAULT_DETECTION: BalconyDetectionJson = {
  horizontalRange: 380,
  minVerticalDelta: 36,
  maxVerticalDelta: 420
};

const DEFAULT_RULES: BalconyHeightRulesJson = {
  allowDownwardShots: true,
  allowUpwardShots: true
};

const DEFAULT_PROJECTILE: Omit<BalconyProjectileJson, 'textureKey'> = {
  speed: 420,
  lifespanMs: 2200,
  damage: 12,
  maxProjectiles: 80
};

const DEFAULT_COMBATANT_COOLDOWN_MS = 950;

export class BalconyCombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly detection: BalconyDetectionJson;
  private readonly projectileConfig: BalconyProjectileJson;
  private readonly rules: BalconyHeightRulesJson;
  private readonly heightBands: BalconyHeightBandJson[];
  private readonly galleries: Array<BalconyGalleryJson & { rect: Phaser.Geom.Rectangle }>;
  private readonly combatants = new Map<string, RuntimeCombatant>();
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private readonly projectileMeta = new WeakMap<Phaser.Physics.Arcade.Image, BalconyProjectileMetadata>();

  constructor(scene: Phaser.Scene, config: BalconyCombatJsonConfig) {
    this.scene = scene;

    this.heightBands = [...config.heights].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.galleries = (config.galleries ?? []).map((gallery) => ({
      ...gallery,
      rect: new Phaser.Geom.Rectangle(gallery.x, gallery.y, gallery.width, gallery.height)
    }));

    this.detection = {
      horizontalRange: config.detection?.horizontalRange ?? DEFAULT_DETECTION.horizontalRange,
      minVerticalDelta: config.detection?.minVerticalDelta ?? DEFAULT_DETECTION.minVerticalDelta,
      maxVerticalDelta: config.detection?.maxVerticalDelta ?? DEFAULT_DETECTION.maxVerticalDelta
    };

    this.rules = {
      allowDownwardShots: config.rules?.allowDownwardShots ?? DEFAULT_RULES.allowDownwardShots,
      allowUpwardShots: config.rules?.allowUpwardShots ?? DEFAULT_RULES.allowUpwardShots
    };

    this.projectileConfig = {
      textureKey: config.projectile.textureKey,
      speed: config.projectile.speed ?? DEFAULT_PROJECTILE.speed,
      lifespanMs: config.projectile.lifespanMs ?? DEFAULT_PROJECTILE.lifespanMs,
      damage: config.projectile.damage ?? DEFAULT_PROJECTILE.damage,
      maxProjectiles: config.projectile.maxProjectiles ?? DEFAULT_PROJECTILE.maxProjectiles
    };

    this.projectiles = this.scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: this.projectileConfig.maxProjectiles,
      runChildUpdate: false
    });
  }

  registerCombatant(registration: BalconyCombatantRegistration): void {
    this.combatants.set(registration.id, {
      id: registration.id,
      sprite: registration.sprite,
      teamId: registration.teamId,
      cooldownMs: registration.cooldownMs ?? DEFAULT_COMBATANT_COOLDOWN_MS,
      nextShotAt: 0,
      forcedHeightId: registration.forcedHeightId
    });
  }

  unregisterCombatant(id: string): void {
    this.combatants.delete(id);
  }

  getProjectileGroup(): Phaser.Physics.Arcade.Group {
    return this.projectiles;
  }

  getCombatantHeightId(combatantId: string): BalconyHeightId | null {
    const combatant = this.combatants.get(combatantId);
    if (!combatant || !combatant.sprite.active) {
      return null;
    }

    return this.resolveHeightId(combatant.sprite, combatant.forcedHeightId);
  }

  update(currentTime: number): void {
    for (const combatant of this.combatants.values()) {
      if (!combatant.sprite.active || currentTime < combatant.nextShotAt) {
        continue;
      }

      const target = this.findBestTarget(combatant);
      if (!target) {
        continue;
      }

      const shot = this.tryShoot(combatant.id, target.id, currentTime);
      if (shot) {
        combatant.nextShotAt = currentTime + combatant.cooldownMs;
      }
    }
  }

  tryShoot(shooterId: string, targetId: string, currentTime = this.scene.time.now): BalconyShootResult | null {
    const shooter = this.combatants.get(shooterId);
    const target = this.combatants.get(targetId);

    if (!shooter || !target || !shooter.sprite.active || !target.sprite.active) {
      return null;
    }

    if (!this.canShoot(shooter, target)) {
      return null;
    }

    const velocity = this.computeVelocity(shooter.sprite, target.sprite, this.projectileConfig.speed);
    const projectile = this.projectiles.get(shooter.sprite.x, shooter.sprite.y, this.projectileConfig.textureKey) as Phaser.Physics.Arcade.Image | null;

    if (!projectile) {
      return null;
    }

    projectile.enableBody(true, shooter.sprite.x, shooter.sprite.y, true, true);
    projectile.setActive(true).setVisible(true);

    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(velocity.x, velocity.y);

    const shooterHeightId = this.resolveHeightId(shooter.sprite, shooter.forcedHeightId);
    if (!shooterHeightId) {
      projectile.disableBody(true, true);
      return null;
    }

    this.projectileMeta.set(projectile, {
      shooterId,
      teamId: shooter.teamId,
      originHeightId: shooterHeightId,
      velocityX: velocity.x,
      velocityY: velocity.y,
      spawnedAt: currentTime,
      damage: this.projectileConfig.damage
    });

    this.scene.time.delayedCall(this.projectileConfig.lifespanMs, () => {
      if (projectile.active) {
        projectile.disableBody(true, true);
      }
    });

    return {
      projectile,
      shooterId,
      targetId,
      velocityX: velocity.x,
      velocityY: velocity.y
    };
  }

  bindProjectileWorldCollision(
    colliders: Phaser.Types.Physics.Arcade.ArcadeColliderType | Phaser.Types.Physics.Arcade.ArcadeColliderType[]
  ): void {
    const list = Array.isArray(colliders) ? colliders : [colliders];
    for (const collider of list) {
      this.scene.physics.add.collider(this.projectiles, collider, (projectile) => {
        (projectile as Phaser.Physics.Arcade.Image).disableBody(true, true);
      });
    }
  }

  bindProjectileCombatantCollision(
    onHit: (payload: { projectile: Phaser.Physics.Arcade.Image; target: Phaser.Physics.Arcade.Sprite; damage: number; shooterId: string }) => void
  ): void {
    const sprites = Array.from(this.combatants.values()).map((combatant) => combatant.sprite);

    this.scene.physics.add.overlap(this.projectiles, sprites, (projectileGameObject, targetGameObject) => {
      const projectile = projectileGameObject as Phaser.Physics.Arcade.Image;
      const targetSprite = targetGameObject as Phaser.Physics.Arcade.Sprite;
      const metadata = this.projectileMeta.get(projectile);

      if (!metadata || !projectile.active || !targetSprite.active) {
        return;
      }

      const target = this.findCombatantBySprite(targetSprite);
      if (!target || target.teamId === metadata.teamId || target.id === metadata.shooterId) {
        return;
      }

      const targetHeightId = this.resolveHeightId(target.sprite, target.forcedHeightId);
      if (!targetHeightId || !this.isHeightPairShootable(metadata.originHeightId, targetHeightId)) {
        return;
      }

      projectile.disableBody(true, true);
      onHit({ projectile, target: targetSprite, damage: metadata.damage, shooterId: metadata.shooterId });
    });
  }

  private findBestTarget(shooter: RuntimeCombatant): RuntimeCombatant | null {
    let bestTarget: RuntimeCombatant | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of this.combatants.values()) {
      if (candidate.id === shooter.id || candidate.teamId === shooter.teamId || !candidate.sprite.active) {
        continue;
      }

      if (!this.canShoot(shooter, candidate)) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(shooter.sprite.x, shooter.sprite.y, candidate.sprite.x, candidate.sprite.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTarget = candidate;
      }
    }

    return bestTarget;
  }

  private canShoot(shooter: RuntimeCombatant, target: RuntimeCombatant): boolean {
    const shooterHeightId = this.resolveHeightId(shooter.sprite, shooter.forcedHeightId);
    const targetHeightId = this.resolveHeightId(target.sprite, target.forcedHeightId);

    if (!shooterHeightId || !targetHeightId || !this.isHeightPairShootable(shooterHeightId, targetHeightId)) {
      return false;
    }

    const deltaX = Math.abs(target.sprite.x - shooter.sprite.x);
    const deltaY = target.sprite.y - shooter.sprite.y;

    if (deltaX > this.detection.horizontalRange) {
      return false;
    }

    const verticalDistance = Math.abs(deltaY);
    if (verticalDistance < this.detection.minVerticalDelta || verticalDistance > this.detection.maxVerticalDelta) {
      return false;
    }

    if (deltaY > 0) {
      return this.rules.allowDownwardShots;
    }

    if (deltaY < 0) {
      return this.rules.allowUpwardShots;
    }

    return false;
  }

  private isHeightPairShootable(originHeightId: BalconyHeightId, targetHeightId: BalconyHeightId): boolean {
    if (originHeightId === targetHeightId) {
      return false;
    }

    const originBand = this.heightBands.find((band) => band.id === originHeightId);
    const targetBand = this.heightBands.find((band) => band.id === targetHeightId);

    if (!originBand || !targetBand) {
      return false;
    }

    const originCenterY = (originBand.minY + originBand.maxY) / 2;
    const targetCenterY = (targetBand.minY + targetBand.maxY) / 2;

    if (targetCenterY > originCenterY) {
      return this.rules.allowDownwardShots;
    }

    return this.rules.allowUpwardShots;
  }

  private resolveHeightId(sprite: Phaser.Physics.Arcade.Sprite, forcedHeightId?: BalconyHeightId): BalconyHeightId | null {
    if (forcedHeightId) {
      return forcedHeightId;
    }

    for (const gallery of this.galleries) {
      if (Phaser.Geom.Rectangle.Contains(gallery.rect, sprite.x, sprite.y)) {
        return gallery.heightId;
      }
    }

    for (const band of this.heightBands) {
      if (sprite.y >= band.minY && sprite.y <= band.maxY) {
        return band.id;
      }
    }

    return null;
  }

  private findCombatantBySprite(sprite: Phaser.Physics.Arcade.Sprite): RuntimeCombatant | null {
    for (const combatant of this.combatants.values()) {
      if (combatant.sprite === sprite) {
        return combatant;
      }
    }

    return null;
  }

  private computeVelocity(
    shooter: Phaser.Physics.Arcade.Sprite,
    target: Phaser.Physics.Arcade.Sprite,
    speed: number
  ): Phaser.Math.Vector2 {
    const direction = new Phaser.Math.Vector2(target.x - shooter.x, target.y - shooter.y);
    if (direction.lengthSq() === 0) {
      return new Phaser.Math.Vector2(0, speed);
    }

    return direction.normalize().scale(speed);
  }
}
