import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { DEFAULT_ZOMBIE_HEALTH } from '../entities/Zombie';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ZombieSystem } from '../systems/ZombieSystem';
import { MissionObjective, MissionSystem } from '../systems/MissionSystem';
import { StairSegmentSystem } from '../systems/StairSegmentSystem';
import { AllySystem } from '../systems/AllySystem';
import { ZombieWaveZone, createZombieWaveZonesFromLevelJson } from '../systems/ZombieWaveZone';
import { LevelExitSystem } from '../systems/LevelExitSystem';
import { VerticalSpawnSystem } from '../systems/VerticalSpawnSystem';
import level2Subsuelo from '../../public/assets/levels/level2_subsuelo.json';
import stairConfigLevel2 from '../../public/assets/levels/level2_stairs.json';
import level4StairSegments from '../../public/assets/levels/level4_stair_segments.json';
import verticalSpawnConfig from '../../public/assets/levels/level2_vertical_spawns.json';
import { getActivePlayerConfigs, getInitialPartySeed } from '../config/localMultiplayer';
import { CampaignSnapshot, PlayerProgressPayload, progressApi } from '../services/progressApi';
import {
  Checkpoint,
  enforceMaxPlayerSeparation,
  getAveragePlayerPosition,
  getScenePlayerId,
  LOCAL_PROGRESS_STORAGE_KEY,
  InitialRunSetup,
  loadInitialRunSetup,
  parseCheckpoint
} from './sceneShared';
import { visualTheme } from './visualTheme';
import { CampaignState } from '../systems/core/CampaignState';
import { PartyStateSystem } from '../systems/core/PartyStateSystem';
import { registerEnvironmentProfile } from '../config/environmentProfiles';
import { getAudioManager } from '../audio/AudioManager';
import { getDifficultyRuntimeConfig } from '../config/difficultyRuntime';

const PLAYER_RESPAWN_DELAY_MS = 1800;
const API_MESSAGE_DURATION_MS = 2600;
const ARCADE_CAMERA_ZOOM = 1.25;

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
  private missionStatusText?: Phaser.GameObjects.Text;
  private transitionOverlay?: Phaser.GameObjects.Rectangle;
  private transitionText?: Phaser.GameObjects.Text;
  private apiStatusText?: Phaser.GameObjects.Text;
  private campaignState?: CampaignState;
  private partyState?: PartyStateSystem;
  private hasTriggeredTransition = false;
  private hasPlayerBeenDefeated = false;
  private respawnPoint?: Checkpoint;
  private pauseOverlay?: Phaser.GameObjects.Rectangle;
  private pausePanel?: Phaser.GameObjects.Container;
  private pauseMenuOptions: Array<{ label: string; action: () => void }> = [];
  private audioToggleOptionIndex = -1;
  private pauseMenuTexts: Phaser.GameObjects.Text[] = [];
  private pauseMenuIndex = 0;
  private cleanupZonesRequired = 0;
  private exitUnlocked = false;
  private spawnsShutDown = false;
  private visitedCheckpoints = new Set<string>();

  constructor() {
    super('GameScene');
  }

  create(data: GameSceneData = {}): void {
    const setupFromStorage = loadInitialRunSetup();
    if (setupFromStorage && !this.registry.has('initialRunSetup')) {
      this.registry.set('initialRunSetup', setupFromStorage);
    }
    const setupFromRegistry = this.registry.get('initialRunSetup') as InitialRunSetup | undefined;
    const difficulty = setupFromRegistry?.difficulty ?? setupFromStorage?.difficulty ?? 'complejo';
    const difficultyRuntime = getDifficultyRuntimeConfig(difficulty);
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

    this.projectileSystem = new ProjectileSystem(this, {
      fireCooldownMultiplier: difficultyRuntime.playerFireCooldownMultiplier
    });
    getAudioManager(this).startAmbientLoop();

    this.respawnPoint = this.resolveRespawnPoint(data, {
      x: 140,
      y: levelHeight - 140
    });

    const setup = (this.registry.get('initialRunSetup') ?? loadInitialRunSetup()) ?? null;
    const partySeed = getInitialPartySeed(setup);
    const activePlayerConfigs = getActivePlayerConfigs(setup);
    this.players = activePlayerConfigs.map((config, index) => new Player(
      this,
      this.respawnPoint!.x + index * 42,
      this.respawnPoint!.y,
      this.projectileSystem!,
      config
    ));

    this.campaignState = new CampaignState('GameScene', {
      activeCharacters: [
        ...activePlayerConfigs.map((config) => `player-${config.slot}`),
        ...partySeed.allies.map((ally) => ally.id)
      ]
    });
    this.partyState = new PartyStateSystem([
      ...activePlayerConfigs.map((config) => ({
        id: `player-${config.slot}`,
        name: config.name,
        characterId: config.characterId,
        controlMode: 'human' as const,
        status: 'active' as const,
        permanentlyLost: false,
        narrative: { deathPending: false }
      })),
      ...partySeed.allies.map((ally) => ({
        id: ally.id,
        name: ally.name,
        characterId: ally.characterId,
        controlMode: 'ai' as const,
        status: 'active' as const,
        permanentlyLost: false,
        narrative: { deathPending: false }
      }))
    ]);

    this.zombieSystem = new ZombieSystem(this, 20, {
      defaultZombieHealth: Math.max(1, Math.round(DEFAULT_ZOMBIE_HEALTH * difficultyRuntime.zombieHealthMultiplier))
    });
    this.allySystem = new AllySystem(this, this.projectileSystem);

    this.players.forEach((player) => {
      this.physics.add.collider(player, environment);
      this.physics.add.overlap(player, this.zombieSystem?.getGroup()!, () => this.handlePlayerZombieOverlap(player), undefined, this);
      this.zombieSystem?.createColliders(environment, player);
    });

    this.zombieSystem.createProjectileOverlap(this.projectileSystem.getGroup());
    this.projectileSystem.createSolidCollider(environment);
    this.allySystem.createEnvironmentColliders(environment);
    this.allySystem.createZombieOverlap(this.zombieSystem.getGroup());

    const initialSegmentSpawns = level2Subsuelo.segmentos[0]?.spawnPointsPosibles ?? [];
    initialSegmentSpawns.forEach((spawnPoint) => {
      this.zombieSystem?.spawn(spawnPoint.x, spawnPoint.y);
    });

    const zombieWaveZonesFromJson = createZombieWaveZonesFromLevelJson(level2Subsuelo, {
      triggerSize: { width: 140, height: 220 },
      blockerWidth: 30,
      blockerPadding: 36,
      spawnPressureMultiplier: difficultyRuntime.spawnPressureMultiplier
    });

    this.zombieWaveZoneSystem = new ZombieWaveZone(
      this,
      this.zombieSystem,
      this.players,
      zombieWaveZonesFromJson
    );
    this.cleanupZonesRequired = this.zombieWaveZoneSystem.getTotalZonesCount();

    // Ejemplo de integración: spawn vertical configurable por JSON (escaleras/puertas laterales).
    this.verticalSpawnSystem = VerticalSpawnSystem.fromJson(
      this,
      this.zombieSystem,
      this.players,
      verticalSpawnConfig,
      { spawnPressureMultiplier: difficultyRuntime.spawnPressureMultiplier }
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
      (transitionMessage) => this.triggerLevelExitTransition(transitionMessage),
      () => this.handleExitUnlocked()
    );

    const leadPlayer = this.players[0];
    if (leadPlayer) {
      this.allySystem.spawnInitialAllies(leadPlayer, partySeed.allies);
    }

    this.setupMissionSystem();
    this.stairSegmentSystem = StairSegmentSystem.fromLegacyStairAreas(this, stairConfigLevel2);
    stairConfigLevel2.stairs.forEach((stair) => {
      this.addStairVisual(stair.x, stair.y, stair.width, stair.height);
    });

    // Ejemplo de integración para Nivel 4 (escaleras por tramos + rellanos desde JSON):
    // const level4Stairs = new StairSegmentSystem(this, level4StairSegments);

    this.createMissionStatusUI();
    this.createPauseMenuUI();

    this.cameras.main.setBackgroundColor('#0a1020');
    this.registry.set('playerHealth', this.getTeamHealthTotal());
    this.registry.set('zombiesRemaining', this.zombieSystem.getActiveCount());
    this.registry.set('currentObjective', this.missionSystem?.getActiveObjectiveText() ?? '');
    this.registry.set('interactionHint', 'Mover: A/D · Disparar: F · Pausa: ESC · Audio: M');
    this.registry.set('campaignState', this.campaignState?.getSnapshot());
    this.registry.set('partyState', this.partyState?.getSnapshot());
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('audioMuted', getAudioManager(this).isMuted());
    this.registry.set('gameDifficultyLabel', difficultyRuntime.label);

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    this.registerPauseControls();
    this.registerApiControls();

    if (!data.skipLoad) {
      void this.loadProgressFromApi();
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
      this.registry.set('isGamePaused', false);
      this.registry.set('dialogueState', null);
      getAudioManager(this).stopAmbientLoop();
    });
  }

  update(): void {
    this.players.forEach((player) => {
      player.update();
    });
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

    this.updateMissionProgress(zombiesRemaining);

    if (!this.hasPlayerBeenDefeated) {
      this.stairSegmentSystem?.update(this.players);
    }

    this.projectileSystem?.update();
  }

  private setupMissionSystem(): void {
    const objectives: MissionObjective[] = [
      {
        id: 'clear-sublevel-corridor',
        description: `Despeja las ${this.cleanupZonesRequired} zonas del pasillo del subsuelo`,
        completedDescription: 'Pasillo despejado. Salida habilitada al siguiente tramo.',
        isCompleted: (context) => {
          const allCleanupZonesCompleted = (this.zombieWaveZoneSystem?.getCompletedZonesCount() ?? 0) >= this.cleanupZonesRequired;
          return allCleanupZonesCompleted && context.zombiesRemaining === 0;
        }
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
      this.showMissionStatus('Misión completada: subsuelo despejado. Busca la salida.');
      this.shutdownSpawnSystems('mission-completed');
      console.info('[GameScene] objective completed: clear-sublevel-corridor');
    } else {
      this.registry.set('currentObjective', this.missionSystem.getActiveObjectiveText());
    }
  }

  private handleExitUnlocked(): void {
    if (this.exitUnlocked) {
      return;
    }

    this.exitUnlocked = true;
    this.shutdownSpawnSystems('exit-unlocked');
    this.registry.set('interactionHint', 'Salida habilitada: avanza al extremo derecho para continuar.');
    console.info('[GameScene] exit unlocked and progression clarified for current slice');
  }

  private shutdownSpawnSystems(reason: string): void {
    if (this.spawnsShutDown) {
      return;
    }

    this.spawnsShutDown = true;
    this.verticalSpawnSystem?.setEnabled(false, reason);
    this.zombieWaveZoneSystem?.setEnabled(false, reason);
    console.info(`[GameScene] spawn systems disabled (${reason})`);
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
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('audioMuted', getAudioManager(this).isMuted());

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

    const difficulty = this.getInitialSetup()?.difficulty ?? 'complejo';
    const runtime = getDifficultyRuntimeConfig(difficulty);
    const didTakeDamage = player.takeDamage(runtime.zombieContactDamage, this.time.now);
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
      const fallenId = `player-${fallenPlayer.getProfile().slot}`;
      this.partyState?.markDead(fallenId);
      this.campaignState?.applyPatch({
        markDeadCharacter: fallenId,
        markIrreversibleEvent: `defeat-${fallenId}`
      });
      this.registry.set('partyState', this.partyState?.getSnapshot());
      this.registry.set('campaignState', this.campaignState?.getSnapshot());
    }
    this.physics.pause();
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('audioMuted', getAudioManager(this).isMuted());

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

  private createPauseMenuUI(): void {
    const { width, height } = this.scale;

    this.pauseOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 0.7)
      .setScrollFactor(0)
      .setDepth(40)
      .setVisible(false);

    const panel = this.add.rectangle(width / 2, height / 2, 440, 284, 0x0b1220, 0.94)
      .setStrokeStyle(2, 0x38bdf8, 1);

    const title = this.add.text(width / 2, height / 2 - 92, 'PAUSA', {
      color: '#f8fafc',
      fontSize: '36px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);

    this.pauseMenuOptions = [
      { label: 'Reanudar', action: () => this.resumeGameplay() },
      { label: 'Audio: --', action: () => this.toggleAudioMute() },
      { label: 'Reiniciar nivel', action: () => this.restartLevelFromPause() },
      { label: 'Volver al menú principal', action: () => this.returnToMainMenu() }
    ];
    this.audioToggleOptionIndex = 1;
    this.refreshAudioPauseOptionLabel();

    this.pauseMenuTexts = this.pauseMenuOptions.map((option, index) => this.add.text(width / 2, height / 2 - 18 + index * 52, option.label, {
      color: '#cbd5e1',
      fontSize: '27px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5));

    const hint = this.add.text(width / 2, height / 2 + 108, '↑/↓ seleccionar · ENTER confirmar · ESC reanudar', {
      color: '#93c5fd',
      fontSize: '14px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);

    this.pausePanel = this.add.container(0, 0, [panel, title, ...this.pauseMenuTexts, hint])
      .setDepth(41)
      .setVisible(false);

    this.updatePauseMenuSelection();
  }

  private registerPauseControls(): void {
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.hasPlayerBeenDefeated || this.hasTriggeredTransition) {
        return;
      }

      if (this.physics.world.isPaused) {
        this.resumeGameplay();
      } else {
        this.pauseGameplay();
      }
    });

    this.input.keyboard?.on('keydown-UP', () => {
      if (!this.isPauseMenuOpen()) {
        return;
      }

      this.pauseMenuIndex = Phaser.Math.Wrap(this.pauseMenuIndex - 1, 0, this.pauseMenuOptions.length);
      this.updatePauseMenuSelection();
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      if (!this.isPauseMenuOpen()) {
        return;
      }

      this.pauseMenuIndex = Phaser.Math.Wrap(this.pauseMenuIndex + 1, 0, this.pauseMenuOptions.length);
      this.updatePauseMenuSelection();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (!this.isPauseMenuOpen()) {
        return;
      }

      this.pauseMenuOptions[this.pauseMenuIndex]?.action();
      getAudioManager(this).play('uiConfirm');
    });

    this.input.keyboard?.on('keydown-M', () => {
      this.toggleAudioMute();
    });
  }

  private isPauseMenuOpen(): boolean {
    return this.pausePanel?.visible ?? false;
  }

  private pauseGameplay(): void {
    getAudioManager(this).play('uiPause');
    this.physics.pause();
    this.pauseOverlay?.setVisible(true);
    this.pausePanel?.setVisible(true);
    this.pauseMenuIndex = 0;
    this.updatePauseMenuSelection();
    this.registry.set('isGamePaused', true);
  }

  private resumeGameplay(): void {
    getAudioManager(this).play('uiConfirm');
    this.pausePanel?.setVisible(false);
    this.pauseOverlay?.setVisible(false);
    this.physics.resume();
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('audioMuted', getAudioManager(this).isMuted());
  }

  private restartLevelFromPause(): void {
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('audioMuted', getAudioManager(this).isMuted());
    this.scene.restart({ respawnPoint: this.respawnPoint, skipLoad: true });
  }

  private returnToMainMenu(): void {
    getAudioManager(this).stopAmbientLoop();
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('audioMuted', getAudioManager(this).isMuted());
    this.scene.stop('UIScene');
    this.scene.start('MainMenuScene');
  }

  private toggleAudioMute(): void {
    const audioManager = getAudioManager(this);
    const isNowMuted = audioManager.toggleMute();
    this.refreshAudioPauseOptionLabel();
    this.registry.set('audioMuted', isNowMuted);

    if (!isNowMuted) {
      audioManager.play('uiConfirm');
    }

    const status = isNowMuted ? 'silenciado' : 'activado';
    this.showMissionStatus(`Audio ${status}.`);
  }

  private refreshAudioPauseOptionLabel(): void {
    if (this.audioToggleOptionIndex < 0) {
      return;
    }

    const muted = getAudioManager(this).isMuted();
    const label = muted ? 'Audio: Muted' : 'Audio: Unmuted';
    if (this.pauseMenuOptions[this.audioToggleOptionIndex]) {
      this.pauseMenuOptions[this.audioToggleOptionIndex].label = label;
    }

    const text = this.pauseMenuTexts[this.audioToggleOptionIndex];
    if (text) {
      text.setText(label);
    }
  }

  private updatePauseMenuSelection(): void {
    this.pauseMenuTexts.forEach((text, index) => {
      const selected = this.pauseMenuIndex === index;
      text.setColor(selected ? '#fde047' : '#cbd5e1');
      text.setScale(selected ? 1.03 : 1);
    });
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
    const checkpointLabel = `${Math.round(checkpoint.x)},${Math.round(checkpoint.y)}`;
    this.visitedCheckpoints.add(checkpointLabel);

    return {
      user_id: this.getPlayerId(),
      current_level: this.scene.key,
      life: this.players.filter((player) => !player.isDead()).length,
      allies_rescued: 0,
      checkpoint: checkpointLabel,
      save_version: 2,
      campaign_snapshot: this.buildCampaignSnapshot(checkpointLabel)
    };
  }

  private getInitialSetup(): InitialRunSetup | null {
    return (this.registry.get('initialRunSetup') as InitialRunSetup | undefined) ?? loadInitialRunSetup();
  }

  private buildCampaignSnapshot(checkpoint: string): CampaignSnapshot {
    const setup = this.getInitialSetup();
    const campaign = this.campaignState?.getSnapshot();
    const partyMembers = this.partyState?.getSnapshot() ?? [];

    const party = {
      active: partyMembers.filter((member) => member.status === 'active').map((member) => member.name),
      dead: partyMembers.filter((member) => member.status === 'dead').map((member) => member.name),
      rescued: partyMembers.filter((member) => member.status === 'rescued').map((member) => member.name),
      infected: partyMembers.filter((member) => member.status === 'infected').map((member) => member.name)
    };

    return {
      setup: {
        protagonist: setup?.protagonist ?? 'unknown',
        difficulty: setup?.difficulty ?? 'unknown',
        initial_party: {
          required: setup?.party.required ?? [],
          optional: setup?.party.optional ?? []
        }
      },
      party,
      progress: {
        level: this.scene.key,
        checkpoint,
        segment: this.registry.get('currentObjective') as string | undefined,
        life: this.players.filter((player) => !player.isDead()).length,
        allies_rescued: party.rescued.length
      },
      narrative: {
        flags: campaign?.narrativeProgress ?? {},
        irreversible_events: campaign?.irreversibleEvents ?? [],
        seen_cinematics: campaign?.seenCinematics ?? []
      },
      checkpoints: {
        last: checkpoint,
        visited: [...this.visitedCheckpoints]
      }
    };
  }

  private applyLoadedSnapshot(snapshot?: CampaignSnapshot): void {
    if (!snapshot) {
      return;
    }

    this.registry.set('loadedCampaignSnapshot', snapshot);

    if (snapshot.checkpoints?.visited) {
      snapshot.checkpoints.visited.forEach((value) => this.visitedCheckpoints.add(value));
    }

    if (snapshot.setup) {
      const protagonist = snapshot.setup.protagonist;
      const difficulty = snapshot.setup.difficulty;
      const validProtagonist = protagonist === 'alan-nahuel' || protagonist === 'giovanna';
      const validDifficulty = difficulty === 'complejo' || difficulty === 'pesadilla';

      const existing = this.getInitialSetup();
      if (!existing && validProtagonist && validDifficulty) {
        this.registry.set('initialRunSetup', {
          protagonist,
          difficulty,
          party: {
            required: snapshot.setup.initial_party.required,
            optional: snapshot.setup.initial_party.optional
          },
          startedAt: new Date().toISOString(),
          version: 1
        });
      }
    }
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
      this.applyLoadedSnapshot(progress.campaign_snapshot);

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
        this.applyLoadedSnapshot(localProgress.campaign_snapshot);
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
