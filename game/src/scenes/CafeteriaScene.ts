import Phaser from 'phaser';

export class CafeteriaScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private player?: Phaser.Physics.Arcade.Sprite;

  constructor() {
    super('CafeteriaScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(width / 2, height / 2, width, height, 0x1f2937).setOrigin(0.5);
    this.add.rectangle(width / 2, height - 40, width, 80, 0x374151).setOrigin(0.5);

    const platform = this.physics.add.staticImage(width / 2, height - 20, undefined)
      .setDisplaySize(width, 40)
      .refreshBody();
    platform.setVisible(false);

    this.player = this.physics.add.sprite(120, height - 100, undefined)
      .setDisplaySize(32, 48)
      .setTint(0xf59e0b)
      .setCollideWorldBounds(true);

    this.player.body.setSize(32, 48);
    this.physics.add.collider(this.player, platform);

    this.cursors = this.input.keyboard.createCursorKeys();

    this.add.text(16, 16, 'No Way Down - Etapa 1 (Scaffold)', {
      color: '#f9fafb',
      fontSize: '18px'
    });
    this.add.text(16, 40, 'Placeholder comedor BNA: mover con flechas y saltar con ↑', {
      color: '#d1d5db',
      fontSize: '14px'
    });
  }

  update(): void {
    if (!this.player || !this.cursors) return;

    const speed = 220;

    if (this.cursors.left?.isDown) {
      this.player.setVelocityX(-speed);
    } else if (this.cursors.right?.isDown) {
      this.player.setVelocityX(speed);
    } else {
      this.player.setVelocityX(0);
    }

    const isOnFloor = this.player.body.blocked.down;
    if (this.cursors.up?.isDown && isOnFloor) {
      this.player.setVelocityY(-420);
    }
  }
}
