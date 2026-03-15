import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ZombieSystem } from '../systems/ZombieSystem';
import { MissionObjective, MissionSystem } from '../systems/MissionSystem';
import { StairSegmentSystem } from '../systems/StairSegmentSystem';
import { AllySystem } from '../systems/AllySystem';
import { ZombieWaveZone, createZombieWaveZonesFromLevelJson } from '../systems/ZombieWaveZone';
import { LevelExitSystem } from '../systems/LevelExitSystem';
import { VerticalSpawnSystem } from '../systems/VerticalSpawnSystem';
import { NarrativeCheckpointSystem } from '../systems/NarrativeCheckpointSystem';
import level2Subsuelo from '../../public/assets/levels/level2_subsuelo.json';
import stairConfigLevel2 from '../../public/assets/levels/level2_stairs.json';
import level4StairSegments from '../../public/assets/levels/level4_stair_segments.json';
import verticalSpawnConfig from '../../public/assets/levels/level2_vertical_spawns.json';
import level7NarrativeCheckpoints from '../../public/assets/levels/level7_narrative_checkpoints.json';
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
import { CampaignState } from '../systems/core/CampaignState';
import { PartyStateSystem } from '../systems/core/PartyStateSystem';
import { registerEnvironmentProfile } from '../config/environmentProfiles';

const PLAYER_CONTACT_DAMAGE = 10;
const PLAYER_RESPAWN_DELAY_MS = 1800;
const API_MESSAGE_DURATION_MS = 2600;
const ARCADE_CAMERA_ZOOM = 1.25;
const LOCAL_PROGRESS_STORAGE_KEY = 'nwd.progress.local-player';

interface PlatformConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GameSceneData {
  respawnPoint?: Checkpoint;
  skipLoad?: boolean;
}

export class GameScene extends Phaser.Scene {
  private players: Player[] = [];
  private projectileSystem?: ProjectileSystem;
  private zombieSystem?: ZombieSystem;
  private missionSystem?: MissionSystem;
  private stairSegmentSystem?: StairSegmentSystem;
  private allySystem?: AllySystem;
  private zombieWaveZoneSystem?: ZombieWaveZone;
  private levelExitSystem?: LevelExitSystem;
  private verticalSpawnSystem?: VerticalSpawnSystem;
  private narrativeCheckpointSystem?: NarrativeCheckpointSystem;
  private missionStatusText?: Phaser.GameObjects.Text;
  private transitionOverlay?: Phaser.GameObjects.Rectangle;
  private transitionText?: Phaser.GameObjects.Text;
  private apiStatusText?: Phaser.GameObjects.Text;
  private campaignState?: CampaignState;
  private partyState?: PartyStateSystem;
  private hasTriggeredTransition = false;
  private hasPlayerBeenDefeated = false;
  private respawnPoint?: Checkpoint;

  constructor() {
    super('GameScene');
  }

  create(data: GameSceneData = {}): void {
    const levelWidth = level2Subsuelo.dimensiones.anchoTotalPx;
    const levelHeight = level2Subsuelo.dimensiones.altoTotalPx;
    const floorHeight = 64;
    const floorY = levelHeight - floorHeight / 2;
    const tableTopY = levelHeight - 146;

    this.physics.world.setBounds(0, 0, levelWidth, levelHeight);
    registerEnvironmentProfile(this, 'level2_subsuelo');

    this.cameras.main
      .setBounds(0, 0, levelWidth, levelHeight)
      .setZoom(ARCADE_CAMERA_ZOOM)
      .setRoundPixels(true);

    this.drawDiningHallBackground(levelWidth, levelHeight, floorHeight);

    const environment = this.physics.add.staticGroup();

    this.createPlatform(environment, {
      x: levelWidth / 2,
      y: floorY,
      width: levelWidth,
      height: floorHeight
    });

    const tablePlatforms: PlatformConfig[] = [
      { x: 350, y: tableTopY, width: 220, height: 26 },
      { x: 760, y: tableTopY - 12, width: 240, height: 26 },
      { x: 1180, y: tableTopY + 8, width: 210, height: 26 },
      { x: 1600, y: tableTopY - 6, width: 250, height: 26 },
      { x: 1960, y: tableTopY + 12, width: 180, height: 26 }
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

    this.campaignState = new CampaignState('GameScene', {
      activeCharacters: activePlayerConfigs.map((config) => `player-${config.slot}`)
    });
    this.partyState = new PartyStateSystem(
      activePlayerConfigs.map((config) => ({
        id: `player-${config.slot}`,
        name: config.name,
        controlMode: 'human',
        status: 'active',
        permanentlyLost: false
      }))
    );

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

    [500, 910, 1330, 1720, 2040].forEach((spawnX) => {
      this.zombieSystem?.spawn(spawnX, levelHeight - 140);
    });

    const zombieWaveZonesFromJson = createZombieWaveZonesFromLevelJson(level2Subsuelo, {
      triggerSize: { width: 140, height: 220 },
      blockerWidth: 30,
      blockerPadding: 36
    });

    this.zombieWaveZoneSystem = new ZombieWaveZone(
      this,
      this.zombieSystem,
      this.players,
      zombieWaveZonesFromJson
    );

    // Ejemplo de integración: spawn vertical configurable por JSON (escaleras/puertas laterales).
    this.verticalSpawnSystem = VerticalSpawnSystem.fromJson(
      this,
      this.zombieSystem,
      this.players,
      verticalSpawnConfig
    );

    this.levelExitSystem = new LevelExitSystem(
      this,
      this.players,
      {
        requiredCleanupZones: zombieWaveZonesFromJson.length,
        exitZone: {
          x: levelWidth - 90,
          y: levelHeight - 140,
          width: 180,
          height: 240
        },
        transitionTarget: {
          sceneKey: 'UpperFloorScene',
          spawnPoint: { x: 220, y: levelHeight - 140 }
        },
        completedMessage: 'Nivel completado: pasillo despejado.',
        transitionMessage: 'Subiendo al siguiente nivel...',
        transitionDelayMs: 700
      },
      () => this.zombieWaveZoneSystem?.getCompletedZonesCount() ?? 0,
      (message) => this.showMissionStatus(message),
      (transitionMessage) => this.triggerLevelExitTransition(transitionMessage)
    );

    // Ejemplo de integración para Nivel 7: checkpoints narrativos configurados por JSON.
    // GameScene sólo conecta callbacks; la lógica de estado queda en NarrativeCheckpointSystem.
    this.narrativeCheckpointSystem = NarrativeCheckpointSystem.fromJson(
      this,
      this.players,
      level7NarrativeCheckpoints,
      {
        isCombatPending: () => (this.zombieSystem?.getActiveCount() ?? 0) > 0,
        onCheckpointActivated: ({ checkpoint }) => {
          this.showMissionStatus(`Checkpoint activado: ${checkpoint.label}`);
        },
        onCombatResolutionRequired: ({ checkpoint }) => {
          this.registry.set('interactionHint', `Resuelve el combate en ${checkpoint.label} para continuar.`);
        },
        onRecoveryRequested: ({ checkpoint }) => new Promise<void>((resolve) => {
          this.showMissionStatus(`Recuperando pertenencias en ${checkpoint.label}...`);
          this.time.delayedCall(1000, () => resolve());
        }),
        onRecoveryCompleted: ({ checkpoint }) => {
          this.showMissionStatus(`Pertenencias recuperadas en ${checkpoint.label}.`);
        },
        onObjectiveUpdated: (objectiveText) => {
          this.registry.set('currentObjective', objectiveText);
        }
      },
      {
        stateRegistryKey: 'level7NarrativeCheckpoints'
      }
    );

    const leadPlayer = this.players[0];
    if (leadPlayer) {
      this.allySystem.spawnInitialAllies(leadPlayer);
    }

    this.setupMissionSystem();
    this.stairSegmentSystem = StairSegmentSystem.fromLegacyStairAreas(this, stairConfigLevel2);
    stairConfigLevel2.stairs.forEach((stair) => {
      this.addStairVisual(stair.x, stair.y, stair.width, stair.height);
    });

    // Ejemplo de integración para Nivel 4 (escaleras por tramos + rellanos desde JSON):
    // const level4Stairs = new StairSegmentSystem(this, level4StairSegments);

    this.createMissionStatusUI();

    this.cameras.main.setBackgroundColor('#0a1020');
    this.registry.set('playerHealth', this.getTeamHealthTotal());
    this.registry.set('zombiesRemaining', this.zombieSystem.getActiveCount());
    this.registry.set('currentObjective', this.missionSystem?.getActiveObjectiveText() ?? '');
    this.registry.set('interactionHint', '');
    this.registry.set('campaignState', this.campaignState?.getSnapshot());
    this.registry.set('partyState', this.partyState?.getSnapshot());

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
    this.zombieWaveZoneSystem?.update();
    this.verticalSpawnSystem?.update(this.time.now);
    this.levelExitSystem?.update();
    this.narrativeCheckpointSystem?.update();

    this.updateMissionProgress(zombiesRemaining);

    if (!this.hasPlayerBeenDefeated) {
      this.stairSegmentSystem?.update(this.players);
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

  private triggerLevelExitTransition(message: string): void {
    if (this.hasTriggeredTransition || this.hasPlayerBeenDefeated) {
      return;
    }

    this.hasTriggeredTransition = true;
    this.physics.pause();

    this.transitionOverlay?.setVisible(true);
    this.transitionText
      ?.setText(message)
      .setVisible(true);
  }

  private createPlatform(group: Phaser.Physics.Arcade.StaticGroup, config: PlatformConfig): void {
    group.create(config.x, config.y, 'ground-placeholder')
      .setDisplaySize(config.width, config.height)
      .refreshBody()
      .setDepth(4);

    const topY = config.y - config.height / 2 + 6;
    this.add.rectangle(config.x, topY, config.width, 8, visualTheme.palette.platformTop).setDepth(5);

    const panelCount = Math.max(2, Math.floor(config.width / 96));
    const panelWidth = config.width / panelCount;
    for (let i = 0; i < panelCount; i += 1) {
      this.add.rectangle(
        config.x - config.width / 2 + panelWidth * (i + 0.5),
        config.y + 2,
        panelWidth - 10,
        Math.max(8, config.height - 14),
        i % 2 === 0 ? visualTheme.palette.floorDark : visualTheme.palette.floorLight,
        0.8
      ).setDepth(5);
    }
  }

  private drawDiningHallBackground(levelWidth: number, levelHeight: number, floorHeight: number): void {
    const { palette } = visualTheme;

    const base = this.add.graphics();
    base.fillGradientStyle(palette.skyTop, palette.skyTop, palette.skyBottom, palette.skyBottom, 1);
    base.fillRect(0, 0, levelWidth, levelHeight);
    base.fillStyle(palette.wallFar, 1);
    base.fillRect(0, 54, levelWidth, 210);
    base.fillStyle(palette.wallMid, 1);
    base.fillRect(0, 150, levelWidth, 170);
    base.fillStyle(palette.wallNear, 1);
    base.fillRect(0, levelHeight - floorHeight - 58, levelWidth, 58);
    base.destroy();

    for (let x = 90; x < levelWidth; x += 210) {
      this.add.rectangle(x, 108, 80, 54, 0x111827, 0.75).setDepth(1);
      this.add.rectangle(x, 108, 72, 46, 0x7dd3fc, 0.08).setDepth(1);
    }

    for (let x = 120; x < levelWidth; x += 280) {
      this.add.rectangle(x, 184, 150, 60, 0x0b1220, 0.35).setDepth(1).setScrollFactor(0.5, 1);
      this.add.rectangle(x + 44, 184, 26, 60, 0x1e293b, 0.4).setDepth(1).setScrollFactor(0.5, 1);
      this.add.rectangle(x - 40, 184, 18, 54, 0x334155, 0.25).setDepth(1).setScrollFactor(0.5, 1);
    }

    for (let x = 120; x < levelWidth; x += 180) {
      this.add.rectangle(x, levelHeight - floorHeight - 120, 16, 160, 0x475569, 0.45).setDepth(2);
      this.add.rectangle(x + 6, levelHeight - floorHeight - 120, 4, 160, 0x94a3b8, 0.28).setDepth(2);
      this.add.rectangle(x + 50, levelHeight - floorHeight - 108, 68, 32, 0x111827, 0.34).setDepth(2).setScrollFactor(0.8, 1);
    }

    for (let x = 70; x < levelWidth; x += 140) {
      this.add.rectangle(x, levelHeight - floorHeight - 24, 36, 20, palette.hazard, 0.14).setDepth(3);
    }

    for (let x = 200; x < levelWidth; x += 360) {
      this.add.rectangle(x, levelHeight - floorHeight - 52, 96, 24, 0x0f172a, 0.5).setDepth(3).setScrollFactor(0.9, 1);
      this.add.rectangle(x + 40, levelHeight - floorHeight - 54, 26, 8, 0xeab308, 0.24).setDepth(3).setScrollFactor(0.9, 1);
    }

    for (let x = 150; x < levelWidth; x += 260) {
      this.add.rectangle(x, 34, 64, 9, palette.lamp, 0.3).setDepth(3);
      this.add.rectangle(x, 42, 42, 4, palette.lamp, 0.2).setDepth(3);
    }
  }

  private addTableVisual(x: number, y: number, width: number, height: number): void {
    this.add.rectangle(x, y, width, height, 0x5b4634).setDepth(6);
    this.add.rectangle(x, y + 10, width - 14, 8, 0x3d2d20, 0.9).setDepth(6);
    this.add.rectangle(x - width / 2 + 18, y + 18, 10, 22, 0x2d3748).setDepth(6);
    this.add.rectangle(x + width / 2 - 18, y + 18, 10, 22, 0x2d3748).setDepth(6);
  }

  private addStairVisual(x: number, y: number, width: number, height: number): void {
    this.add.tileSprite(x, y + 6, width, height, 'stair-placeholder').setDepth(7).setAlpha(0.9);
    this.add.rectangle(x - width / 2, y, 6, height, 0x0f172a, 0.8).setDepth(7);
    this.add.rectangle(x + width / 2, y, 6, height, 0x0f172a, 0.8).setDepth(7);
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
    const fallenPlayer = this.players.find((player) => player.isDead());
    if (fallenPlayer) {
      const fallenId = getScenePlayerId();
      this.partyState?.markDead(fallenId);
      this.campaignState?.applyPatch({
        markDeadCharacter: fallenId,
        markIrreversibleEvent: `defeat-${fallenId}`
      });
      this.registry.set('partyState', this.partyState?.getSnapshot());
      this.registry.set('campaignState', this.campaignState?.getSnapshot());
    }
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

  private createLevel4StairSegmentSystemExample(): StairSegmentSystem {
    return new StairSegmentSystem(this, level4StairSegments);
  }

  private resolveRespawnPoint(data: GameSceneData, fallback: Checkpoint): Checkpoint {
    const checkpoint = this.registry.get('checkpoint') as Checkpoint | undefined;
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
    return getAveragePlayerPosition(this.players);
  }

  private updateSharedCamera(): void {
    const center = this.getAveragePlayerPosition();
    const camera = this.cameras.main;
    const lerpFactor = 0.08;
    const velocityLookAhead = this.players.length > 0
      ? this.players.reduce((acc, player) => {
          const body = player.body as Phaser.Physics.Arcade.Body | null;
          return acc + (body?.velocity.x ?? 0);
        }, 0) / this.players.length
      : 0;
    const lookAheadX = Phaser.Math.Clamp(velocityLookAhead * 0.18, -80, 80);
    const focusYOffset = 34;

    const visibleWidth = camera.width / camera.zoom;
    const visibleHeight = camera.height / camera.zoom;

    const targetScrollX = center.x + lookAheadX - visibleWidth / 2;
    const targetScrollY = center.y + focusYOffset - visibleHeight / 2;

    camera.scrollX = Phaser.Math.Linear(camera.scrollX, targetScrollX, lerpFactor);
    camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetScrollY, lerpFactor);
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
    const checkpoint = this.respawnPoint ?? { x: 140, y: this.scale.height - 140 };

    return {
      user_id: this.getPlayerId(),
      current_level: this.scene.key,
      life: this.players.filter((player) => !player.isDead()).length,
      allies_rescued: 0,
      checkpoint: `${Math.round(checkpoint.x)},${Math.round(checkpoint.y)}`
    };
  }

  private saveProgressLocally(payload: PlayerProgressPayload): void {
    const now = new Date().toISOString();
    const localProgress = {
      ...payload,
      updated_at: now,
      created_at: now
    };
    localStorage.setItem(LOCAL_PROGRESS_STORAGE_KEY, JSON.stringify(localProgress));
  }

  private loadLocalProgress(): PlayerProgressPayload | null {
    const raw = localStorage.getItem(LOCAL_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as PlayerProgressPayload;
    } catch {
      return null;
    }
  }

  private async saveProgressToApi(): Promise<void> {
    const payload = this.buildProgressPayload();
    this.saveProgressLocally(payload);

    try {
      await progressApi.saveProgress(payload);
      this.showApiStatus('Progreso guardado en servidor.', false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar progreso.';
      this.showApiStatus(`Guardado local activo. ${message}`, true);
    }
  }

  private async loadProgressFromApi(): Promise<void> {
    try {
      const progress = await progressApi.loadProgress(this.getPlayerId());
      const loadedCheckpoint = parseCheckpoint(progress.checkpoint);

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
      const localProgress = this.loadLocalProgress();
      if (localProgress) {
        const loadedCheckpoint = parseCheckpoint(localProgress.checkpoint);
        if (loadedCheckpoint) {
          this.registry.set('checkpoint', loadedCheckpoint);
        }

        this.showApiStatus('Servidor no disponible. Partida local cargada.', true);
        this.scene.restart({ respawnPoint: loadedCheckpoint, skipLoad: true });
        return;
      }

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
