import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { StaircaseSystem, StairTransitionTarget } from '../systems/StaircaseSystem';
import { getActivePlayerConfigs } from '../config/localMultiplayer';
import { PlayerProgressPayload, progressApi } from '../services/progressApi';

const MAX_PLAYER_SEPARATION_PX = 320;
const DEFAULT_PLAYER_ID = 'local-player';
const API_MESSAGE_DURATION_MS = 2600;

interface UpperFloorSceneData {
  respawnPoint?: {
    x: number;
    y: number;
  };
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

  private registerApiControls(): void {
    this.input.keyboard?.on('keydown-P', () => {
      void this.saveProgressToApi();
    });

    this.input.keyboard?.on('keydown-O', () => {
      void this.loadProgressFromApi();
    });
  }

  private getPlayerId(): string {
    return import.meta.env.VITE_PLAYER_ID ?? DEFAULT_PLAYER_ID;
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

  private parseCheckpoint(value: string): { x: number; y: number } | undefined {
    const [xPart, yPart] = value.split(',');
    const x = Number(xPart);
    const y = Number(yPart);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return undefined;
    }

    return { x, y };
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
      const loadedCheckpoint = this.parseCheckpoint(progress.checkpoint);
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
