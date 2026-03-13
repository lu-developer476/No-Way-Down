import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { StaircaseSystem, StairTransitionTarget } from '../systems/StaircaseSystem';
import { getActivePlayerConfigs } from '../config/localMultiplayer';
import { PlayerProgressPayload, progressApi } from '../services/progressApi';
import {
  Checkpoint,
  enforceMaxPlayerSeparation,
  getAveragePlayerPosition,
  getScenePlayerId,
  parseCheckpoint
} from './sceneShared';
import { visualTheme } from './visualTheme';

const API_MESSAGE_DURATION_MS = 2600;
const ARCADE_CAMERA_ZOOM = 1.2;

interface UpperFloorSceneData {
  respawnPoint?: Checkpoint;
  skipLoad?: boolean;
}

export class UpperFloorScene extends Phaser.Scene {
  private players: Player[] = [];
  private projectileSystem?: ProjectileSystem;
  private staircaseSystem?: StaircaseSystem;
  private transitionOverlay?: Phaser.GameObjects.Rectangle;
  private transitionText?: Phaser.GameObjects.Text;
  private apiStatusText?: Phaser.GameObjects.Text;
  private hasTriggeredTransition = false;

  constructor() {
    super('UpperFloorScene');
  }

  create(data: UpperFloorSceneData = {}): void {
    const levelWidth = 1200;
    const levelHeight = this.scale.height;
    const floorHeight = 64;

    this.physics.world.setBounds(0, 0, levelWidth, levelHeight);
    this.cameras.main
      .setBounds(0, 0, levelWidth, levelHeight)
      .setZoom(ARCADE_CAMERA_ZOOM)
      .setRoundPixels(true);

    this.drawUpperFloorBackground(levelWidth, levelHeight, floorHeight);

    const environment = this.physics.add.staticGroup();
    environment.create(levelWidth / 2, levelHeight - floorHeight / 2, 'ground-placeholder')
      .setDisplaySize(levelWidth, floorHeight)
      .refreshBody()
      .setDepth(4);

    this.add.rectangle(levelWidth / 2, levelHeight - floorHeight + 8, levelWidth, 8, visualTheme.palette.platformTop).setDepth(5);

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

    this.addStairVisual(120, levelHeight - 94, 150, 108);
    this.createTransitionUI();
    this.registry.set('currentObjective', 'Explora el piso superior y regresa cuando quieras.');

    this.add.text(16, 16, 'No Way Down - Etapa 13 (Piso Superior)', {
      color: '#f8fafc',
      fontSize: '18px'
    }).setScrollFactor(0);
    this.add.text(16, 40, 'O: cargar | P: guardar', {
      color: '#cbd5e1',
      fontSize: '14px'
    }).setScrollFactor(0);

    this.registerApiControls();

    if (!data.skipLoad) {
      void this.loadProgressFromApi();
    }
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

  private drawUpperFloorBackground(levelWidth: number, levelHeight: number, floorHeight: number): void {
    const { palette } = visualTheme;
    const backdrop = this.add.graphics();
    backdrop.fillGradientStyle(palette.skyTop, palette.skyTop, palette.skyBottom, palette.skyBottom, 1);
    backdrop.fillRect(0, 0, levelWidth, levelHeight);
    backdrop.fillStyle(0x1a2235, 1);
    backdrop.fillRect(0, 68, levelWidth, 130);
    backdrop.fillStyle(0x263248, 1);
    backdrop.fillRect(0, 170, levelWidth, 138);
    backdrop.fillStyle(0x2f3d56, 1);
    backdrop.fillRect(0, levelHeight - floorHeight - 62, levelWidth, 62);
    backdrop.destroy();

    for (let x = 80; x < levelWidth; x += 170) {
      this.add.rectangle(x, 110, 58, 40, 0x0f172a, 0.65).setDepth(1);
      this.add.rectangle(x, 110, 52, 34, 0x38bdf8, 0.09).setDepth(1);
      this.add.rectangle(x, 42, 52, 8, palette.lamp, 0.23).setDepth(2);
    }


    for (let x = 120; x < levelWidth; x += 260) {
      this.add.rectangle(x, 190, 120, 56, 0x0c1220, 0.34).setDepth(1).setScrollFactor(0.5, 1);
      this.add.rectangle(x - 34, 190, 20, 56, 0x334155, 0.24).setDepth(1).setScrollFactor(0.5, 1);
      this.add.rectangle(x + 38, 190, 16, 56, 0x1f2937, 0.32).setDepth(1).setScrollFactor(0.5, 1);
    }

    for (let x = 100; x < levelWidth; x += 200) {
      this.add.rectangle(x, levelHeight - floorHeight - 120, 14, 140, 0x64748b, 0.4).setDepth(2);
    }

    for (let x = 180; x < levelWidth; x += 300) {
      this.add.rectangle(x, levelHeight - floorHeight - 54, 90, 26, 0x0f172a, 0.52).setDepth(3).setScrollFactor(0.88, 1);
      this.add.rectangle(x + 34, levelHeight - floorHeight - 56, 20, 8, 0xeab308, 0.22).setDepth(3).setScrollFactor(0.88, 1);
    }
  }

  private addStairVisual(x: number, y: number, width: number, height: number): void {
    this.add.tileSprite(x, y + 4, width, height, 'stair-placeholder').setDepth(7).setAlpha(0.9);
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

    this.apiStatusText = this.add.text(this.scale.width / 2, 100, '', {
      color: '#bfdbfe',
      fontSize: '18px',
      backgroundColor: '#0b1120',
      padding: { x: 10, y: 6 }
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(22)
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
    const center = getAveragePlayerPosition(this.players);
    const camera = this.cameras.main;
    const velocityLookAhead = this.players.length > 0
      ? this.players.reduce((acc, player) => {
          const body = player.body as Phaser.Physics.Arcade.Body | null;
          return acc + (body?.velocity.x ?? 0);
        }, 0) / this.players.length
      : 0;
    const lookAheadX = Phaser.Math.Clamp(velocityLookAhead * 0.18, -70, 70);
    const focusYOffset = 30;

    const visibleWidth = camera.width / camera.zoom;
    const visibleHeight = camera.height / camera.zoom;

    camera.scrollX = Phaser.Math.Linear(camera.scrollX, center.x + lookAheadX - visibleWidth / 2, 0.08);
    camera.scrollY = Phaser.Math.Linear(camera.scrollY, center.y + focusYOffset - visibleHeight / 2, 0.08);
  }

  private enforcePlayerSeparation(): void {
    enforceMaxPlayerSeparation(this.players);
  }

  private registerApiControls(): void {
    this.input.keyboard?.on('keydown-P', () => {
      void this.saveProgressToApi();
    });

    this.input.keyboard?.on('keydown-O', () => {
      void this.loadProgressFromApi();
    });
  }

  private getPlayerId(): string {
    return getScenePlayerId();
  }

  private buildProgressPayload(): PlayerProgressPayload {
    const checkpoint = this.players[0] ? { x: this.players[0].x, y: this.players[0].y } : { x: 140, y: this.scale.height - 130 };

    return {
      user_id: this.getPlayerId(),
      current_level: this.scene.key,
      life: this.players.filter((player) => !player.isDead()).length,
      allies_rescued: 0,
      checkpoint: `${Math.round(checkpoint.x)},${Math.round(checkpoint.y)}`
    };
  }

  private async saveProgressToApi(): Promise<void> {
    try {
      await progressApi.saveProgress(this.buildProgressPayload());
      this.showApiStatus('Progreso guardado en servidor.', false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar progreso.';
      this.showApiStatus(`No se pudo guardar: ${message}`, true);
    }
  }

  private async loadProgressFromApi(): Promise<void> {
    try {
      const progress = await progressApi.loadProgress(this.getPlayerId());
      const loadedCheckpoint = parseCheckpoint(progress.checkpoint);
      this.showApiStatus('Partida cargada desde servidor.', false);

      if (progress.current_level !== this.scene.key) {
        this.scene.start(progress.current_level, { respawnPoint: loadedCheckpoint, skipLoad: true });
        return;
      }

      this.scene.restart({ respawnPoint: loadedCheckpoint, skipLoad: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar progreso.';
      this.showApiStatus(`No se pudo cargar: ${message}`, true);
    }
  }

  private showApiStatus(message: string, isError: boolean): void {
    this.apiStatusText
      ?.setText(message)
      .setStyle({
        color: isError ? '#fecaca' : '#bfdbfe',
        backgroundColor: isError ? '#450a0a' : '#0b1120'
      })
      .setVisible(true);

    this.time.delayedCall(API_MESSAGE_DURATION_MS, () => {
      this.apiStatusText?.setVisible(false);
    });
  }
}
