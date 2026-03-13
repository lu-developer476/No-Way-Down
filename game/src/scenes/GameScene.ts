import Phaser from 'phaser';
import { Player } from '../entities/Player';

export class GameScene extends Phaser.Scene {
  private player?: Player;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const levelWidth = 1600;
    const levelHeight = this.scale.height;
    const groundHeight = 64;

    this.physics.world.setBounds(0, 0, levelWidth, levelHeight);
    this.cameras.main.setBounds(0, 0, levelWidth, levelHeight);

    this.add.rectangle(levelWidth / 2, levelHeight / 2, levelWidth, levelHeight, 0x1f2937);
    this.add.rectangle(levelWidth / 2, levelHeight - groundHeight / 2, levelWidth, groundHeight, 0x334155);

    const ground = this.physics.add.staticGroup();
    ground.create(levelWidth / 2, levelHeight - groundHeight / 2, 'ground-placeholder')
      .setDisplaySize(levelWidth, groundHeight)
      .refreshBody();

    this.player = new Player(this, 120, levelHeight - 140);
    this.physics.add.collider(this.player, ground);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBackgroundColor('#111827');

    this.add.text(16, 16, 'No Way Down - Etapa 2', {
      color: '#f9fafb',
      fontSize: '18px'
    }).setScrollFactor(0);
    this.add.text(16, 40, 'Mover: ← → | Saltar: ↑', {
      color: '#cbd5e1',
      fontSize: '14px'
    }).setScrollFactor(0);
  }

  update(): void {
    this.player?.update();
  }
}
