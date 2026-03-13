import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ZombieSystem } from '../systems/ZombieSystem';

const PLAYER_CONTACT_DAMAGE = 10;
const PLAYER_DAMAGE_COOLDOWN_MS = 800;

interface PlatformConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class GameScene extends Phaser.Scene {
  private player?: Player;
  private projectileSystem?: ProjectileSystem;
  private zombieSystem?: ZombieSystem;
  private lastDamageTimestamp = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    const levelWidth = 2200;
    const levelHeight = this.scale.height;
    const floorHeight = 64;
    const floorY = levelHeight - floorHeight / 2;
    const tableTopY = levelHeight - 146;

    this.physics.world.setBounds(0, 0, levelWidth, levelHeight);
    this.cameras.main.setBounds(0, 0, levelWidth, levelHeight);

    this.drawDiningHallBackground(levelWidth, levelHeight, floorHeight);

    const environment = this.physics.add.staticGroup();

    this.createPlatform(environment, {
      x: levelWidth / 2,
      y: floorY,
      width: levelWidth,
      height: floorHeight
    });

    const tablePlatforms: PlatformConfig[] = [
      { x: 420, y: tableTopY, width: 210, height: 26 },
      { x: 850, y: tableTopY, width: 210, height: 26 },
      { x: 1280, y: tableTopY, width: 210, height: 26 },
      { x: 1710, y: tableTopY, width: 210, height: 26 }
    ];

    tablePlatforms.forEach((table) => {
      this.createPlatform(environment, table);
      this.addTableVisual(table.x, table.y, table.width, table.height);
    });

    this.addBlockedStairMarker(levelWidth - 190, levelHeight - 96);

    this.projectileSystem = new ProjectileSystem(this);
    this.player = new Player(this, 140, levelHeight - 140, this.projectileSystem);
    this.zombieSystem = new ZombieSystem(this);

    this.physics.add.collider(this.player, environment);
    this.zombieSystem.createColliders(environment, this.player);
    this.zombieSystem.createProjectileOverlap(this.projectileSystem.getGroup());
    this.physics.add.overlap(this.player, this.zombieSystem.getGroup(), this.handlePlayerZombieOverlap, undefined, this);

    [560, 1030, 1460, 1860, 2060].forEach((spawnX) => {
      this.zombieSystem?.spawn(spawnX, levelHeight - 140);
    });

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBackgroundColor('#0f172a');

    this.add.text(16, 16, 'No Way Down - Etapa 6', {
      color: '#f8fafc',
      fontSize: '18px'
    }).setScrollFactor(0);
    this.add.text(16, 40, 'Comedor piso -1 | Mover: ← → | Saltar: ↑ | Disparar: SPACE', {
      color: '#cbd5e1',
      fontSize: '14px'
    }).setScrollFactor(0);

    this.registry.set('playerHealth', this.player.getHealth());
    this.registry.set('zombiesRemaining', this.zombieSystem.getActiveCount());
    this.registry.set('currentObjective', 'Explorar el comedor y buscar salida');

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }
  }

  update(): void {
    this.player?.update();

    if (this.player) {
      this.zombieSystem?.update(this.player.x);
      this.registry.set('playerHealth', this.player.getHealth());
    }

    if (this.zombieSystem) {
      this.registry.set('zombiesRemaining', this.zombieSystem.getActiveCount());
    }

    this.projectileSystem?.update();
  }

  private createPlatform(group: Phaser.Physics.Arcade.StaticGroup, config: PlatformConfig): void {
    group.create(config.x, config.y, 'ground-placeholder')
      .setDisplaySize(config.width, config.height)
      .refreshBody();
  }

  private drawDiningHallBackground(levelWidth: number, levelHeight: number, floorHeight: number): void {
    this.add.rectangle(levelWidth / 2, levelHeight / 2, levelWidth, levelHeight, 0x1f2937);
    this.add.rectangle(levelWidth / 2, levelHeight / 2 - 90, levelWidth, 170, 0x334155);
    this.add.rectangle(levelWidth / 2, levelHeight - floorHeight / 2, levelWidth, floorHeight, 0x475569);

    const dividerSpacing = 280;
    for (let x = 160; x < levelWidth; x += dividerSpacing) {
      this.add.rectangle(x, levelHeight / 2 - 96, 16, 158, 0x64748b, 0.45);
    }
  }

  private addTableVisual(x: number, y: number, width: number, height: number): void {
    this.add.rectangle(x, y, width, height, 0x7c3f16);
    this.add.rectangle(x, y + 16, width - 26, 8, 0x5b2d0e, 0.75);
  }

  private addBlockedStairMarker(x: number, y: number): void {
    this.add.rectangle(x, y, 150, 110, 0x111827, 0.85).setStrokeStyle(2, 0x94a3b8, 0.8);
    this.add.text(x - 57, y - 22, 'ESCALERA\nBLOQUEADA', {
      color: '#f87171',
      fontSize: '14px',
      align: 'center'
    });
    this.add.rectangle(x, y + 20, 120, 10, 0xdc2626, 0.9);
  }

  private handlePlayerZombieOverlap(): void {
    if (!this.player) {
      return;
    }

    const now = this.time.now;
    if (now - this.lastDamageTimestamp < PLAYER_DAMAGE_COOLDOWN_MS) {
      return;
    }

    this.player.takeDamage(PLAYER_CONTACT_DAMAGE);
    this.lastDamageTimestamp = now;
  }
}
