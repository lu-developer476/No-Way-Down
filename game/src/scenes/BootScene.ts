import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    // Generamos texturas placeholder para no depender de assets externos en esta etapa.
    const graphics = this.add.graphics();

    graphics.fillStyle(0xeab308, 1);
    graphics.fillRect(0, 0, 32, 48);
    graphics.generateTexture('player-placeholder', 32, 48);

    graphics.clear();
    graphics.fillStyle(0x475569, 1);
    graphics.fillRect(0, 0, 64, 64);
    graphics.generateTexture('ground-placeholder', 64, 64);

    graphics.destroy();

    this.scene.start('GameScene');
  }
}
