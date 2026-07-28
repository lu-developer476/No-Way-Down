import Phaser from 'phaser';
import { Character, CharacterStats } from './Character';
import { NameTag } from '../ui/NameTag';

export interface ShotPayload {
  readonly ownerId: string;
  readonly ownerName: string;
  readonly x: number;
  readonly y: number;
  readonly direction: Phaser.Math.Vector2;
  readonly weaponType: string;
  readonly damage: number;
}

export class Survivor extends Character {
  private readonly weaponDirection: Phaser.Math.Vector2;
  private readonly nameTag: NameTag;
  private nextShotAt: number;

  constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    texture: string,
    frame: string | number | undefined,
    stats: CharacterStats
  ) {
    super(scene, id, x, y, texture, frame, stats);

    this.weaponDirection = new Phaser.Math.Vector2(1, 0);
    this.nameTag = new NameTag(scene, this);
    this.nextShotAt = 0;

    const body = this.body as Phaser.Physics.Arcade.Body | null;
    body?.setMaxVelocity(this.moveSpeed, this.moveSpeed);
  }

  setWeaponDirection(targetX: number, targetY: number): Phaser.Math.Vector2 {
    this.weaponDirection.set(targetX - this.x, targetY - this.y);

    if (this.weaponDirection.lengthSq() === 0) {
      this.weaponDirection.set(this.flipX ? -1 : 1, 0);
    }

    this.weaponDirection.normalize();

    this.setFlipX(this.weaponDirection.x < 0);

    return this.weaponDirection.clone();
  }

  getWeaponDirection(): Phaser.Math.Vector2 {
    return this.weaponDirection.clone();
  }

  isShotOnCooldown(currentTime: number): boolean {
    return currentTime < this.nextShotAt;
  }

  override attack(targetX: number, targetY: number, currentTime: number): boolean {
    if (!this.active || this.isShotOnCooldown(currentTime)) {
      return false;
    }

    const direction = this.setWeaponDirection(targetX, targetY);
    this.nextShotAt = currentTime + this.fireRate;
    this.playShoot();

    const shotPayload: ShotPayload = {
      ownerId: this.id,
      ownerName: this.name,
      x: this.x,
      y: this.y,
      direction,
      weaponType: this.weaponType,
      damage: this.damage
    };

    this.scene.events.emit('character:shoot', shotPayload);

    return true;
  }

  getShotCooldownRemaining(currentTime: number): number {
    return Math.max(0, this.nextShotAt - currentTime);
  }

  override destroy(fromScene?: boolean): void {
    this.nameTag.destroy();
    super.destroy(fromScene);
  }
}
