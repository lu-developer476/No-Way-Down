import Phaser from 'phaser';

export interface VerticalDetectionConfig {
  horizontalRange: number;
  minVerticalOffset: number;
  maxVerticalOffset: number;
}

export interface BalconyEnemyConfig {
  sprite: Phaser.Physics.Arcade.Sprite;
  fireCooldownMs?: number;
  projectileSpeed?: number;
  detection?: Partial<VerticalDetectionConfig>;
}

export interface BalconyProjectileConfig {
  textureKey: string;
  damage?: number;
  lifespanMs?: number;
}

export interface BalconyShotEvent {
  shooter: Phaser.Physics.Arcade.Sprite;
  projectile: Phaser.Physics.Arcade.Image;
  velocityX: number;
  velocityY: number;
  damage: number;
}

const DEFAULT_VERTICAL_DETECTION: VerticalDetectionConfig = {
  horizontalRange: 340,
  minVerticalOffset: 40,
  maxVerticalOffset: 320
};

const DEFAULT_ENEMY_COOLDOWN_MS = 1100;
const DEFAULT_PROJECTILE_SPEED = 360;
const DEFAULT_PROJECTILE_DAMAGE = 10;
const DEFAULT_PROJECTILE_LIFESPAN_MS = 2400;

type RuntimeBalconyEnemy = {
  sprite: Phaser.Physics.Arcade.Sprite;
  fireCooldownMs: number;
  projectileSpeed: number;
  detection: VerticalDetectionConfig;
  nextShotAt: number;
};

/**
 * Sistema modular para soportar balcones/niveles superiores.
 *
 * Objetivos:
 * - Detección vertical entre enemigos en altura y jugadores en planta baja.
 * - Disparo vertical (hacia abajo para enemigos y hacia arriba para jugadores).
 * - No altera colisiones existentes del escenario: todos los proyectiles usan
 *   `allowGravity = false` y se destruyen por tiempo de vida.
 */
export class BalconySystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Physics.Arcade.Sprite[];
  private readonly balconyEnemies: RuntimeBalconyEnemy[] = [];
  private readonly enemyProjectiles: Phaser.Physics.Arcade.Group;
  private readonly playerVerticalProjectiles: Phaser.Physics.Arcade.Group;
  private readonly projectileTextureKey: string;
  private readonly projectileDamage: number;
  private readonly projectileLifespanMs: number;

  constructor(
    scene: Phaser.Scene,
    players: Phaser.Physics.Arcade.Sprite[],
    projectileConfig: BalconyProjectileConfig
  ) {
    this.scene = scene;
    this.players = players;
    this.projectileTextureKey = projectileConfig.textureKey;
    this.projectileDamage = projectileConfig.damage ?? DEFAULT_PROJECTILE_DAMAGE;
    this.projectileLifespanMs = projectileConfig.lifespanMs ?? DEFAULT_PROJECTILE_LIFESPAN_MS;

    this.enemyProjectiles = this.createProjectileGroup();
    this.playerVerticalProjectiles = this.createProjectileGroup();
  }

  registerBalconyEnemy(config: BalconyEnemyConfig): void {
    this.balconyEnemies.push({
      sprite: config.sprite,
      fireCooldownMs: config.fireCooldownMs ?? DEFAULT_ENEMY_COOLDOWN_MS,
      projectileSpeed: config.projectileSpeed ?? DEFAULT_PROJECTILE_SPEED,
      detection: {
        horizontalRange: config.detection?.horizontalRange ?? DEFAULT_VERTICAL_DETECTION.horizontalRange,
        minVerticalOffset: config.detection?.minVerticalOffset ?? DEFAULT_VERTICAL_DETECTION.minVerticalOffset,
        maxVerticalOffset: config.detection?.maxVerticalOffset ?? DEFAULT_VERTICAL_DETECTION.maxVerticalOffset
      },
      nextShotAt: 0
    });
  }

  /**
   * Permite al jugador disparar hacia arriba sin tocar su sistema de colisiones base.
   */
  tryPlayerShootUp(
    player: Phaser.Physics.Arcade.Sprite,
    options: { speed?: number; horizontalCarry?: number } = {}
  ): BalconyShotEvent | null {
    if (!player.active) {
      return null;
    }

    const speed = options.speed ?? DEFAULT_PROJECTILE_SPEED;
    const horizontalCarry = options.horizontalCarry ?? 0;
    const projectile = this.spawnProjectile(
      this.playerVerticalProjectiles,
      player.x,
      player.y - 22,
      horizontalCarry,
      -Math.abs(speed)
    );

    if (!projectile) {
      return null;
    }

    return {
      shooter: player,
      projectile,
      velocityX: horizontalCarry,
      velocityY: -Math.abs(speed),
      damage: this.projectileDamage
    };
  }

  update(currentTime: number): void {
    for (const enemy of this.balconyEnemies) {
      if (!enemy.sprite.active || currentTime < enemy.nextShotAt) {
        continue;
      }

      const target = this.findTargetBelow(enemy);
      if (!target) {
        continue;
      }

      const velocity = this.computeVelocityToTarget(enemy.sprite, target, enemy.projectileSpeed);
      const projectile = this.spawnProjectile(
        this.enemyProjectiles,
        enemy.sprite.x,
        enemy.sprite.y + 4,
        velocity.x,
        velocity.y
      );

      if (projectile) {
        enemy.nextShotAt = currentTime + enemy.fireCooldownMs;
      }
    }
  }

  getEnemyProjectiles(): Phaser.Physics.Arcade.Group {
    return this.enemyProjectiles;
  }

  getPlayerVerticalProjectiles(): Phaser.Physics.Arcade.Group {
    return this.playerVerticalProjectiles;
  }

  isPlayerDetectedFromBalcony(
    enemy: Phaser.Physics.Arcade.Sprite,
    player: Phaser.Physics.Arcade.Sprite,
    detection: Partial<VerticalDetectionConfig> = {}
  ): boolean {
    const rules: VerticalDetectionConfig = {
      horizontalRange: detection.horizontalRange ?? DEFAULT_VERTICAL_DETECTION.horizontalRange,
      minVerticalOffset: detection.minVerticalOffset ?? DEFAULT_VERTICAL_DETECTION.minVerticalOffset,
      maxVerticalOffset: detection.maxVerticalOffset ?? DEFAULT_VERTICAL_DETECTION.maxVerticalOffset
    };

    const deltaX = Math.abs(player.x - enemy.x);
    const deltaY = player.y - enemy.y;

    return (
      deltaX <= rules.horizontalRange
      && deltaY >= rules.minVerticalOffset
      && deltaY <= rules.maxVerticalOffset
    );
  }

  private createProjectileGroup(): Phaser.Physics.Arcade.Group {
    return this.scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 64,
      runChildUpdate: false
    });
  }

  private findTargetBelow(enemy: RuntimeBalconyEnemy): Phaser.Physics.Arcade.Sprite | null {
    let nearest: Phaser.Physics.Arcade.Sprite | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const player of this.players) {
      if (!player.active || !this.isPlayerDetectedFromBalcony(enemy.sprite, player, enemy.detection)) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, player.x, player.y);
      if (distance < nearestDistance) {
        nearest = player;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  private computeVelocityToTarget(
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

  private spawnProjectile(
    group: Phaser.Physics.Arcade.Group,
    x: number,
    y: number,
    velocityX: number,
    velocityY: number
  ): Phaser.Physics.Arcade.Image | null {
    const projectile = group.get(x, y, this.projectileTextureKey) as Phaser.Physics.Arcade.Image | null;
    if (!projectile) {
      return null;
    }

    projectile.enableBody(true, x, y, true, true);
    projectile.setActive(true).setVisible(true);

    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(velocityX, velocityY);

    this.scene.time.delayedCall(this.projectileLifespanMs, () => {
      if (projectile.active) {
        projectile.disableBody(true, true);
      }
    });

    return projectile;
  }
}
