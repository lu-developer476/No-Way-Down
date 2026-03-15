import Phaser from 'phaser';
import { Player } from './Player';
import { Zombie } from './Zombie';
import { getCharacterVisualById } from '../config/characterVisuals';

const ALLY_FOLLOW_SPEED = 170;
const ALLY_ATTACK_APPROACH_SPEED = 195;
const ALLY_STOP_RADIUS = 24;
const ALLY_CATCHUP_DISTANCE = 260;
const ALLY_TELEPORT_DISTANCE = 620;
const ALLY_TARGET_DETECTION_RANGE = 340;
const ALLY_ATTACK_RANGE = 210;
const ALLY_ATTACK_COOLDOWN_MS = 520;
const ALLY_COMBAT_REPOSITION_DISTANCE = 130;
const ALLY_PLAYER_BLOCK_RADIUS = 32;

export interface AllyProfile {
  id: string;
  name: string;
  characterId: string;
  followOffsetX: number;
  followOffsetY: number;
  tint: number;
}

export class AllyAI extends Phaser.Physics.Arcade.Sprite {
  private readonly profile: AllyProfile;
  private readonly characterVisualId: string;
  private readonly nameTag: Phaser.GameObjects.Text;
  private attackReadyAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, profile: AllyProfile) {
    const visual = getCharacterVisualById(profile.characterId);
    super(scene, x, y, `${visual.id}-base-0`);

    this.profile = profile;
    this.characterVisualId = visual.id;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setSize(18, 40);
    this.setOffset(7, 8);
    this.setTint(profile.tint);
    this.setAlpha(0.92);
    this.setPushable(false);

    this.play(`${this.characterVisualId}-idle`, true);

    this.nameTag = scene.add.text(this.x, this.y - 42, profile.name, {
      fontSize: '10px',
      color: '#99f6e4',
      stroke: '#042f2e',
      strokeThickness: 3,
      fontStyle: 'bold'
    });
    this.nameTag.setOrigin(0.5, 1);
    this.nameTag.setDepth(25);
  }

  getId(): string {
    return this.profile.id;
  }

  updateAI(player: Player, zombies: Zombie[], currentTime: number): void {
    if (!this.active) {
      return;
    }

    const target = this.pickTarget(zombies);
    if (target) {
      this.handleCombat(player, target, currentTime);
      return;
    }

    this.followPlayer(player);
  }

  private followPlayer(player: Player): void {
    const desiredX = player.x + this.profile.followOffsetX;
    const desiredY = player.y + this.profile.followOffsetY;

    this.moveTowards(desiredX, desiredY, ALLY_FOLLOW_SPEED, ALLY_STOP_RADIUS);
    this.avoidBlockingPlayer(player);
  }

  private handleCombat(player: Player, target: Zombie, currentTime: number): void {
    const distanceToTarget = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);

    if (distanceToTarget <= ALLY_ATTACK_RANGE) {
      this.setVelocity(0, 0);
      this.tryAttackTarget(target, currentTime);

      const desiredX = player.x + Math.sign(this.profile.followOffsetX || 1) * ALLY_COMBAT_REPOSITION_DISTANCE;
      if (Math.abs(this.x - desiredX) > 110) {
        this.setVelocityX(Math.sign(desiredX - this.x) * (ALLY_FOLLOW_SPEED * 0.75));
      }
      return;
    }

    this.moveTowards(target.x - Math.sign(target.x - player.x || 1) * 14, target.y, ALLY_ATTACK_APPROACH_SPEED, ALLY_STOP_RADIUS);
  }

  private moveTowards(targetX: number, targetY: number, baseSpeed: number, stopRadius: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > ALLY_TELEPORT_DISTANCE) {
      this.recoverNearPoint(targetX, targetY);
      return;
    }

    if (distance <= stopRadius) {
      this.setVelocity(0, 0);
      this.play(`${this.characterVisualId}-idle`, true);
      return;
    }

    const speedMultiplier = distance > ALLY_CATCHUP_DISTANCE ? 1.45 : 1;
    const speed = baseSpeed * speedMultiplier;
    const velocityX = (dx / distance) * speed;
    const velocityY = (dy / distance) * speed;

    this.setVelocity(velocityX, velocityY);
    this.play(`${this.characterVisualId}-run`, true);

    if (velocityX < -1) {
      this.setFlipX(true);
    } else if (velocityX > 1) {
      this.setFlipX(false);
    }
  }

  private avoidBlockingPlayer(player: Player): void {
    const inFrontOfPlayer = (this.x - player.x) * ((player.body as Phaser.Physics.Arcade.Body | null)?.velocity.x ?? 0) > 0;
    const closeToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < ALLY_PLAYER_BLOCK_RADIUS;

    if (inFrontOfPlayer && closeToPlayer) {
      this.setVelocityX(this.body && (this.body as Phaser.Physics.Arcade.Body).velocity.x >= 0 ? -120 : 120);
    }
  }

  private recoverNearPoint(targetX: number, targetY: number): void {
    this.setPosition(targetX - this.profile.followOffsetX * 0.35, targetY - 10);
    this.setVelocity(0, 0);
    this.setAlpha(0.45);

    this.scene.tweens.add({
      targets: this,
      alpha: 0.92,
      duration: 220,
      ease: 'Sine.Out'
    });
  }

  private tryAttackTarget(target: Zombie, currentTime: number): void {
    if (currentTime < this.attackReadyAt || !target.active) {
      return;
    }

    target.takeDamage(1);
    this.attackReadyAt = currentTime + ALLY_ATTACK_COOLDOWN_MS;

    this.play(`${this.characterVisualId}-shoot`, true);
    this.setTintFill(0xfef08a);
    this.scene.time.delayedCall(90, () => {
      if (this.active) {
        this.setTint(this.profile.tint);
      }
    });
  }

  private pickTarget(zombies: Zombie[]): Zombie | undefined {
    let closestZombie: Zombie | undefined;
    let closestDistance = ALLY_TARGET_DETECTION_RANGE;

    zombies.forEach((zombie) => {
      if (!zombie.active) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.x, this.y, zombie.x, zombie.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestZombie = zombie;
      }
    });

    return closestZombie;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.nameTag.setPosition(this.x, this.y - 42);
    this.nameTag.setVisible(this.active);
  }

  destroy(fromScene?: boolean): void {
    this.nameTag.destroy();
    super.destroy(fromScene);
  }
}
