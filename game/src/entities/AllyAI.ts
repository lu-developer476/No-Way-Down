import Phaser from 'phaser';
import { Player } from './Player';
import { Zombie } from './Zombie';
import { getCharacterVisualById } from '../config/characterVisuals';

const ALLY_FOLLOW_SPEED = 180;
const ALLY_STOP_RADIUS = 34;
const ALLY_CATCHUP_DISTANCE = 280;
const ALLY_TELEPORT_DISTANCE = 560;
const ALLY_ATTACK_RANGE = 220;
const ALLY_ATTACK_COOLDOWN_MS = 520;

export interface AllyProfile {
  id: string;
  name: string;
  characterId: string;
  followOffsetX: number;
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

    this.followPlayer(player);
    this.tryAttackNearestZombie(zombies, currentTime);
  }

  private followPlayer(player: Player): void {
    const desiredX = player.x + this.profile.followOffsetX;
    const deltaX = desiredX - this.x;
    const deltaY = player.y - this.y;
    const distanceToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distanceToPlayer > ALLY_TELEPORT_DISTANCE) {
      this.recoverNearPlayer(player);
      return;
    }

    if (Math.abs(deltaX) <= ALLY_STOP_RADIUS && Math.abs(deltaY) <= ALLY_STOP_RADIUS) {
      this.setVelocityX(0);
      this.play(`${this.characterVisualId}-idle`, true);
      return;
    }

    const speedMultiplier = distanceToPlayer > ALLY_CATCHUP_DISTANCE ? 1.5 : 1;
    const speed = ALLY_FOLLOW_SPEED * speedMultiplier;
    const direction = Math.sign(deltaX);

    this.setVelocityX(direction * speed);
    this.play(`${this.characterVisualId}-run`, true);

    if (direction < 0) {
      this.setFlipX(true);
    } else if (direction > 0) {
      this.setFlipX(false);
    }
  }

  private recoverNearPlayer(player: Player): void {
    const recoverOffsetX = this.profile.followOffsetX * 0.8;
    this.setPosition(player.x + recoverOffsetX, player.y - 12);
    this.setVelocity(0, 0);
    this.setAlpha(0.45);

    this.scene.tweens.add({
      targets: this,
      alpha: 0.92,
      duration: 220,
      ease: 'Sine.Out'
    });
  }

  private tryAttackNearestZombie(zombies: Zombie[], currentTime: number): void {
    if (currentTime < this.attackReadyAt) {
      return;
    }

    const target = this.pickTarget(zombies);
    if (!target) {
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
    let closestDistance = ALLY_ATTACK_RANGE;

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
