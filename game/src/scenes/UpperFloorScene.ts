import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { StaircaseSystem, StairTransitionTarget } from '../systems/StaircaseSystem';
import { getActivePlayerConfigs } from '../config/localMultiplayer';

const MAX_PLAYER_SEPARATION_PX = 320;

interface UpperFloorSceneData {
  respawnPoint?: {
    x: number;
    y: number;
  };
}

export class UpperFloorScene extends Phaser.Scene {
  private players: Player[] = [];
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
    const activePlayerConfigs = getActivePlayerConfigs();
    this.players = activePlayerConfigs.map((config, index) => new Player(
      this,
      spawnPoint.x + index * 42,
      spawnPoint.y,
      this.projectileSystem!,
      config
    ));

    this.players.forEach((player) => {
      this.physics.add.collider(player, environment);
    });

    this.staircaseSystem = new StaircaseSystem(this, this.players);
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
    this.registry.set('currentObjective', 'Explora el piso superior y regresa cuando quieras.');

    this.add.text(16, 16, 'No Way Down - Etapa 11 (Piso Superior placeholder)', {
      color: '#f8fafc',
      fontSize: '18px'
    }).setScrollFactor(0);
  }

  update(): void {
    this.players.forEach((player) => player.update());
    this.enforcePlayerSeparation();
    this.updateSharedCamera();
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

  private updateSharedCamera(): void {
    if (this.players.length === 0) {
      return;
    }

    const center = this.players.reduce(
      (acc, player) => ({ x: acc.x + player.x, y: acc.y + player.y }),
      { x: 0, y: 0 }
    );

    const averageX = center.x / this.players.length;
    const averageY = center.y / this.players.length;
    const camera = this.cameras.main;

    camera.scrollX = Phaser.Math.Linear(camera.scrollX, averageX - camera.width / 2, 0.08);
    camera.scrollY = Phaser.Math.Linear(camera.scrollY, averageY - camera.height / 2, 0.08);
  }

  private enforcePlayerSeparation(): void {
    if (this.players.length <= 1) {
      return;
    }

    const p1 = this.players[0];
    const p2 = this.players[1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= MAX_PLAYER_SEPARATION_PX || distance === 0) {
      return;
    }

    const midpointX = (p1.x + p2.x) / 2;
    const midpointY = (p1.y + p2.y) / 2;
    const normalizedX = dx / distance;
    const normalizedY = dy / distance;
    const allowedHalfDistance = MAX_PLAYER_SEPARATION_PX / 2;

    p1.setPosition(midpointX - normalizedX * allowedHalfDistance, midpointY - normalizedY * allowedHalfDistance);
    p2.setPosition(midpointX + normalizedX * allowedHalfDistance, midpointY + normalizedY * allowedHalfDistance);
  }
}
