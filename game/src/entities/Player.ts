import Phaser from 'phaser';

const MOVE_SPEED = 220;
const JUMP_SPEED = 420;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-placeholder');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setSize(32, 48);

    this.cursors = scene.input.keyboard.createCursorKeys();
  }

  update(): void {
    if (this.cursors.left?.isDown) {
      this.setVelocityX(-MOVE_SPEED);
      this.setFlipX(true);
    } else if (this.cursors.right?.isDown) {
      this.setVelocityX(MOVE_SPEED);
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    if (this.cursors.up?.isDown && this.body.blocked.down) {
      this.setVelocityY(-JUMP_SPEED);
    }
  }
}
