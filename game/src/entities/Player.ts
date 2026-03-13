import Phaser from 'phaser';
import { ProjectileSystem } from '../systems/ProjectileSystem';

const MOVE_SPEED = 220;
const JUMP_SPEED = 420;
const DEFAULT_MAX_HEALTH = 100;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private shootKey: Phaser.Input.Keyboard.Key;
  private lookDirection: 1 | -1 = 1;
  private projectileSystem: ProjectileSystem;
  private healthPoints = DEFAULT_MAX_HEALTH;

  constructor(scene: Phaser.Scene, x: number, y: number, projectileSystem: ProjectileSystem) {
    super(scene, x, y, 'player-placeholder');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setSize(32, 48);

    this.projectileSystem = projectileSystem;
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available in this scene.');
    }

    this.cursors = keyboard.createCursorKeys();
    this.shootKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  update(): void {
    if (this.cursors.left?.isDown) {
      this.setVelocityX(-MOVE_SPEED);
      this.lookDirection = -1;
      this.setFlipX(true);
    } else if (this.cursors.right?.isDown) {
      this.setVelocityX(MOVE_SPEED);
      this.lookDirection = 1;
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    const body = this.body as Phaser.Physics.Arcade.Body | null;

    if (this.cursors.up?.isDown && body?.blocked.down) {
      this.setVelocityY(-JUMP_SPEED);
    }

    if (Phaser.Input.Keyboard.JustDown(this.shootKey)) {
      this.projectileSystem.tryFire({
        originX: this.x + this.lookDirection * 24,
        originY: this.y - 6,
        direction: this.lookDirection
      });
    }
  }

  takeDamage(amount: number): void {
    if (amount <= 0 || !this.active) {
      return;
    }

    this.healthPoints = Math.max(0, this.healthPoints - amount);
  }

  getHealth(): number {
    return this.healthPoints;
  }
}
