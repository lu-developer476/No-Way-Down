import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ZombieSystem } from '../systems/ZombieSystem';
import { MissionObjective, MissionSystem } from '../systems/MissionSystem';
import { StaircaseSystem } from '../systems/StaircaseSystem';

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
  private missionSystem?: MissionSystem;
  private staircaseSystem?: StaircaseSystem;
  private missionStatusText?: Phaser.GameObjects.Text;
  private transitionOverlay?: Phaser.GameObjects.Rectangle;
  private transitionText?: Phaser.GameObjects.Text;
  private hasTriggeredTransition = false;
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
    const stairsX = levelWidth - 190;
    const stairsY = levelHeight - 96;

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

    this.setupMissionSystem();
    this.staircaseSystem = new StaircaseSystem(this, this.player, stairsX, stairsY);
    this.createMissionStatusUI();

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBackgroundColor('#0f172a');

    this.add.text(16, 16, 'No Way Down - Etapa 7', {
      color: '#f8fafc',
      fontSize: '18px'
    }).setScrollFactor(0);
    this.add.text(16, 40, 'Comedor piso -1 | Mover: ← → | Saltar: ↑ | Disparar: SPACE | Interactuar: E', {
      color: '#cbd5e1',
      fontSize: '14px'
    }).setScrollFactor(0);

    this.registry.set('playerHealth', this.player.getHealth());
    this.registry.set('zombiesRemaining', this.zombieSystem.getActiveCount());
    this.registry.set('currentObjective', this.missionSystem?.getActiveObjectiveText() ?? '');

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

    const zombiesRemaining = this.zombieSystem?.getActiveCount() ?? 0;
    this.registry.set('zombiesRemaining', zombiesRemaining);

    this.updateMissionProgress(zombiesRemaining);

    this.staircaseSystem?.update(() => {
      this.triggerPlaceholderTransition();
    });

    this.projectileSystem?.update();
  }

  private setupMissionSystem(): void {
    const objectives: MissionObjective[] = [
      {
        id: 'clear-dining-room',
        description: 'Elimina todos los zombies del comedor',
        completedDescription: 'Comedor asegurado. La escalera está activa.',
        isCompleted: (context) => context.zombiesRemaining === 0
      }
    ];

    this.missionSystem = new MissionSystem(objectives);
  }

  private updateMissionProgress(zombiesRemaining: number): void {
    if (!this.missionSystem) {
      return;
    }

    const completedObjective = this.missionSystem.update({ zombiesRemaining });

    if (completedObjective) {
      this.registry.set('currentObjective', completedObjective.completedDescription);
      this.showMissionStatus('Misión completada: escuadrón despejado');
      this.staircaseSystem?.unlock();
    } else {
      this.registry.set('currentObjective', this.missionSystem.getActiveObjectiveText());
    }
  }

  private createMissionStatusUI(): void {
    this.missionStatusText = this.add.text(this.scale.width / 2, 98, '', {
      color: '#bbf7d0',
      fontSize: '22px',
      backgroundColor: '#052e16',
      padding: { x: 12, y: 8 }
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10)
      .setVisible(false);

    this.transitionOverlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x020617,
      0.88
    )
      .setScrollFactor(0)
      .setDepth(20)
      .setVisible(false);

    this.transitionText = this.add.text(this.scale.width / 2, this.scale.height / 2, '', {
      color: '#f8fafc',
      fontSize: '28px',
      align: 'center'
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setVisible(false);
  }

  private showMissionStatus(message: string): void {
    this.missionStatusText?.setText(message).setVisible(true);

    this.time.delayedCall(2200, () => {
      this.missionStatusText?.setVisible(false);
    });
  }

  private triggerPlaceholderTransition(): void {
    if (this.hasTriggeredTransition) {
      return;
    }

    this.hasTriggeredTransition = true;
    this.physics.pause();

    this.transitionOverlay?.setVisible(true);
    this.transitionText
      ?.setText('Subiendo al siguiente nivel...\n(Transición placeholder)')
      .setVisible(true);
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
