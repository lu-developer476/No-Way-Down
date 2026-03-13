import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ZombieSystem } from '../systems/ZombieSystem';
import { MissionObjective, MissionSystem } from '../systems/MissionSystem';
import { StaircaseSystem, StairTransitionTarget } from '../systems/StaircaseSystem';
import { AllySystem } from '../systems/AllySystem';
import { getActivePlayerConfigs } from '../config/localMultiplayer';
import { PlayerProgressPayload, progressApi } from '../services/progressApi';

const PLAYER_CONTACT_DAMAGE = 10;
const PLAYER_RESPAWN_DELAY_MS = 1800;
const MAX_PLAYER_SEPARATION_PX = 320;
const DEFAULT_PLAYER_ID = 'local-player';
const API_MESSAGE_DURATION_MS = 2600;

interface PlatformConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RespawnPoint {
  x: number;
  y: number;
}

interface GameSceneData {
  respawnPoint?: RespawnPoint;
  skipLoad?: boolean;
}

export class GameScene extends Phaser.Scene {
  private players: Player[] = [];
  private projectileSystem?: ProjectileSystem;
  private zombieSystem?: ZombieSystem;
  private missionSystem?: MissionSystem;
  private staircaseSystem?: StaircaseSystem;
  private allySystem?: AllySystem;
  private missionStatusText?: Phaser.GameObjects.Text;
  private transitionOverlay?: Phaser.GameObjects.Rectangle;
  private transitionText?: Phaser.GameObjects.Text;
  private apiStatusText?: Phaser.GameObjects.Text;
  private hasTriggeredTransition = false;
  private hasPlayerBeenDefeated = false;
  private respawnPoint?: RespawnPoint;

  constructor() {
    super('GameScene');
  }

  create(data: GameSceneData = {}): void {
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

    this.respawnPoint = this.resolveRespawnPoint(data, {
      x: 140,
      y: levelHeight - 140
    });

    const activePlayerConfigs = getActivePlayerConfigs();
    this.players = activePlayerConfigs.map((config, index) => new Player(
      this,
      this.respawnPoint!.x + index * 42,
      this.respawnPoint!.y,
      this.projectileSystem!,
      config
    ));

    this.zombieSystem = new ZombieSystem(this);
    this.allySystem = new AllySystem(this);

    this.players.forEach((player) => {
      this.physics.add.collider(player, environment);
      this.physics.add.overlap(player, this.zombieSystem?.getGroup()!, () => this.handlePlayerZombieOverlap(player), undefined, this);
      this.zombieSystem?.createColliders(environment, player);
    });

    this.zombieSystem.createProjectileOverlap(this.projectileSystem.getGroup());
    this.allySystem.createEnvironmentColliders(environment);
    this.allySystem.createZombieOverlap(this.zombieSystem.getGroup());

    [560, 1030, 1460, 1860, 2060].forEach((spawnX) => {
      this.zombieSystem?.spawn(spawnX, levelHeight - 140);
    });

    const leadPlayer = this.players[0];
    if (leadPlayer) {
      this.allySystem.spawnInitialAllies(leadPlayer);
    }

    this.setupMissionSystem();
    this.staircaseSystem = new StaircaseSystem(this, this.players);
    this.staircaseSystem.registerStair({
      id: 'dining-to-upper',
      x: stairsX,
      y: stairsY,
      width: 150,
      height: 110,
      prompt: 'Mantén E para subir al siguiente piso',
      activeLabel: 'ESCALERA\nACTIVA',
      inactiveLabel: 'ESCALERA\nBLOQUEADA',
      target: {
        sceneKey: 'UpperFloorScene',
        spawnPoint: { x: 220, y: levelHeight - 140 }
      }
    });
    this.createMissionStatusUI();

    this.cameras.main.setBackgroundColor('#0f172a');

    this.add.text(16, 16, 'No Way Down - Etapa 13', {
      color: '#f8fafc',
      fontSize: '18px'
    }).setScrollFactor(0);
    this.add.text(
      16,
      40,
      'P1: ← → / ↑ / SPACE | P2: A D / W / F | O: cargar | P: guardar',
      {
        color: '#cbd5e1',
        fontSize: '14px'
      }
    ).setScrollFactor(0);

    this.registry.set('playerHealth', this.getTeamHealthTotal());
    this.registry.set('zombiesRemaining', this.zombieSystem.getActiveCount());
    this.registry.set('currentObjective', this.missionSystem?.getActiveObjectiveText() ?? '');

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    this.registerApiControls();

    if (!data.skipLoad) {
      void this.loadProgressFromApi();
    }
  }

  update(): void {
    this.players.forEach((player) => player.update());
    this.enforcePlayerSeparation();
    this.updateSharedCamera();

    const leadPlayerX = this.getAveragePlayerPosition().x;
    this.zombieSystem?.update(leadPlayerX);

    const leadPlayer = this.players[0];
    if (leadPlayer) {
      this.allySystem?.update(leadPlayer, this.zombieSystem?.getActiveZombies() ?? [], this.time.now);
    }

    this.registry.set('playerHealth', this.getTeamHealthTotal());

    const zombiesRemaining = this.zombieSystem?.getActiveCount() ?? 0;
    this.registry.set('zombiesRemaining', zombiesRemaining);

    this.updateMissionProgress(zombiesRemaining);

    if (!this.hasPlayerBeenDefeated) {
      this.staircaseSystem?.update((target) => {
        this.triggerPlaceholderTransition(target);
      });
    }

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
    if (!this.missionSystem || this.hasPlayerBeenDefeated) {
      return;
    }

    const completedObjective = this.missionSystem.update({ zombiesRemaining });

    if (completedObjective) {
      this.registry.set('currentObjective', completedObjective.completedDescription);
      this.showMissionStatus('Misión completada: escuadrón despejado');
      this.staircaseSystem?.unlock('dining-to-upper');
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

    this.apiStatusText = this.add.text(this.scale.width / 2, 132, '', {
      color: '#bfdbfe',
      fontSize: '18px',
      backgroundColor: '#0b1120',
      padding: { x: 10, y: 6 }
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(11)
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

  private triggerPlaceholderTransition(target: StairTransitionTarget): void {
    if (this.hasTriggeredTransition || this.hasPlayerBeenDefeated) {
      return;
    }

    this.hasTriggeredTransition = true;
    this.physics.pause();

    this.transitionOverlay?.setVisible(true);
    this.transitionText
      ?.setText('Subiendo al siguiente nivel...')
      .setVisible(true);

    this.time.delayedCall(500, () => {
      this.scene.start(target.sceneKey, { respawnPoint: target.spawnPoint });
    });
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

  private handlePlayerZombieOverlap(player: Player): void {
    if (this.hasPlayerBeenDefeated) {
      return;
    }

    const didTakeDamage = player.takeDamage(PLAYER_CONTACT_DAMAGE, this.time.now);
    if (!didTakeDamage) {
      return;
    }

    this.registry.set('playerHealth', this.getTeamHealthTotal());

    if (player.isDead()) {
      this.handlePlayerDefeat();
    }
  }

  private handlePlayerDefeat(): void {
    if (this.hasPlayerBeenDefeated) {
      return;
    }

    this.hasPlayerBeenDefeated = true;
    this.physics.pause();

    this.transitionOverlay?.setVisible(true);
    this.transitionText
      ?.setText('Un jugador ha caído en combate.\nReiniciando...')
      .setStyle({ color: '#fecaca' })
      .setVisible(true);

    this.time.delayedCall(PLAYER_RESPAWN_DELAY_MS, () => {
      this.scene.restart({ respawnPoint: this.respawnPoint });
    });
  }

  private resolveRespawnPoint(data: GameSceneData, fallback: RespawnPoint): RespawnPoint {
    const checkpoint = this.registry.get('checkpoint') as RespawnPoint | undefined;
    if (checkpoint?.x !== undefined && checkpoint?.y !== undefined) {
      return checkpoint;
    }

    if (data.respawnPoint?.x !== undefined && data.respawnPoint?.y !== undefined) {
      return data.respawnPoint;
    }

    return fallback;
  }

  private getTeamHealthTotal(): number {
    return this.players.reduce((acc, player) => acc + player.getHealth(), 0);
  }

  private getAveragePlayerPosition(): Phaser.Math.Vector2 {
    if (this.players.length === 0) {
      return new Phaser.Math.Vector2(0, 0);
    }

    const totals = this.players.reduce(
      (acc, player) => ({ x: acc.x + player.x, y: acc.y + player.y }),
      { x: 0, y: 0 }
    );

    return new Phaser.Math.Vector2(totals.x / this.players.length, totals.y / this.players.length);
  }

  private updateSharedCamera(): void {
    const center = this.getAveragePlayerPosition();
    const camera = this.cameras.main;
    const lerpFactor = 0.08;

    const targetScrollX = center.x - camera.width / 2;
    const targetScrollY = center.y - camera.height / 2;

    camera.scrollX = Phaser.Math.Linear(camera.scrollX, targetScrollX, lerpFactor);
    camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetScrollY, lerpFactor);
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
    const checkpoint = this.respawnPoint ?? { x: 140, y: this.scale.height - 140 };

    return {
      user_id: this.getPlayerId(),
      current_level: this.scene.key,
      life: this.players.filter((player) => !player.isDead()).length,
      allies_rescued: 0,
      checkpoint: `${Math.round(checkpoint.x)},${Math.round(checkpoint.y)}`
    };
  }

  private parseCheckpoint(value: string): RespawnPoint | undefined {
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

      if (loadedCheckpoint) {
        this.registry.set('checkpoint', loadedCheckpoint);
      }

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
