import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { StaircaseSystem, StairTransitionTarget } from '../systems/StaircaseSystem';

interface UpperFloorSceneData {
  respawnPoint?: {
    x: number;
    y: number;
  };
}

export class UpperFloorScene extends Phaser.Scene {
  private player?: Player;
  private projectileSystem?: ProjectileSystem;
  private staircaseSystem?: StaircaseSystem;
  private transitionOverlay?: Phaser.GameObjects.Rectangle;
  private transitionText?: Phaser.GameObjects.Text;
  private hasTriggeredTransition = false;

  constructor() {
    super('UpperFloorScene');
  }

  create(data: UpperFloorSceneData = {}): void {
    const levelWidth = 1200;
    const levelHeight = this.scale.height;
    const floorHeight = 64;

    this.physics.world.setBounds(0, 0, levelWidth, levelHeight);
    this.cameras.main.setBounds(0, 0, levelWidth, levelHeight);

    this.add.rectangle(levelWidth / 2, levelHeight / 2, levelWidth, levelHeight, 0x0f172a);
    this.add.rectangle(levelWidth / 2, levelHeight / 2 - 70, levelWidth, 180, 0x1e293b);
    this.add.rectangle(levelWidth / 2, levelHeight - floorHeight / 2, levelWidth, floorHeight, 0x334155);

    const environment = this.physics.add.staticGroup();
    environment.create(levelWidth / 2, levelHeight - floorHeight / 2, 'ground-placeholder')
      .setDisplaySize(levelWidth, floorHeight)
      .refreshBody();

    this.projectileSystem = new ProjectileSystem(this);

    const spawnPoint = data.respawnPoint ?? { x: 140, y: levelHeight - 130 };
    this.player = new Player(this, spawnPoint.x, spawnPoint.y, this.projectileSystem);

    this.physics.add.collider(this.player, environment);

    this.staircaseSystem = new StaircaseSystem(this, this.player);
    this.staircaseSystem.registerStair({
      id: 'upper-to-dining',
      x: 120,
      y: levelHeight - 94,
      width: 150,
      height: 108,
      prompt: 'Mantén E para bajar al comedor',
      activeLabel: 'ESCALERA\nBAJADA',
      target: {
        sceneKey: 'GameScene',
        spawnPoint: { x: levelWidth - 200, y: levelHeight - 140 }
      },
      startsUnlocked: true
    });

    this.createTransitionUI();

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.registry.set('currentObjective', 'Explora el piso superior y regresa cuando quieras.');

    this.add.text(16, 16, 'No Way Down - Etapa 9 (Piso Superior placeholder)', {
      color: '#f8fafc',
      fontSize: '18px'
    }).setScrollFactor(0);
  }

  update(): void {
    this.player?.update();
    this.projectileSystem?.update();

    if (this.hasTriggeredTransition) {
      return;
    }

    this.staircaseSystem?.update((target) => {
      this.transitionToTarget(target);
    });
  }

  private createTransitionUI(): void {
    this.transitionOverlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x020617,
      0.9
    )
      .setScrollFactor(0)
      .setDepth(20)
      .setVisible(false);

    this.transitionText = this.add.text(this.scale.width / 2, this.scale.height / 2, '', {
      color: '#e2e8f0',
      fontSize: '24px',
      align: 'center'
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setVisible(false);
  }

  private transitionToTarget(target: StairTransitionTarget): void {
    if (this.hasTriggeredTransition) {
      return;
    }

    this.hasTriggeredTransition = true;
    this.physics.pause();

    this.transitionOverlay?.setVisible(true);
    this.transitionText?.setText('Bajando al nivel anterior...').setVisible(true);

    this.time.delayedCall(500, () => {
      this.scene.start(target.sceneKey, { respawnPoint: target.spawnPoint });
    });
  }
}
