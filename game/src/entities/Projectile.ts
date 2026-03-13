import Phaser from 'phaser';

export class Projectile extends Phaser.Physics.Arcade.Image {
  private speed = 0;
  private direction = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet-placeholder');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
  }

  launch(x: number, y: number, direction: number, speed: number): void {
    this.speed = speed;
    this.direction = direction;

    this.enableBody(true, x, y, true, true);
    this.setVelocityX(this.direction * this.speed);
  }

  deactivate(): void {
    this.disableBody(true, true);
  }

  isOutOfBounds(worldBounds: Phaser.Geom.Rectangle): boolean {
    return this.x < worldBounds.left - 24 || this.x > worldBounds.right + 24;
  }
}
