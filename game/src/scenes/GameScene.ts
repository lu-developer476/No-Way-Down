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
  parseCheckpoint,
  PartyHudMember
} from './sceneShared';
import { visualTheme } from './visualTheme';
import { CampaignState } from '../systems/core/CampaignState';
import { PartyStateSystem } from '../systems/core/PartyStateSystem';
import { registerEnvironmentProfile } from '../config/environmentProfiles';
import { getAudioManager } from '../audio/AudioManager';
import { getDifficultyRuntimeConfig } from '../config/difficultyRuntime';
import { CinematicCallSystem, type CinematicCallSystemConfig } from '../systems/CinematicCallSystem';
import level2NarrativeCallConfig from '../../public/assets/levels/level2_narrative_call.json';
import { getCharacterRuntimeConfig } from '../config/characterRuntime';

const PLAYER_RESPAWN_DELAY_MS = 1800;
const API_MESSAGE_DURATION_MS = 2600;
const ARCADE_CAMERA_ZOOM = 1.25;
const LATE_ALLY_JOIN_CHECKPOINT_ID = 'level2-checkpoint-first-zone-cleared';

const LATE_RESCUE_ALLIES = [
  {
    id: 'ally-lorena',
    name: 'Lorena',
    characterId: 'lorena',
    tint: 0xfb7185,
    followOffsetX: -154,
    followOffsetY: -8
  },
  {
    id: 'ally-selene',
    name: 'Selene',
    characterId: 'selene',
    tint: 0xc084fc,
    followOffsetX: 154,
    followOffsetY: -8
  }
] as const;

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

interface CleanupZoneBoundary {
  id: string;
  minX: number;
  maxX: number;
}

type PauseMenuState = 'root' | 'options';

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
  private audioVolumeOptionIndex = -1;
  private pauseMenuTexts: Phaser.GameObjects.Text[] = [];
  private pauseMenuIndex = 0;
  private pauseHintText?: Phaser.GameObjects.Text;
  private pauseMenuState: PauseMenuState = 'root';
  private cleanupZonesRequired = 0;
  private exitUnlocked = false;
  private spawnsShutDown = false;
  private visitedCheckpoints = new Set<string>();
  private readonly verticalPointsByCleanupZone = new Map<string, string[]>();
  private readonly disabledVerticalZones = new Set<string>();
  private cinematicCallSystem?: CinematicCallSystem;
  private advanceDialogueRequested = false;
  private skipDialogueRequested = false;
  private movementLockedByNarrative = false;
  private firstCleanupNarrativeTriggered = false;
  private lateRescueAlliesIntegrated = false;

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
    const audioManager = getAudioManager(this);
    audioManager.startGameplayAmbient();
    this.registry.set('audioMuted', audioManager.isMuted());
    this.registry.set('audioVolume', audioManager.getVolumePercent());

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
    this.mapVerticalSpawnsToCleanupZones(verticalSpawnConfig.verticalZombieSpawns.points);

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
    this.registry.set('partyHud', this.buildPartyHud());
    this.registry.set('zombiesRemaining', this.zombieSystem.getActiveCount());
    this.registry.set('currentObjective', this.missionSystem?.getActiveObjectiveText() ?? '');
    this.registry.set('interactionHint', '');
    this.registry.set('campaignState', this.campaignState?.getSnapshot());
    this.registry.set('partyState', this.partyState?.getSnapshot());
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('audioMuted', getAudioManager(this).isMuted());
    this.registry.set('audioVolume', getAudioManager(this).getVolumePercent());
    this.registry.set('gameDifficultyLabel', difficultyRuntime.label);

    this.setupNarrativeSystems();

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    this.registerPauseControls();
    this.registerApiControls();
    this.registerNarrativeControls();

    if (this.shouldTriggerIntroCinematic(data)) {
      this.time.delayedCall(280, () => {
        void this.triggerNarrativeCheckpoint('level2-checkpoint-intro-briefing');
      });
    }

    if (!data.skipLoad) {
      void this.loadProgressFromApi();
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
      this.registry.set('isGamePaused', false);
      this.registry.set('dialogueState', null);
      this.setNarrativeMovementLock(false);
      getAudioManager(this).stopGameplayAmbient();
    });
  }

  update(): void {
    if (this.isPauseMenuOpen() || this.movementLockedByNarrative) {
      return;
    }

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

    this.registry.set('partyHud', this.buildPartyHud());

    const zombiesRemaining = this.zombieSystem?.getActiveCount() ?? 0;
    this.registry.set('zombiesRemaining', zombiesRemaining);
    this.zombieWaveZoneSystem?.update();
    this.syncSpawnSystemsWithCleanupProgress();
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
    this.registry.set('interactionHint', 'Salida habilitada: entra en la zona final y presiona ENTER para avanzar.');
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

  private mapVerticalSpawnsToCleanupZones(points: Array<{ id: string; position: { x: number; y: number } }>): void {
    const boundaries = this.getCleanupZoneBoundaries();

    points.forEach((point) => {
      const ownerZone = boundaries.find((zoneBoundary) => (
        point.position.x >= zoneBoundary.minX && point.position.x <= zoneBoundary.maxX
      ));

      if (!ownerZone) {
        return;
      }

      const zonePointIds = this.verticalPointsByCleanupZone.get(ownerZone.id) ?? [];
      zonePointIds.push(point.id);
      this.verticalPointsByCleanupZone.set(ownerZone.id, zonePointIds);
    });

    this.verticalPointsByCleanupZone.forEach((pointIds, zoneId) => {
      console.info(`[GameScene] cleanup zone ${zoneId} controls vertical points: ${pointIds.join(', ')}`);
    });
  }

  private getCleanupZoneBoundaries(): CleanupZoneBoundary[] {
    const segmentsById = new Map(level2Subsuelo.segmentos.map((segment) => [segment.id, segment]));

    return level2Subsuelo.zonasLimpiezaZombies
      .map((zone) => {
        const coveredSegments = zone.segmentosCubiertos.reduce<typeof level2Subsuelo.segmentos>((accumulator, segmentId) => {
          const segment = segmentsById.get(segmentId);
          if (segment) {
            accumulator.push(segment);
          }
          return accumulator;
        }, []);

        if (coveredSegments.length === 0) {
          return null;
        }

        return {
          id: zone.id,
          minX: Math.min(...coveredSegments.map((segment) => segment.posicionX.inicioPx)),
          maxX: Math.max(...coveredSegments.map((segment) => segment.posicionX.finPx))
        };
      })
      .filter((zone): zone is CleanupZoneBoundary => zone !== null);
  }

  private syncSpawnSystemsWithCleanupProgress(): void {
    const completedZoneIds = this.zombieWaveZoneSystem?.getCompletedZoneIds() ?? [];

    completedZoneIds.forEach((zoneId) => {
      if (this.disabledVerticalZones.has(zoneId)) {
        return;
      }

      this.disabledVerticalZones.add(zoneId);
      const pointIds = this.verticalPointsByCleanupZone.get(zoneId) ?? [];
      pointIds.forEach((pointId) => this.verticalSpawnSystem?.setPointEnabled(pointId, false, `cleanup-zone-completed:${zoneId}`));

      if (pointIds.length > 0) {
        console.info(`[GameScene] cleanup zone ${zoneId} completed: disabled vertical points ${pointIds.join(', ')}`);
      }

      if (!this.firstCleanupNarrativeTriggered) {
        this.firstCleanupNarrativeTriggered = true;
        void this.triggerNarrativeCheckpoint('level2-checkpoint-first-zone-cleared');
      }
    });
  }

  private setupNarrativeSystems(): void {
    this.cinematicCallSystem = CinematicCallSystem.fromJson(
      this,
      level2NarrativeCallConfig as CinematicCallSystemConfig,
      {
        showDialogueLine: (line) => {
          this.registry.set('dialogueState', {
            speaker: line.speaker,
            text: line.text,
            canSkip: true,
            canAdvance: true
          });
        },
        clearDialogue: () => {
          this.registry.set('dialogueState', null);
        }
      },
      {
        onCinematicStarted: () => {
          this.registry.set('interactionHint', 'Cinemática activa · SPACE avanza · X salta');
        },
        onMovementLockChanged: (locked) => {
          this.setNarrativeMovementLock(locked);
        },
        onObjectiveUpdated: (objectiveText) => {
          this.showMissionStatus(objectiveText);
        },
        onCinematicCompleted: () => {
          this.registry.set('interactionHint', '');
        },
        consumeAdvance: () => {
          if (!this.advanceDialogueRequested) {
            return false;
          }

          this.advanceDialogueRequested = false;
          return true;
        },
        isSkipRequested: () => this.skipDialogueRequested
      }
    );
  }

  private registerNarrativeControls(): void {
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.advanceDialogueRequested = true;
    });

    this.input.keyboard?.on('keydown-X', () => {
      this.skipDialogueRequested = true;
    });
  }

  private setNarrativeMovementLock(locked: boolean): void {
    if (this.movementLockedByNarrative === locked) {
      return;
    }

    this.movementLockedByNarrative = locked;
    this.registry.set('isGamePaused', locked);

    if (locked) {
      this.physics.world.pause();
      this.players.forEach((player) => player.setVelocity(0, 0));
      return;
    }

    if (!this.hasPlayerBeenDefeated && !this.hasTriggeredTransition) {
      this.physics.world.resume();
    }
  }

  private shouldTriggerIntroCinematic(data: GameSceneData): boolean {
    const fromNewGameFlow = data.skipLoad === true;
    const hasStoredCheckpoint = Boolean(this.registry.get('checkpoint'));
    return fromNewGameFlow || !hasStoredCheckpoint;
  }

  private async triggerNarrativeCheckpoint(checkpointId: string): Promise<void> {
    if (!this.cinematicCallSystem || this.cinematicCallSystem.isPlaying()) {
      return;
    }

    this.advanceDialogueRequested = false;
    this.skipDialogueRequested = false;
    await this.cinematicCallSystem.triggerByCheckpoint(checkpointId);
    this.integrateLateRescueAllies(checkpointId);
    this.skipDialogueRequested = false;
  }

  private integrateLateRescueAllies(checkpointId: string): void {
    if (checkpointId !== LATE_ALLY_JOIN_CHECKPOINT_ID || this.lateRescueAlliesIntegrated) {
      return;
    }

    const leadPlayer = this.players[0];
    if (!leadPlayer || !this.allySystem || !this.partyState || !this.campaignState) {
      return;
    }

    const existingMembers = new Set(this.partyState.getSnapshot().map((member) => member.id));

    LATE_RESCUE_ALLIES.forEach((allyConfig) => {
      if (existingMembers.has(allyConfig.id)) {
        return;
      }

      this.allySystem?.spawnRescuedAlly({ ...allyConfig }, leadPlayer);

      this.partyState?.upsertMember({
        id: allyConfig.id,
        name: allyConfig.name,
        characterId: allyConfig.characterId,
        controlMode: 'ai',
        status: 'active',
        permanentlyLost: false,
        narrative: { deathPending: false }
      });

      this.campaignState?.applyPatch({
        addActiveCharacter: allyConfig.id,
        markRescuedCharacter: allyConfig.id,
        narrativeProgress: {
          late_rescue_join_checkpoint: checkpointId
        }
      });
    });

    this.lateRescueAlliesIntegrated = true;
    this.registry.set('partyState', this.partyState.getSnapshot());
    this.registry.set('campaignState', this.campaignState.getSnapshot());
    this.registry.set('partyHud', this.buildPartyHud());
    this.showMissionStatus('Lorena y Selene se reunieron con el grupo. Cobertura ampliada.');
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
    this.registry.set('audioVolume', getAudioManager(this).getVolumePercent());

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

    this.registry.set('partyHud', this.buildPartyHud());

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
    this.registry.set('audioVolume', getAudioManager(this).getVolumePercent());

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

  private buildPartyHud(): PartyHudMember[] {
    const setup = this.getInitialSetup();
    const protagonistCharacterId = setup?.protagonist === 'giovanna' ? 'giovanna' : 'alan';

    const playerEntries = this.players.map((player) => {
      const profile = player.getProfile();
      const runtime = player.getRuntimeConfig();
      const role: PartyHudMember['role'] = profile.characterId === protagonistCharacterId
        ? 'protagonist'
        : 'ally';

      return {
        id: `player-${profile.slot}`,
        name: runtime.name,
        role,
        health: player.getHealth(),
        maxHealth: player.getMaxHealth()
      };
    });

    const playerIds = new Set(playerEntries.map((entry) => entry.id));
    const preferredLateJoinIds = new Set<string>(LATE_RESCUE_ALLIES.map((ally) => ally.id));
    const activePartyMembers = (this.partyState?.getSnapshot() ?? []).filter((member) => (
      member.status === 'active' && !playerIds.has(member.id)
    ));

    const prioritizedAllies = [
      ...activePartyMembers.filter((member) => preferredLateJoinIds.has(member.id)),
      ...activePartyMembers.filter((member) => !preferredLateJoinIds.has(member.id))
    ];

    const allyEntries = prioritizedAllies.map((member) => {
      const runtime = getCharacterRuntimeConfig(member.characterId ?? 'alan');

      return {
        id: member.id,
        name: member.name,
        role: 'ally' as const,
        health: runtime.maxHealth,
        maxHealth: runtime.maxHealth
      };
    });

    return [...playerEntries, ...allyEntries].slice(0, 4);
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

    const panel = this.add.rectangle(0, 0, 520, 360, 0x0b1220, 0.94)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x38bdf8, 1);

    const title = this.add.text(0, -92, 'PAUSA', {
      color: '#f8fafc',
      fontSize: '36px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5)
      .setScrollFactor(0);

    this.pauseMenuOptions = [
      { label: 'Reanudar', action: () => this.resumeGameplay() },
      { label: 'Opciones', action: () => this.openPauseOptions() },
      { label: 'Salir', action: () => this.returnToMainMenu() }
    ];

    this.pauseMenuTexts = this.pauseMenuOptions.map((option, index) => this.add.text(0, -18 + index * 52, option.label, {
      color: '#cbd5e1',
      fontSize: '27px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5)
      .setScrollFactor(0));

    this.pauseHintText = this.add.text(0, 146, '↑/↓ seleccionar · ENTER confirmar · ESC volver/abandonar', {
      color: '#93c5fd',
      fontSize: '14px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5)
      .setScrollFactor(0);

    this.pausePanel = this.add.container(width / 2, height / 2, [panel, title, ...this.pauseMenuTexts, this.pauseHintText])
      .setScrollFactor(0)
      .setDepth(41)
      .setVisible(false);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handlePauseOverlayResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handlePauseOverlayResize, this);
    });

    this.updatePauseMenuSelection();
  }

  private handlePauseOverlayResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    this.pauseOverlay
      ?.setPosition(width / 2, height / 2)
      .setSize(width, height);
    this.pausePanel?.setPosition(width / 2, height / 2);
  }

  private registerPauseControls(): void {
    this.input.keyboard?.on('keydown-P', () => {
      if (this.hasPlayerBeenDefeated || this.hasTriggeredTransition) {
        return;
      }

      if (this.isPauseMenuOpen()) {
        this.resumeGameplay();
      } else {
        this.pauseGameplay();
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.hasPlayerBeenDefeated || this.hasTriggeredTransition) {
        return;
      }

      if (this.isPauseMenuOpen()) {
        if (this.pauseMenuState === 'options') {
          this.openPauseRoot();
          return;
        }

        this.resumeGameplay();
        return;
      }

      this.returnToMainMenu();
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

    this.input.keyboard?.on('keydown-LEFT', () => {
      if (!this.isPauseMenuOpen()) {
        return;
      }

      if (this.pauseMenuIndex === this.audioVolumeOptionIndex) {
        this.adjustMasterVolume(-10);
      }
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      if (!this.isPauseMenuOpen()) {
        return;
      }

      if (this.pauseMenuIndex === this.audioVolumeOptionIndex) {
        this.adjustMasterVolume(10);
      }
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
    this.openPauseRoot();
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
    this.registry.set('audioVolume', getAudioManager(this).getVolumePercent());
  }

  private returnToMainMenu(): void {
    const audioManager = getAudioManager(this);
    audioManager.stopGameplayAmbient();
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('audioMuted', audioManager.isMuted());
    this.registry.set('audioVolume', audioManager.getVolumePercent());
    this.scene.stop('UIScene');
    this.scene.start('MainMenuScene');
  }

  private toggleAudioMute(): void {
    const audioManager = getAudioManager(this);
    const isNowMuted = audioManager.toggleMute();
    this.refreshAudioPauseOptionLabel();
    this.refreshVolumePauseOptionLabel();
    this.registry.set('audioMuted', isNowMuted);
    this.registry.set('audioVolume', audioManager.getVolumePercent());

    if (!isNowMuted) {
      audioManager.play('uiConfirm');
    }

    const status = isNowMuted ? 'silenciado' : 'activado';
    this.showMissionStatus(`Audio ${status}.`);
  }

  private adjustMasterVolume(delta: number): void {
    const audioManager = getAudioManager(this);
    const volume = audioManager.adjustVolumePercent(delta);
    this.refreshVolumePauseOptionLabel();
    this.registry.set('audioVolume', volume);

    if (!audioManager.isMuted() && volume > 0) {
      audioManager.play('uiConfirm');
    }

    this.showMissionStatus(`Volumen ${volume}%.`);
  }

  private refreshAudioPauseOptionLabel(): void {
    if (this.audioToggleOptionIndex < 0) {
      return;
    }

    const muted = getAudioManager(this).isMuted();
    const label = muted ? 'Sonido: Silenciado' : 'Sonido: Activado';
    if (this.pauseMenuOptions[this.audioToggleOptionIndex]) {
      this.pauseMenuOptions[this.audioToggleOptionIndex].label = label;
    }

    const text = this.pauseMenuTexts[this.audioToggleOptionIndex];
    if (text) {
      text.setText(label);
    }
  }

  private refreshVolumePauseOptionLabel(): void {
    if (this.audioVolumeOptionIndex < 0) {
      return;
    }

    const volume = getAudioManager(this).getVolumePercent();
    const label = `Volumen: ${volume}%`;
    if (this.pauseMenuOptions[this.audioVolumeOptionIndex]) {
      this.pauseMenuOptions[this.audioVolumeOptionIndex].label = label;
    }

    const text = this.pauseMenuTexts[this.audioVolumeOptionIndex];
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

  private openPauseRoot(): void {
    this.pauseMenuState = 'root';
    this.audioToggleOptionIndex = -1;
    this.audioVolumeOptionIndex = -1;
    this.pauseMenuOptions = [
      { label: 'Reanudar', action: () => this.resumeGameplay() },
      { label: 'Opciones', action: () => this.openPauseOptions() },
      { label: 'Salir', action: () => this.returnToMainMenu() }
    ];
    this.pauseMenuIndex = 0;
    this.refreshPauseMenuTexts();
    this.pauseHintText?.setText('↑/↓ seleccionar · ENTER confirmar · ESC volver/abandonar');
  }

  private openPauseOptions(): void {
    this.pauseMenuState = 'options';
    this.pauseMenuOptions = [
      { label: 'Controles: Flechas / Espacio / S / R / E / Enter / P / ESC', action: () => undefined },
      { label: 'Sonido: --', action: () => this.toggleAudioMute() },
      { label: 'Volumen: --', action: () => this.adjustMasterVolume(10) },
      { label: 'Diálogos: SPACE avanzar · X saltar', action: () => undefined },
      { label: 'Volver', action: () => this.openPauseRoot() }
    ];
    this.audioToggleOptionIndex = 1;
    this.audioVolumeOptionIndex = 2;
    this.refreshAudioPauseOptionLabel();
    this.refreshVolumePauseOptionLabel();
    this.pauseMenuIndex = 0;
    this.refreshPauseMenuTexts();
    this.pauseHintText?.setText('↑/↓ seleccionar · ←/→ ajustar volumen · ESC volver');
  }

  private refreshPauseMenuTexts(): void {
    this.pauseMenuTexts.forEach((text, index) => {
      const option = this.pauseMenuOptions[index];
      text.setVisible(Boolean(option));
      text.setText(option?.label ?? '');
    });
    this.updatePauseMenuSelection();
  }

  private registerApiControls(): void {
    this.input.keyboard?.on('keydown-F5', () => {
      void this.saveProgressToApi();
    });

    this.input.keyboard?.on('keydown-F9', () => {
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
