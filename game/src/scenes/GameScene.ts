import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { AllyAI } from '../entities/AllyAI';
import { DEFAULT_ZOMBIE_HEALTH } from '../entities/Zombie';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ZombieSystem } from '../systems/ZombieSystem';
import { MissionObjective, MissionSystem } from '../systems/MissionSystem';
import { StairSegmentSystem } from '../systems/StairSegmentSystem';
import { AllySystem } from '../systems/AllySystem';
import { LevelExitSystem } from '../systems/LevelExitSystem';
import { SpawnManager } from '../systems/SpawnManager';
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
import { EnvironmentProfile, registerEnvironmentProfile } from '../config/environmentProfiles';
import { getAudioManager } from '../audio/AudioManager';
import { getDifficultyRuntimeConfig } from '../config/difficultyRuntime';
import { CinematicCallSystem, type CinematicCallSystemConfig } from '../systems/CinematicCallSystem';
import level2NarrativeCallConfig from '../../public/assets/levels/level2_narrative_call.json';
import corridorObjectsConfig from '../../public/assets/levels/corridor_objects.json';
import level2PickupConfig from '../../public/assets/levels/level2_pickups.json';
import { addEnvironmentProp } from './environmentLayout';
import { getCharacterRuntimeConfig } from '../config/characterRuntime';
import { controlManager } from '../input/ControlManager';
import { CombatActionSystem } from '../systems/CombatActionSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { levelManager } from '../systems/level/levelCatalog';
import { ObjectiveSystem } from '../systems/core/ObjectiveSystem';
import { InteractableSystem } from '../systems/core/InteractableSystem';
import { TriggerSystem } from '../systems/TriggerSystem';
import { CinematicSystem } from '../systems/core/CinematicSystem';
import { DialogueSystem } from '../systems/core/DialogueSystem';
import { LevelRestartManager } from '../systems/core/LevelRestartManager';
import { CheckpointSystem } from '../systems/core/CheckpointSystem';

const PLAYER_RESPAWN_DELAY_MS = 1800;
const API_MESSAGE_DURATION_MS = 2600;
const ARCADE_CAMERA_ZOOM = 1.25;
// Este checkpoint queda reservado para una futura integración narrativa.
// En nivel 1 no debe incorporar a Lorena/Selene.
const LATE_ALLY_JOIN_CHECKPOINT_ID = 'late-rescue-allies-join';

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
  flowNodeId?: string;
  campaignLevelConfigPath?: string;
  campaignLevelConfig?: unknown;
}

interface ResistancePhaseRuntimeConfig {
  durationMs: number;
  holdAreaIds: string[];
  advanceAreaIds: string[];
  holdObjectiveText?: string;
  advanceObjectiveText?: string;
  completionEvent?: {
    type: string;
    targetId?: string;
  };
}

interface AllyWorldHealthBar {
  container: Phaser.GameObjects.Container;
  fill: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
}

type PauseMenuState = 'root' | 'options';

export class GameScene extends Phaser.Scene {
  private players: Player[] = [];
  private projectileSystem?: ProjectileSystem;
  private combatActionSystem?: CombatActionSystem;
  private pickupSystem?: PickupSystem;
  private zombieSystem?: ZombieSystem;
  private missionSystem?: MissionSystem;
  private stairSegmentSystem?: StairSegmentSystem;
  private allySystem?: AllySystem;
  private spawnManager?: SpawnManager;
  private levelExitSystem?: LevelExitSystem;
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
  private cinematicCallSystem?: CinematicCallSystem;
  private objectiveSystem?: ObjectiveSystem;
  private interactableSystem?: InteractableSystem;
  private triggerSystem?: TriggerSystem;
  private levelCinematicSystem?: CinematicSystem;
  private dialogueSystem?: DialogueSystem;
  private checkpointSystem?: CheckpointSystem;
  private levelRestartManager?: LevelRestartManager;
  private activeEnvironmentProfile: EnvironmentProfile | null = null;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private interactionHintOwnedByInteractables = false;
  private advanceDialogueRequested = false;
  private skipDialogueRequested = false;
  private selectedDialogueChoiceIndex = 0;
  private movementLockedByNarrative = false;
  private firstCleanupNarrativeTriggered = false;
  private lateRescueAlliesIntegrated = false;
  private nextFootstepAt = 0;
  private resistancePhaseConfig?: ResistancePhaseRuntimeConfig;
  private resistancePhaseEndsAt?: number;
  private resistancePhaseCompleted = false;
  private readonly allyHealthBars = new Map<string, AllyWorldHealthBar>();
  private readonly onNarrativeAdvanceKey = () => {
    this.advanceDialogueRequested = true;
  };
  private readonly onNarrativeSkipKey = () => {
    this.skipDialogueRequested = true;
  };
  private readonly onDialogueChoice1Key = () => {
    this.selectedDialogueChoiceIndex = 0;
  };
  private readonly onDialogueChoice2Key = () => {
    this.selectedDialogueChoiceIndex = 1;
  };
  private readonly onDialogueChoice3Key = () => {
    this.selectedDialogueChoiceIndex = 2;
  };
  private readonly onPauseToggleKey = () => {
    if (this.hasPlayerBeenDefeated || this.hasTriggeredTransition) {
      return;
    }

    if (this.isPauseMenuOpen()) {
      this.resumeGameplay();
    } else {
      this.pauseGameplay();
    }
  };
  private readonly onPauseBackKey = () => {
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
  };
  private readonly onPauseUpKey = () => {
    if (!this.isPauseMenuOpen()) {
      return;
    }

    this.pauseMenuIndex = Phaser.Math.Wrap(this.pauseMenuIndex - 1, 0, this.pauseMenuOptions.length);
    this.updatePauseMenuSelection();
  };
  private readonly onPauseDownKey = () => {
    if (!this.isPauseMenuOpen()) {
      return;
    }

    this.pauseMenuIndex = Phaser.Math.Wrap(this.pauseMenuIndex + 1, 0, this.pauseMenuOptions.length);
    this.updatePauseMenuSelection();
  };
  private readonly onPauseConfirmKey = () => {
    if (!this.isPauseMenuOpen()) {
      return;
    }

    this.pauseMenuOptions[this.pauseMenuIndex]?.action();
    getAudioManager(this).play('uiConfirm');
  };
  private readonly onPauseLeftKey = () => {
    if (!this.isPauseMenuOpen()) {
      return;
    }

    if (this.pauseMenuIndex === this.audioVolumeOptionIndex) {
      this.adjustMasterVolume(-10);
    }
  };
  private readonly onPauseRightKey = () => {
    if (!this.isPauseMenuOpen()) {
      return;
    }

    if (this.pauseMenuIndex === this.audioVolumeOptionIndex) {
      this.adjustMasterVolume(10);
    }
  };
  private readonly onSaveApiKey = () => {
    void this.saveProgressToApi();
  };
  private readonly onLoadApiKey = () => {
    void this.loadProgressFromApi();
  };

  constructor(sceneKey = 'GameScene') {
    super(sceneKey);
  }

  create(data: GameSceneData = {}): void {
    this.resetRuntimeStateForRestart();

    const selectedLevelId = this.resolveLevelIdFromCampaignConfig(data);

    const setupFromStorage = loadInitialRunSetup();
    if (setupFromStorage && !this.registry.has('initialRunSetup')) {
      this.registry.set('initialRunSetup', setupFromStorage);
    }
    const setupFromRegistry = this.registry.get('initialRunSetup') as InitialRunSetup | undefined;
    const difficulty = setupFromRegistry?.difficulty ?? setupFromStorage?.difficulty ?? 'complejo';
    const difficultyRuntime = getDifficultyRuntimeConfig(difficulty);
    const levelConfig = levelManager.loadLevel(selectedLevelId);
    const levelWidth = levelConfig.layout.width;
    const levelHeight = levelConfig.layout.height;
    const floorHeight = levelConfig.layout.floor_height ?? 64;
    const floorY = levelHeight - floorHeight / 2;
    const tableTopY = levelHeight - 146;

    this.physics.world.setBounds(0, 0, levelWidth, levelHeight);
    registerEnvironmentProfile(this, String(levelConfig.layout.environment_profile ?? 'level2_subsuelo'));
    this.activeEnvironmentProfile = (this.registry.get('environmentProfile') as EnvironmentProfile | null) ?? null;

    this.cameras.main
      .setBounds(0, 0, levelWidth, levelHeight)
      .setZoom(ARCADE_CAMERA_ZOOM)
      .setRoundPixels(true);

    this.drawSubsueloBackground(levelWidth, levelHeight, floorHeight, this.activeEnvironmentProfile);

    const environment = this.physics.add.staticGroup();

    this.createPlatform(environment, {
      x: levelWidth / 2,
      y: floorY,
      width: levelWidth,
      height: floorHeight
    });

    this.placeSubsueloProps(environment, tableTopY);

    this.projectileSystem = new ProjectileSystem(this, {
      fireCooldownMultiplier: difficultyRuntime.playerFireCooldownMultiplier
    });
    this.combatActionSystem = new CombatActionSystem(this);
    const audioManager = getAudioManager(this);
    audioManager.startGameplayAmbient();
    this.registry.set('audioMuted', audioManager.isMuted());
    this.registry.set('audioVolume', audioManager.getVolumePercent());

    const checkpointSystem = new CheckpointSystem(this);
    this.checkpointSystem = checkpointSystem;

    this.respawnPoint = this.resolveRespawnPoint(data, levelConfig.layout.default_spawn ?? {
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
    this.allySystem = new AllySystem(this, this.projectileSystem, this.combatActionSystem);

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

    this.spawnManager = levelManager.instantiateSpawns(selectedLevelId, this, this.zombieSystem, this.players, {
      spawnPressureMultiplier: difficultyRuntime.spawnPressureMultiplier,
      getEnemyLimit: () => this.zombieSystem?.getGroup().maxSize ?? Number.MAX_SAFE_INTEGER
    });
    this.cleanupZonesRequired = this.spawnManager.getTotalAreasCount();
    this.setupResistancePhase(levelConfig.layout.level_flow);
    this.objectiveSystem = levelManager.instantiateObjectives(selectedLevelId);
    this.interactableSystem = levelManager.instantiateInteractables(selectedLevelId);
    this.levelRestartManager = levelManager.instantiateRestartManager(this, {
      checkpointSystem,
      resetEnemies: () => this.resetEnemiesForRestart(),
      resetObjectives: () => this.objectiveSystem?.reset(),
      resetInteractables: () => this.interactableSystem?.reset(),
      beforeRestart: () => {
        this.hasPlayerBeenDefeated = true;
      }
    });
    this.dialogueSystem = new DialogueSystem({
      show: (line) => {
        this.registry.set('dialogueState', {
          speaker: line.speaker,
          text: line.text,
          emotion: line.emotion,
          portrait: line.portrait,
          choices: line.choices?.map((choice) => ({ text: choice.text })),
          canSkip: false,
          canAdvance: false
        });
      },
      clear: () => {
        this.registry.set('dialogueState', null);
      }
    });
    this.levelCinematicSystem = new CinematicSystem(
      this,
      levelManager.getCinematics(selectedLevelId),
      this.dialogueSystem,
      {
        onGameplayPauseChanged: (paused) => this.setNarrativeMovementLock(paused),
        onCinematicStarted: () => {
          this.registry.set('interactionHint', 'Cinemática activa');
        },
        onCinematicCompleted: () => {
          this.registry.set('interactionHint', '');
        },
        onDialogueChoiceRequested: (_line, choices) => {
          const selected = Phaser.Math.Clamp(this.selectedDialogueChoiceIndex, 0, Math.max(0, choices.length - 1));
          this.selectedDialogueChoiceIndex = 0;
          return selected;
        },
        isDialogueInterrupted: () => this.skipDialogueRequested
      }
    );
    this.triggerSystem = levelManager.instantiateTriggers(
      selectedLevelId,
      this,
      this.players as unknown as Phaser.Types.Physics.Arcade.GameObjectWithBody[],
      {
        onTriggerActivated: (trigger) => {
          const objectiveUpdate = this.objectiveSystem?.process({
            type: 'trigger_entered',
            targetId: trigger.id
          });

          if (objectiveUpdate?.status === 'completed') {
            this.registry.set('currentObjective', this.objectiveSystem?.getActiveObjective()?.label ?? 'Objetivo completado');
          }
        },
        onNarrativeMessage: (payload) => this.showMissionStatus(`${payload.speaker ?? 'Radio'}: ${payload.message}`),
        onCinematic: (payload) => {
          void this.levelCinematicSystem?.playById(payload.cinematicId);
        }
      }
    );

    this.levelExitSystem = new LevelExitSystem(
      this,
      this.players,
      {
        requiredCleanupZones: this.cleanupZonesRequired,
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
      () => this.spawnManager?.getCompletedAreasCount() ?? 0,
      (message) => this.showMissionStatus(message),
      (transitionMessage) => this.triggerLevelExitTransition(transitionMessage),
      () => this.handleExitUnlocked()
    );

    const leadPlayer = this.players[0];
    if (leadPlayer) {
      this.allySystem.spawnInitialAllies(leadPlayer, partySeed.allies);
    }

    this.pickupSystem = PickupSystem.fromJSON(this, level2PickupConfig);
    this.interactKey = this.input.keyboard?.addKey(controlManager.getKeyCode('interact'));

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
    this.refreshAllyWorldHealthBars();
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
      this.unregisterPauseControls();
      this.unregisterApiControls();
      this.unregisterNarrativeControls();
      this.levelExitSystem?.destroy();
      this.levelExitSystem = undefined;
      this.pickupSystem?.destroy();
      this.pickupSystem = undefined;
      this.triggerSystem?.destroy();
      this.triggerSystem = undefined;
      this.levelCinematicSystem = undefined;
      this.dialogueSystem = undefined;
      this.levelRestartManager = undefined;
      this.checkpointSystem = undefined;
      this.registry.set('isGamePaused', false);
      this.registry.set('dialogueState', null);
      this.registry.set('interactionHint', '');
      this.setNarrativeMovementLock(false);
      this.physics.resume();
      this.clearAllyWorldHealthBars();
      getAudioManager(this).stopGameplayAmbient();
    });
  }

  private resolveLevelIdFromCampaignConfig(data: GameSceneData): string {
    const defaultLevelId = 'level_2_subsuelo';
    const flowNodeLabel = data.flowNodeId ?? 'unknown-flow-node';

    if (data.campaignLevelConfigPath) {
      console.log(`[LevelScene] flowNode.id recibido: ${flowNodeLabel}`);
      console.log(`[LevelScene] levelConfigPath solicitado: ${data.campaignLevelConfigPath}`);
    }

    if (!data.campaignLevelConfig) {
      if (data.campaignLevelConfigPath) {
        console.warn(`[LevelScene] fallback activado: no se recibió config cargada para ${data.campaignLevelConfigPath}. Se usará ${defaultLevelId}.`);
      }
      this.registry.remove('activeCampaignLevelConfig');
      this.registry.remove('activeCampaignLevelConfigPath');
      return defaultLevelId;
    }

    this.registry.set('activeCampaignLevelConfig', data.campaignLevelConfig);
    this.registry.set('activeCampaignLevelConfigPath', data.campaignLevelConfigPath ?? null);

    const configAsRecord = data.campaignLevelConfig as Record<string, unknown>;
    const candidateLevelId = [
      configAsRecord.runtimeLevelId,
      configAsRecord.runtime_level_id,
      configAsRecord.level_id,
      configAsRecord.levelId
    ].find((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);

    if (!candidateLevelId) {
      console.warn(`[LevelScene] fallback activado: ${data.campaignLevelConfigPath ?? 'sin-path'} no define runtime level id. Se usará ${defaultLevelId}.`);
      return defaultLevelId;
    }

    try {
      levelManager.loadLevel(candidateLevelId);
      console.log(`[LevelScene] carga de nivel exitosa. runtime level id: ${candidateLevelId}.`);
      return candidateLevelId;
    } catch {
      console.warn(`[LevelScene] fallback activado: runtime level id desconocido (${candidateLevelId}). Se usará ${defaultLevelId}.`);
      return defaultLevelId;
    }
  }

  private resetRuntimeStateForRestart(): void {
    this.hasTriggeredTransition = false;
    this.hasPlayerBeenDefeated = false;
    this.pauseMenuOptions = [];
    this.audioToggleOptionIndex = -1;
    this.audioVolumeOptionIndex = -1;
    this.pauseMenuTexts = [];
    this.pauseMenuIndex = 0;
    this.pauseMenuState = 'root';
    this.cleanupZonesRequired = 0;
    this.exitUnlocked = false;
    this.spawnsShutDown = false;
    this.advanceDialogueRequested = false;
    this.skipDialogueRequested = false;
    this.movementLockedByNarrative = false;
    this.firstCleanupNarrativeTriggered = false;
    this.lateRescueAlliesIntegrated = false;
    this.resistancePhaseConfig = undefined;
    this.resistancePhaseEndsAt = undefined;
    this.resistancePhaseCompleted = false;
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('interactionHint', '');
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

    const averagePlayerPosition = this.getAveragePlayerPosition();
    getAudioManager(this).setListenerPosition(averagePlayerPosition.x, averagePlayerPosition.y);
    this.playFootstepsForMovingPlayers();

    const leadPlayerX = averagePlayerPosition.x;
    this.zombieSystem?.update(leadPlayerX);

    const leadPlayer = this.players[0];
    if (leadPlayer) {
      this.allySystem?.update(leadPlayer, this.zombieSystem?.getActiveZombies() ?? [], this.time.now);
    }

    const activeZombies = this.zombieSystem?.getActiveZombies() ?? [];
    const pickupConsumers = [...this.players, ...(this.allySystem?.getActiveAllies() ?? [])];
    this.pickupSystem?.update(this.players, pickupConsumers);

    this.players.forEach((player) => {
      this.combatActionSystem?.tryStartPlayerMeleeAction(player);
    });
    this.combatActionSystem?.update(this.players, this.allySystem?.getActiveAllies() ?? [], activeZombies);

    this.registry.set('partyHud', this.buildPartyHud());
    this.refreshAllyWorldHealthBars();

    const zombiesRemaining = this.zombieSystem?.getActiveCount() ?? 0;
    this.updateResistancePhase();
    this.registry.set('zombiesRemaining', zombiesRemaining);
    this.spawnManager?.update(this.time.now);
    this.syncCleanupNarrativeProgress();
    this.levelExitSystem?.update();

    this.updateMissionProgress(zombiesRemaining);

    if (!this.hasPlayerBeenDefeated) {
      this.stairSegmentSystem?.update(this.players);
    }

    this.projectileSystem?.update();

    this.updateInteractables();
  }


  private playFootstepsForMovingPlayers(): void {
    if (this.time.now < this.nextFootstepAt) {
      return;
    }

    const movingPlayer = this.players.find((player) => {
      const body = player.body as Phaser.Physics.Arcade.Body | null;
      return Boolean(body && body.blocked.down && Math.abs(body.velocity.x) > 8);
    });

    if (!movingPlayer) {
      return;
    }

    getAudioManager(this).play('footsteps', { x: movingPlayer.x, y: movingPlayer.y, volume: 0.09 });
    this.nextFootstepAt = this.time.now + 230;
  }

  private updateInteractables(): void {
    if (!this.interactableSystem) {
      return;
    }

    const leadPlayer = this.players[0];
    if (!leadPlayer) {
      return;
    }

    const prompt = this.interactableSystem.getPromptFor(leadPlayer.x, leadPlayer.y);
    if (prompt.length > 0) {
      this.registry.set('interactionHint', prompt);
      this.interactionHintOwnedByInteractables = true;
    } else if (this.interactionHintOwnedByInteractables) {
      this.registry.set('interactionHint', '');
      this.interactionHintOwnedByInteractables = false;
    }

    if (!this.interactKey || !Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      return;
    }

    const interaction = this.interactableSystem.tryInteract(leadPlayer.x, leadPlayer.y, controlManager.getDisplayLabel('interact'));
    if (!interaction.success || !interaction.effect) {
      return;
    }

    this.applyInteractionEffect(
      interaction.definition?.id ?? 'unknown',
      interaction.effect.type,
      interaction.effect.message,
      interaction.effect.checkpoint
    );

    if (interaction.cinematicTrigger) {
      void this.triggerNarrativeCheckpoint(interaction.cinematicTrigger);
    }

    const objectiveEventType = interaction.effect.objectiveEventType ?? 'interactable_used';
    const objectiveUpdate = this.objectiveSystem?.process({
      type: objectiveEventType,
      targetId: interaction.effect.targetId ?? interaction.definition?.id
    });

    if (objectiveUpdate?.status === 'completed') {
      this.registry.set('currentObjective', this.objectiveSystem?.getActiveObjective()?.label ?? 'Objetivo completado');
    }
  }

  private applyInteractionEffect(
    interactableId: string,
    effectType: string,
    message?: string,
    checkpoint?: { x: number; y: number; label?: string }
  ): void {
    const fallbackByType: Record<string, string> = {
      door: 'Puerta desbloqueada.',
      stairs: 'Escaleras activadas.',
      vehicle: 'Vehículo preparado.',
      loot: 'Contenedor revisado.',
      switch: 'Switch activado.',
      ally_rescue: 'Aliado rescatado.'
    };

    this.showMissionStatus(message ?? fallbackByType[effectType] ?? `Interacción ejecutada: ${interactableId}`);

    if (effectType === 'ally_rescue') {
      this.integrateLateRescueAllies(LATE_ALLY_JOIN_CHECKPOINT_ID);
    }

    if (checkpoint && this.checkpointSystem) {
      this.checkpointSystem.setCheckpoint({ x: checkpoint.x, y: checkpoint.y });
      this.visitedCheckpoints.add(checkpoint.label ?? `${Math.round(checkpoint.x)},${Math.round(checkpoint.y)}`);
      this.showMissionStatus(`Checkpoint asegurado: ${checkpoint.label ?? 'progreso guardado'}.`);
    }

  }

  private refreshAllyWorldHealthBars(): void {
    const allies = this.allySystem?.getActiveAllies() ?? [];
    const activeIds = new Set(allies.map((ally) => ally.getId()));

    this.allyHealthBars.forEach((bar, allyId) => {
      if (!activeIds.has(allyId)) {
        bar.container.destroy(true);
        this.allyHealthBars.delete(allyId);
      }
    });

    allies.forEach((ally) => {
      let bar = this.allyHealthBars.get(ally.getId());
      if (!bar) {
        bar = this.createAllyWorldHealthBar(ally);
        this.allyHealthBars.set(ally.getId(), bar);
      }

      const maxHealth = Math.max(1, ally.getMaxHealth());
      const health = Phaser.Math.Clamp(Math.round(ally.getHealth()), 0, maxHealth);
      const ratio = Phaser.Math.Clamp(health / maxHealth, 0, 1);
      bar.fill.width = 44 * ratio;
      bar.nameText.setText(`[${ally.getRuntimeConfig().name.toUpperCase()}]`);
      bar.container.setPosition(ally.x, ally.y - 52);
      bar.container.setVisible(ally.active);
    });
  }

  private createAllyWorldHealthBar(ally: AllyAI): AllyWorldHealthBar {
    ally.setNameTagVisible(false);

    const nameText = this.add.text(0, -14, `[${ally.getRuntimeConfig().name.toUpperCase()}]`, {
      color: '#99f6e4',
      fontSize: '10px',
      fontFamily: '"Courier New", monospace',
      stroke: '#042f2e',
      strokeThickness: 2,
      fontStyle: 'bold'
    }).setOrigin(0.5, 1);

    const bg = this.add.rectangle(0, 0, 44, 5, 0x111827, 0.95)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0x334155, 0.9);

    const fill = this.add.rectangle(-22, 0, 44, 5, 0x34d399, 1)
      .setOrigin(0, 0);

    const container = this.add.container(ally.x, ally.y - 52, [nameText, bg, fill])
      .setDepth(27);

    return { container, fill, nameText };
  }

  private clearAllyWorldHealthBars(): void {
    this.allyHealthBars.forEach((bar) => {
      bar.container.destroy(true);
    });
    this.allyHealthBars.clear();
  }

  private setupMissionSystem(): void {
    const defaultMissionDescription = this.resistancePhaseConfig?.holdObjectiveText
      ?? `Despeja las ${this.cleanupZonesRequired} zonas del pasillo del subsuelo`;

    const objectives: MissionObjective[] = [
      {
        id: 'clear-sublevel-corridor',
        description: defaultMissionDescription,
        completedDescription: 'Pasillo despejado. Salida habilitada al siguiente tramo.',
        isCompleted: (context) => {
          const allCleanupZonesCompleted = (this.spawnManager?.getCompletedAreasCount() ?? 0) >= this.cleanupZonesRequired;
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

    if (this.resistancePhaseConfig && !this.resistancePhaseCompleted) {
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

  private setupResistancePhase(levelFlowConfig: unknown): void {
    if (!this.spawnManager || !levelFlowConfig || typeof levelFlowConfig !== 'object') {
      return;
    }

    const resistance = (levelFlowConfig as Record<string, unknown>).resistance;
    if (!resistance || typeof resistance !== 'object') {
      return;
    }

    const configAsRecord = resistance as Record<string, unknown>;
    const durationMs = Number(configAsRecord.durationMs ?? 120000);
    const holdAreaIds = Array.isArray(configAsRecord.holdAreaIds)
      ? configAsRecord.holdAreaIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
    const advanceAreaIds = Array.isArray(configAsRecord.advanceAreaIds)
      ? configAsRecord.advanceAreaIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];

    if (holdAreaIds.length === 0 || advanceAreaIds.length === 0 || durationMs <= 0) {
      return;
    }

    this.resistancePhaseConfig = {
      durationMs,
      holdAreaIds,
      advanceAreaIds,
      holdObjectiveText: typeof configAsRecord.holdObjectiveText === 'string' ? configAsRecord.holdObjectiveText : undefined,
      advanceObjectiveText: typeof configAsRecord.advanceObjectiveText === 'string' ? configAsRecord.advanceObjectiveText : undefined,
      completionEvent: {
        type: typeof configAsRecord.completionEventType === 'string' ? configAsRecord.completionEventType : 'phase_completed',
        targetId: typeof configAsRecord.completionEventTargetId === 'string'
          ? configAsRecord.completionEventTargetId
          : undefined
      }
    };

    this.resistancePhaseConfig.advanceAreaIds.forEach((areaId) => {
      this.spawnManager?.setAreaEnabled(areaId, false, 'level1-resistance-gate');
    });

    this.resistancePhaseEndsAt = this.time.now + this.resistancePhaseConfig.durationMs;
    this.registry.set('currentObjective', this.resistancePhaseConfig.holdObjectiveText ?? 'Resistan hasta que se abra el paso.');
    this.showMissionStatus('Fase 1: resistir 2 minutos en el comedor.');
  }

  private updateResistancePhase(): void {
    if (!this.resistancePhaseConfig || this.resistancePhaseCompleted || this.resistancePhaseEndsAt === undefined) {
      return;
    }

    const remainingMs = Math.max(0, this.resistancePhaseEndsAt - this.time.now);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
    const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
    this.registry.set('currentObjective', `Resiste en el comedor (${minutes}:${seconds})`);

    if (remainingMs > 0) {
      return;
    }

    this.resistancePhaseCompleted = true;
    this.resistancePhaseConfig.advanceAreaIds.forEach((areaId) => {
      this.spawnManager?.setAreaEnabled(areaId, true, 'level1-resistance-complete');
    });

    const completionEvent = this.resistancePhaseConfig.completionEvent;
    if (completionEvent) {
      this.objectiveSystem?.process(completionEvent);
    }

    this.registry.set(
      'currentObjective',
      this.resistancePhaseConfig.advanceObjectiveText ?? 'Abran paso por los pasillos y alcancen las escaleras a Planta Baja.'
    );
    this.showMissionStatus('Fase 2: avance por pasillos hacia las escaleras.');
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
    this.spawnManager?.setEnabled(false, reason);
    console.info(`[GameScene] spawn systems disabled (${reason})`);
  }

  private syncCleanupNarrativeProgress(): void {
    if (this.firstCleanupNarrativeTriggered) {
      return;
    }

    if ((this.spawnManager?.getCompletedAreasCount() ?? 0) <= 0) {
      return;
    }

    this.firstCleanupNarrativeTriggered = true;
    void this.triggerNarrativeCheckpoint('level2-checkpoint-first-zone-cleared');
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
    this.input.keyboard?.on('keydown-SPACE', this.onNarrativeAdvanceKey);
    this.input.keyboard?.on('keydown-X', this.onNarrativeSkipKey);
    this.input.keyboard?.on('keydown-ONE', this.onDialogueChoice1Key);
    this.input.keyboard?.on('keydown-TWO', this.onDialogueChoice2Key);
    this.input.keyboard?.on('keydown-THREE', this.onDialogueChoice3Key);
  }

  private unregisterNarrativeControls(): void {
    this.input.keyboard?.off('keydown-SPACE', this.onNarrativeAdvanceKey);
    this.input.keyboard?.off('keydown-X', this.onNarrativeSkipKey);
    this.input.keyboard?.off('keydown-ONE', this.onDialogueChoice1Key);
    this.input.keyboard?.off('keydown-TWO', this.onDialogueChoice2Key);
    this.input.keyboard?.off('keydown-THREE', this.onDialogueChoice3Key);
  }

  private setNarrativeMovementLock(locked: boolean): void {
    if (this.movementLockedByNarrative === locked) {
      return;
    }

    this.movementLockedByNarrative = locked;
    this.registry.set('isGamePaused', locked);

    const audioManager = getAudioManager(this);
    if (locked) {
      audioManager.startCinematicMusic();
      this.physics.world.pause();
      this.players.forEach((player) => player.setVelocity(0, 0));
      return;
    }

    audioManager.stopCinematicMusic();

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
    this.refreshAllyWorldHealthBars();
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

  private drawSubsueloBackground(levelWidth: number, levelHeight: number, floorHeight: number, profile: EnvironmentProfile | null): void {
    const { palette } = visualTheme;
    const usesInstitutionalHall = profile?.level.zones.includes('hall_publico') ?? false;
    const usesVerticalCore = profile?.level.zones.includes('circulacion_vertical') ?? false;
    const usesServiceWing = profile?.level.zones.includes('servicios_comedor_cocina') ?? false;

    const skyTop = usesInstitutionalHall ? 0xd9c6a3 : palette.skyTop;
    const skyBottom = usesInstitutionalHall ? 0xb79f78 : palette.skyBottom;
    const farWall = usesInstitutionalHall ? 0xc7b08d : palette.wallFar;
    const midWall = usesServiceWing ? 0x9e8a6d : palette.wallMid;
    const nearWall = usesVerticalCore ? 0x6f5a45 : palette.wallNear;

    const base = this.add.graphics();
    base.fillGradientStyle(skyTop, skyTop, skyBottom, skyBottom, 1);
    base.fillRect(0, 0, levelWidth, levelHeight);
    base.fillStyle(farWall, 1);
    base.fillRect(0, 54, levelWidth, 210);
    base.fillStyle(midWall, 1);
    base.fillRect(0, 150, levelWidth, 170);
    base.fillStyle(nearWall, 1);
    base.fillRect(0, levelHeight - floorHeight - 58, levelWidth, 58);
    base.destroy();

    if (profile) {
      const hasHallGlow = Object.values(profile.zoneLayerPreset).flat().includes('bg_hall_window_glow');
      const hasStairDepth = Object.values(profile.zoneLayerPreset).flat().includes('bg_staircase_void_depth');
      const hasServicePipes = Object.values(profile.zoneLayerPreset).flat().includes('bg_service_pipes_and_vents');

      if (hasHallGlow) {
        for (let x = 140; x < levelWidth; x += 260) {
          this.add.rectangle(x, 104, 110, 64, 0xf5deb3, 0.08).setDepth(0.8).setScrollFactor(0.35, 1);
        }
      }

      if (hasStairDepth) {
        for (let x = 110; x < levelWidth; x += 320) {
          this.add.rectangle(x, levelHeight - floorHeight - 130, 42, 170, 0x2f251d, 0.26).setDepth(1.8).setScrollFactor(0.6, 1);
        }
      }

      if (hasServicePipes) {
        for (let x = 60; x < levelWidth; x += 180) {
          this.add.rectangle(x, 74, 120, 6, 0x6b7280, 0.35).setDepth(1.2).setScrollFactor(0.45, 1);
          this.add.rectangle(x + 42, 86, 36, 6, 0x9ca3af, 0.22).setDepth(1.2).setScrollFactor(0.45, 1);
        }
      }
    }

    this.add.tileSprite(levelWidth / 2, 126, levelWidth, 180, 'ground-placeholder')
      .setDepth(0.6)
      .setAlpha(0.1)
      .setScrollFactor(0.3, 1);

    this.add.tileSprite(levelWidth / 2, levelHeight - floorHeight - 86, levelWidth, 110, 'ground-placeholder')
      .setDepth(1.4)
      .setAlpha(0.16)
      .setScrollFactor(0.65, 1);

    this.add.tileSprite(levelWidth / 2, levelHeight - floorHeight - 34, levelWidth, 48, 'ground-placeholder')
      .setDepth(2.8)
      .setAlpha(0.24)
      .setScrollFactor(0.9, 1);

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

      const lampGlow = this.add.circle(x, 42, 34, palette.lamp, 0.08)
        .setDepth(2.9)
        .setBlendMode(Phaser.BlendModes.ADD);

      this.tweens.add({
        targets: lampGlow,
        alpha: { from: 0.05, to: 0.14 },
        duration: Phaser.Math.Between(900, 1400),
        repeat: -1,
        yoyo: true,
        ease: 'Sine.InOut'
      });
    }
  }


  private placeSubsueloProps(environment: Phaser.Physics.Arcade.StaticGroup, tableTopY: number): void {
    const scalePxPerMeter = level2Subsuelo.unidades.escalaPxPorMetro;
    const defaultTopY = tableTopY + 12;

    const zoneProps = Object.values(this.activeEnvironmentProfile?.zoneProps ?? {}).flat() as string[];

    corridorObjectsConfig.objetos.forEach((objeto) => {
      const widthPx = Math.max(24, Math.round(objeto.tamaño_aproximado.ancho_m * scalePxPerMeter));
      const heightPx = Math.max(24, Math.round(objeto.tamaño_aproximado.alto_m * scalePxPerMeter));
      const centerX = objeto.posición.x;
      const centerY = objeto.posición.y;

      if (objeto.bloquea_movimiento) {
        this.createPlatform(environment, {
          x: centerX,
          y: centerY,
          width: Math.max(28, Math.round(widthPx * 0.9)),
          height: Math.max(16, Math.round(Math.min(32, heightPx * 0.28)))
        });
      }

      this.renderSubsueloProp(objeto.tipo, centerX, centerY, widthPx, heightPx, defaultTopY, zoneProps);
    });
  }

  private renderSubsueloProp(
    tipo: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fallbackTopY: number,
    zoneProps: string[]
  ): void {
    const lowerY = Math.max(y, fallbackTopY);

    if (tipo.includes('columna')) {
      addEnvironmentProp(this, { kind: 'stone-column', x, y: lowerY - 38, depth: 6, scale: Phaser.Math.Clamp(height / 96, 0.8, 1.4) });
      return;
    }

    if (tipo.includes('cajero')) {
      addEnvironmentProp(this, { kind: 'atm', x, y: lowerY - 44, depth: 6, scale: Phaser.Math.Clamp(width / 50, 0.9, 1.4) });
      return;
    }

    if (tipo.includes('banco')) {
      addEnvironmentProp(this, { kind: 'bench', x, y: lowerY - 8, depth: 6, scale: Phaser.Math.Clamp(width / 96, 0.8, 1.5) });
      return;
    }

    if (tipo.includes('pantalla')) {
      addEnvironmentProp(this, { kind: 'info-screen', x, y: lowerY - 36, depth: 6, scale: Phaser.Math.Clamp(height / 78, 0.8, 1.3) });
      return;
    }

    if (zoneProps.includes('mostrador_bna_lineal') && (tipo.includes('mostrador') || tipo.includes('control'))) {
      addEnvironmentProp(this, { kind: 'bank-counter', x, y: lowerY - 18, depth: 6, scale: Phaser.Math.Clamp(width / 128, 0.85, 1.4) });
      return;
    }

    if (zoneProps.includes('molinete_brazos_vidrio') && (tipo.includes('acceso') || tipo.includes('molinete'))) {
      addEnvironmentProp(this, { kind: 'turnstile', x, y: lowerY - 20, depth: 6, scale: Phaser.Math.Clamp(height / 82, 0.8, 1.3) });
      return;
    }

    if (tipo.includes('reciclaje') || tipo.includes('solidaria')) {
      addEnvironmentProp(this, { kind: 'recycling-box', x, y: lowerY - 18, depth: 6, scale: Phaser.Math.Clamp(width / 34, 0.85, 1.4) });
      return;
    }

    addEnvironmentProp(this, { kind: 'cart', x, y: lowerY - 12, depth: 6, scale: 1 });
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
    const didTakeDamage = player.takeDamage(runtime.zombieContactDamage, this.time.now, { sourceX: this.getClosestZombieXToPlayer(player) });
    if (!didTakeDamage) {
      return;
    }

    this.registry.set('partyHud', this.buildPartyHud());
    this.refreshAllyWorldHealthBars();

    if (player.isDead()) {
      this.handlePlayerDefeat();
    }
  }

  private getClosestZombieXToPlayer(player: Player): number | undefined {
    const zombies = this.zombieSystem?.getActiveZombies() ?? [];
    let closestX: number | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    zombies.forEach((zombie) => {
      const distance = Phaser.Math.Distance.Between(player.x, player.y, zombie.x, zombie.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        closestX = zombie.x;
      }
    });

    return closestX;
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
      this.levelRestartManager?.restartLevel({
        respawnPoint: this.respawnPoint,
        preserveCampaignProgress: true
      });
    });
  }

  private createLevel4StairSegmentSystemExample(): StairSegmentSystem {
    return new StairSegmentSystem(this, level4StairSegments);
  }

  private resolveRespawnPoint(data: GameSceneData, fallback: Checkpoint): Checkpoint {
    return this.checkpointSystem?.resolveRespawnPoint(data, fallback) ?? fallback;
  }

  private resetEnemiesForRestart(): void {
    const zombies = this.zombieSystem?.getActiveZombies() ?? [];
    zombies.forEach((zombie) => {
      zombie.disableBody(true, true);
      zombie.setActive(false);
      zombie.setVisible(false);
    });
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

      const inventory = player.getInventoryState();

      return {
        id: `player-${profile.slot}`,
        name: runtime.name,
        role,
        health: player.getHealth(),
        maxHealth: player.getMaxHealth(),
        activeSlot: inventory.activeSlot,
        activeWeapon: inventory.activeWeapon,
        primaryWeapon: inventory.primaryWeapon,
        secondaryWeapon: inventory.secondaryWeapon,
        usesAmmo: inventory.usesAmmo,
        ammoType: inventory.ammoType,
        ammoCurrent: inventory.ammoCurrent,
        ammoMax: inventory.ammoMax,
        ammoReserve: inventory.ammoReserve,
        isReloading: inventory.isReloading
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

    const allyHealthById = new Map((this.allySystem?.getActiveAllies() ?? [])
      .map((ally) => [
        ally.getId(),
        {
          health: ally.getHealth(),
          maxHealth: ally.getMaxHealth(),
          inventory: ally.getInventoryState()
        }
      ]));

    const allyEntries = prioritizedAllies.map((member) => {
      const runtime = getCharacterRuntimeConfig(member.characterId ?? 'alan');
      const healthSnapshot = allyHealthById.get(member.id);

      return {
        id: member.id,
        name: member.name,
        role: 'ally' as const,
        health: healthSnapshot?.health ?? runtime.maxHealth,
        maxHealth: healthSnapshot?.maxHealth ?? runtime.maxHealth,
        activeSlot: healthSnapshot?.inventory?.activeSlot ?? runtime.loadout.activeSlot,
        activeWeapon: healthSnapshot?.inventory?.activeWeapon ?? runtime.weaponRuntime.key,
        primaryWeapon: healthSnapshot?.inventory?.primaryWeapon ?? runtime.loadout.primaryWeapon,
        secondaryWeapon: healthSnapshot?.inventory?.secondaryWeapon ?? runtime.loadout.secondaryWeapon,
        usesAmmo: healthSnapshot?.inventory?.usesAmmo,
        ammoType: healthSnapshot?.inventory?.ammoType,
        ammoCurrent: healthSnapshot?.inventory?.ammoCurrent,
        ammoMax: healthSnapshot?.inventory?.ammoMax,
        ammoReserve: healthSnapshot?.inventory?.ammoReserve,
        isReloading: healthSnapshot?.inventory?.isReloading
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
    this.input.keyboard?.on(controlManager.getPhaserEventName('pause'), this.onPauseToggleKey);
    this.input.keyboard?.on(controlManager.getPhaserEventName('quit'), this.onPauseBackKey);
    this.input.keyboard?.on('keydown-UP', this.onPauseUpKey);
    this.input.keyboard?.on('keydown-DOWN', this.onPauseDownKey);
    this.input.keyboard?.on(controlManager.getPhaserEventName('next_level'), this.onPauseConfirmKey);
    this.input.keyboard?.on('keydown-LEFT', this.onPauseLeftKey);
    this.input.keyboard?.on('keydown-RIGHT', this.onPauseRightKey);
  }

  private unregisterPauseControls(): void {
    this.input.keyboard?.off(controlManager.getPhaserEventName('pause'), this.onPauseToggleKey);
    this.input.keyboard?.off(controlManager.getPhaserEventName('quit'), this.onPauseBackKey);
    this.input.keyboard?.off('keydown-UP', this.onPauseUpKey);
    this.input.keyboard?.off('keydown-DOWN', this.onPauseDownKey);
    this.input.keyboard?.off(controlManager.getPhaserEventName('next_level'), this.onPauseConfirmKey);
    this.input.keyboard?.off('keydown-LEFT', this.onPauseLeftKey);
    this.input.keyboard?.off('keydown-RIGHT', this.onPauseRightKey);
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
    audioManager.stopCinematicMusic();
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
      { label: this.getFormattedControlSummary(), action: () => undefined },
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

  private getFormattedControlSummary(): string {
    return [
      `Controles: ${controlManager.getMovementDisplayLabel()}`,
      `Saltar ${controlManager.getDisplayLabel('jump')}`,
      `Disparar ${controlManager.getDisplayLabel('shoot')}`,
      `Recargar ${controlManager.getDisplayLabel('reload')}`,
      `Cambiar arma ${controlManager.getDisplayLabel('switch_weapon')}`,
      `Interactuar ${controlManager.getDisplayLabel('interact')}`,
      `Siguiente nivel ${controlManager.getDisplayLabel('next_level')}`,
      `Pausa ${controlManager.getDisplayLabel('pause')}`,
      `Abandonar ${controlManager.getDisplayLabel('quit')}`
    ].join(' / ');
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
    this.input.keyboard?.on('keydown-F5', this.onSaveApiKey);
    this.input.keyboard?.on('keydown-F9', this.onLoadApiKey);
  }

  private unregisterApiControls(): void {
    this.input.keyboard?.off('keydown-F5', this.onSaveApiKey);
    this.input.keyboard?.off('keydown-F9', this.onLoadApiKey);
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
      const protagonistRaw = snapshot.setup.protagonist;
      const protagonist = protagonistRaw === 'alan' || protagonistRaw === 'alan-nahuel' || protagonistRaw === 'alanNahuel'
        ? 'alan'
        : protagonistRaw === 'giovanna'
          ? 'giovanna'
          : null;
      const difficulty = snapshot.setup.difficulty;
      const validDifficulty = difficulty === 'complejo' || difficulty === 'pesadilla';

      const existing = this.getInitialSetup();
      if (!existing && protagonist && validDifficulty) {
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
