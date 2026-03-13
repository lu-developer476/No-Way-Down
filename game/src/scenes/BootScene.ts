import Phaser from 'phaser';
import { visualTheme } from './visualTheme';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const graphics = this.add.graphics();
    const { palette } = visualTheme;

    graphics.fillStyle(palette.player, 1);
    graphics.fillRect(10, 4, 12, 12);
    graphics.fillStyle(0x1f2937, 1);
    graphics.fillRect(6, 16, 20, 20);
    graphics.fillStyle(0xb45309, 1);
    graphics.fillRect(6, 36, 20, 10);
    graphics.fillStyle(0xf8fafc, 1);
    graphics.fillRect(12, 10, 2, 2);
    graphics.fillRect(18, 10, 2, 2);
    graphics.generateTexture('player-placeholder', 32, 48);

    graphics.clear();
    graphics.fillStyle(palette.platformTop, 1);
    graphics.fillRect(0, 0, 64, 16);
    graphics.fillStyle(palette.platformEdge, 1);
    graphics.fillRect(0, 16, 64, 36);
    graphics.fillStyle(0x202839, 1);
    for (let x = 2; x < 64; x += 10) {
      graphics.fillRect(x, 24, 6, 2);
      graphics.fillRect(x + 3, 34, 4, 2);
    }
    graphics.fillStyle(0x465472, 1);
    for (let x = 4; x < 64; x += 8) {
      graphics.fillRect(x, 2, 5, 2);
    }
    graphics.generateTexture('ground-placeholder', 64, 52);

    graphics.clear();
    graphics.fillStyle(palette.bullet, 1);
    graphics.fillRect(0, 4, 12, 4);
    graphics.fillStyle(0xd97706, 1);
    graphics.fillRect(9, 4, 3, 4);
    graphics.generateTexture('bullet-placeholder', 12, 12);

    graphics.clear();
    graphics.fillStyle(palette.zombie, 1);
    graphics.fillRect(9, 6, 14, 10);
    graphics.fillStyle(0x2f3a2f, 1);
    graphics.fillRect(6, 16, 20, 20);
    graphics.fillStyle(0x6b1f1f, 1);
    graphics.fillRect(6, 36, 20, 10);
    graphics.fillStyle(0xfef08a, 1);
    graphics.fillRect(11, 10, 2, 2);
    graphics.fillRect(19, 10, 2, 2);
    graphics.generateTexture('zombie-placeholder', 32, 48);

    graphics.clear();
    graphics.fillStyle(0x4b5563, 1);
    graphics.fillRect(0, 0, 32, 48);
    graphics.fillStyle(0x94a3b8, 1);
    for (let y = 3; y < 48; y += 8) {
      graphics.fillRect(5, y, 22, 2);
    }
    graphics.fillStyle(0x1f2937, 1);
    graphics.fillRect(12, 0, 8, 48);
    graphics.generateTexture('stair-placeholder', 32, 48);

    graphics.destroy();

    this.scene.start('GameScene');
  }
}
