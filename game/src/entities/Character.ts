import Phaser from 'phaser';
import { WeaponType } from './CharacterRegistry';

export interface CharacterStats {
  readonly name: string;
  readonly maxHealth: number;
  readonly weaponType: WeaponType;
  readonly fireRate: number;
  readonly damage: number;
  readonly moveSpeed: number;
}

export abstract class Character extends Phaser.Physics.Arcade.Sprite {
  public readonly id: string;
  public name: string;
  public health: number;
  public maxHealth: number;
  public weaponType: WeaponType;
  public fireRate: number;
  public damage: number;
  public moveSpeed: number;

  protected constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    texture: string,
    frame: string | number | undefined,
    stats: CharacterStats
  ) {
    super(scene, x, y, texture, frame);

    this.id = id;
    this.name = stats.name;
    this.health = 100;
    this.maxHealth = Math.max(1, stats.maxHealth);
    this.weaponType = stats.weaponType;
    this.fireRate = Math.max(1, stats.fireRate);
    this.damage = Math.max(0, stats.damage);
    this.moveSpeed = Math.max(0, stats.moveSpeed);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
  }

  takeDamage(amount: number): number {
    if (amount <= 0 || !this.active) {
      return this.health;
    }

    this.health = Math.max(0, this.health - amount);

    if (this.health <= 0) {
      this.die();
    }

    return this.health;
  }

  applyInfectionBite(penalty: number): void {
    if (penalty <= 0) {
      return;
    }

    this.maxHealth = Math.max(1, this.maxHealth - penalty);
    this.health = Math.min(this.health, this.maxHealth);
  }

  attack(_targetX: number, _targetY: number, _currentTime: number): boolean {
    return false;
  }

  die(): void {
    this.setVelocity(0, 0);
    this.setActive(false);
    this.setVisible(false);
    this.disableBody(true, true);
  }

  playIdle(): void {
    this.play(`${this.id}-idle`, true);
  }

  playRun(): void {
    this.play(`${this.id}-run`, true);
  }

  playShoot(): void {
    this.play(`${this.id}-shoot`, true);
  }
}
