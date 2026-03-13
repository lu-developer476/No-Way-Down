import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ZombieSystem } from '../systems/ZombieSystem';

export class GameScene extends Phaser.Scene {
  private player?: Player;
  private projectileSystem?: ProjectileSystem;
  private zombieSystem?: ZombieSystem;

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

    this.projectileSystem = new ProjectileSystem(this);
    this.player = new Player(this, 120, levelHeight - 140, this.projectileSystem);
    this.zombieSystem = new ZombieSystem(this);

    this.physics.add.collider(this.player, ground);
    this.zombieSystem.createColliders(ground, this.player);
    this.zombieSystem.createProjectileOverlap(this.projectileSystem.getGroup());

    this.zombieSystem.spawn(700, levelHeight - 140);
    this.zombieSystem.spawn(1050, levelHeight - 140);
    this.zombieSystem.spawn(1380, levelHeight - 140);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBackgroundColor('#111827');

    this.add.text(16, 16, 'No Way Down - Etapa 4', {
      color: '#f9fafb',
      fontSize: '18px'
    }).setScrollFactor(0);
    this.add.text(16, 40, 'Mover: ← → | Saltar: ↑ | Disparar: SPACE', {
      color: '#cbd5e1',
      fontSize: '14px'
    }).setScrollFactor(0);
  }

  update(): void {
    this.player?.update();

    if (this.player) {
      this.zombieSystem?.update(this.player.x);
    }

    this.projectileSystem?.update();
  }
}
