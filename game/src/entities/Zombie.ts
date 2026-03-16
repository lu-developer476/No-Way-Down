import Phaser from 'phaser';
import { getAudioManager } from '../audio/AudioManager';
import { SpriteAnimationSystem } from '../systems/SpriteAnimationSystem';

const DEFAULT_ZOMBIE_SPEED = 80;
const DEFAULT_DETECTION_RANGE = 260;
const DEFAULT_ATTACK_RANGE = 38;
const DEFAULT_ATTACK_COOLDOWN_MS = 900;
const DEFAULT_ZOMBIE_DAMAGE = 8;
export const DEFAULT_ZOMBIE_HEALTH = 3;

type Target = Pick<Phaser.GameObjects.GameObject, 'active'> & { x: number; y: number };

export class Zombie extends Phaser.Physics.Arcade.Sprite {
  public health: number;
  public speed: number;
  public damage: number;

  private readonly detectionRange: number;
  private readonly attackRange: number;
  private readonly attackCooldownMs: number;
  private readonly spriteAnimationSystem: SpriteAnimationSystem;

  private nextAttackAt = 0;
  private isDying = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: {
      health?: number;
      speed?: number;
      damage?: number;
      moveSpeed?: number;
      detectionRange?: number;
      attackRange?: number;
      attackCooldownMs?: number;
    } = {}
  ) {
    super(scene, x, y, 'zombie-walker-sheet', 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.health = options.health ?? DEFAULT_ZOMBIE_HEALTH;
    this.speed = options.speed ?? options.moveSpeed ?? DEFAULT_ZOMBIE_SPEED;
    this.damage = options.damage ?? DEFAULT_ZOMBIE_DAMAGE;
    this.detectionRange = options.detectionRange ?? DEFAULT_DETECTION_RANGE;
    this.attackRange = options.attackRange ?? DEFAULT_ATTACK_RANGE;
    this.attackCooldownMs = options.attackCooldownMs ?? DEFAULT_ATTACK_COOLDOWN_MS;
    this.spriteAnimationSystem = new SpriteAnimationSystem(scene);

    this.setCollideWorldBounds(true);
    this.setSize(18, 40);
    this.setOffset(7, 8);

    this.spriteAnimationSystem.playState(this, 'zombie-walker', 'idle');
  }

  update(targetX: number): void;
  update(targets: readonly Target[]): void;
  update(targetOrTargets: number | readonly Target[]): void {
    if (!this.active || this.isDying) {
      return;
    }

    if (typeof targetOrTargets === 'number') {
      this.walkAndAttackTarget({ x: targetOrTargets, y: this.y, active: true });
      return;
    }

    const closestTarget = this.findClosestTarget(targetOrTargets);
    if (!closestTarget) {
      this.setVelocity(0, 0);
      this.spriteAnimationSystem.playMovement(this, 'zombie-walker', false);
      return;
    }

    this.walkAndAttackTarget(closestTarget);
  }

  takeDamage(amount: number): void {
    if (!this.active || this.isDying) {
      return;
    }

    this.health -= amount;
    this.spriteAnimationSystem.playHurt(this, 'zombie-walker');

    if (this.health <= 0) {
      this.die();
    }
  }

  resetStats(options: { health?: number; speed?: number; damage?: number } = {}): void {
    this.health = options.health ?? DEFAULT_ZOMBIE_HEALTH;
    this.speed = options.speed ?? this.speed;
    this.damage = options.damage ?? this.damage;
    this.nextAttackAt = 0;
    this.isDying = false;
    this.setAlpha(1);
    this.setAngle(0);
    this.setScale(1);
  }

  getHealth(): number {
    return this.health;
  }

  private findClosestTarget(targets: readonly Target[]): Target | null {
    let closest: Target | null = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;

    for (const target of targets) {
      if (!target.active) {
        continue;
      }

      const distanceSq = Phaser.Math.Distance.Squared(this.x, this.y, target.x, target.y);
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        closest = target;
      }
    }

    return closest;
  }

  private walkAndAttackTarget(target: Target): void {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);

    if (distance > this.detectionRange) {
      this.setVelocity(0, 0);
      this.spriteAnimationSystem.playMovement(this, 'zombie-walker', false);
      return;
    }

    if (distance <= this.attackRange) {
      this.setVelocity(0, 0);
      this.spriteAnimationSystem.playState(this, 'zombie-walker', 'hurt', true);
      this.tryAttack(target);
      return;
    }

    const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const velocityX = Math.cos(angle) * this.speed;
    const velocityY = Math.sin(angle) * this.speed;

    this.setVelocity(velocityX, velocityY);
    this.spriteAnimationSystem.playMovement(this, 'zombie-walker', true);

    if (velocityX < 0) {
      this.setFlipX(true);
    } else if (velocityX > 0) {
      this.setFlipX(false);
    }
  }

  private tryAttack(target: Target): void {
    const now = this.scene.time.now;
    if (now < this.nextAttackAt) {
      return;
    }

    this.nextAttackAt = now + this.attackCooldownMs;
    this.scene.events.emit('zombie:attack', {
      zombie: this,
      damage: this.damage,
      targetX: target.x,
      targetY: target.y
    });
  }

  private die(): void {
    this.isDying = true;
    this.setVelocity(0, 0);
    getAudioManager(this.scene).play('zombieDeath', { x: this.x, y: this.y, volume: 0.25 });

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      angle: Phaser.Math.Between(-25, 25),
      scaleX: 0.85,
      scaleY: 0.85,
      duration: 260,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.disableBody(true, true);
        this.isDying = false;
      }
    });
  }
}
