import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { AllyAI } from '../entities/AllyAI';
import { DEFAULT_ZOMBIE_HEALTH } from '../entities/Zombie';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ZombieSystem } from '../systems/ZombieSystem';
import { MissionObjective, MissionSystem } from '../systems/MissionSystem';
import { StairSegmentSystem } from '../systems/StairSegmentSystem';
import { AllySystem } from '../systems/AllySystem';
import { LevelExitSystem, LevelExitTarget } from '../systems/LevelExitSystem';
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
  normalizeProgressSceneKey,
  parseCheckpoint,
  PartyHudMember,
  PauseMenuView,
  TransitionView
} from './sceneShared';
import { SceneFlowManager } from './SceneFlowManager';
import { visualTheme } from './visualTheme';
import { addCheckpointCinematicCard, addRetroScreenOverlay, applyRetroRenderer, RETRO_CHECKPOINTS } from './retroPixelArt';
import { CampaignState } from '../systems/core/CampaignState';
import { PartyStateSystem } from '../systems/core/PartyStateSystem';
import { EnvironmentProfile, getEnvironmentZoneVisual, registerEnvironmentProfile } from '../config/environmentProfiles';
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
import { PickupSystem, PickupDefinition } from '../systems/PickupSystem';
import { levelManager } from '../systems/level/levelCatalog';
import { ObjectiveSystem } from '../systems/core/ObjectiveSystem';
import { InteractableSystem } from '../systems/core/InteractableSystem';
import { TriggerSystem } from '../systems/TriggerSystem';
import { CinematicSystem } from '../systems/core/CinematicSystem';
import { DialogueSystem } from '../systems/core/DialogueSystem';
import { LevelRestartManager } from '../systems/core/LevelRestartManager';
import { CheckpointSystem } from '../systems/core/CheckpointSystem';
import { CombatFeedbackSystem } from '../systems/CombatFeedbackSystem';
import {
  AmbientVisualSystem,
  type AmbientZoneDefinition
} from '../systems/AmbientVisualSystem';

const PLAYER_RESPAWN_DELAY_MS = 1800;
const API_MESSAGE_DURATION_MS = 2600;
const ARCADE_CAMERA_ZOOM = 1.34;
// Este checkpoint queda reservado para una futura integración narrativa.
// En nivel 1 no debe incorporar a Lorena/Selene.
const LATE_ALLY_JOIN_CHECKPOINT_ID = 'late-rescue-allies-join';
const INITIAL_DINING_LEVEL_ID =
  'level_1_subsuelo_comedor';
const CANONICAL_DINING_LEVEL_ID =
  'level_1_comedor_resistencia';
const SPIRAL_HALL_LEVEL_ID =
  'level_2_escaleras_espiral';

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

type PauseMenuState = 'root' | 'options';

export class GameScene extends Phaser.Scene {
  private players: Player[] = [];
  private currentLevelId = INITIAL_DINING_LEVEL_ID;
  private projectileSystem?: ProjectileSystem;
  private combatActionSystem?: CombatActionSystem;
  private combatFeedbackSystem?: CombatFeedbackSystem;
  private ambientVisualSystem?: AmbientVisualSystem;
  private pickupSystem?: PickupSystem;
  private zombieSystem?: ZombieSystem;
  private missionSystem?: MissionSystem;
  private stairSegmentSystem?: StairSegmentSystem;
  private allySystem?: AllySystem;
  private spawnManager?: SpawnManager;
  private levelExitSystem?: LevelExitSystem;
  private missionStatusText?: Phaser.GameObjects.Text;
  private apiStatusText?: Phaser.GameObjects.Text;
  private apiStatusVersion = 0;
  private campaignState?: CampaignState;
  private partyState?: PartyStateSystem;
  private hasTriggeredTransition = false;
  private pendingExitTarget?: LevelExitTarget;
  private exitTransitionTimer?: Phaser.Time.TimerEvent;
  private exitTransitionCommitInProgress = false;
  private hasPlayerBeenDefeated = false;
  private respawnPoint?: Checkpoint;
  private pauseMenuVisible = false;
  private pauseMenuHint = '';
  private pauseMenuOptions: Array<{ label: string; action: () => void }> = [];
  private audioToggleOptionIndex = -1;
  private audioVolumeOptionIndex = -1;
  private pauseMenuIndex = 0;
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
  private readonly triggeredRetroCheckpoints = new Set<string>();
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
    if (this.hasPlayerBeenDefeated || this.hasTriggeredTransition) {
      return;
    }

    void this.saveProgressToApi();
  };
  private readonly onLoadApiKey = () => {
    if (this.hasPlayerBeenDefeated || this.hasTriggeredTransition) {
      return;
    }

    void this.loadProgressFromApi();
  };

  constructor(sceneKey = 'GameScene') {
    super(sceneKey);
  }

  create(data: GameSceneData = {}): void {
    this.resetRuntimeStateForRestart();
    if (this.shouldTriggerIntroCinematic(data)) {
      this.visitedCheckpoints.clear();
    }
    applyRetroRenderer(this);

    const selectedLevelId = this.resolveLevelIdFromCampaignConfig(data);
    const pendingCampaignNodeId =
      this.registry.get('pendingCampaignNodeId') as string | undefined;

    if (
      pendingCampaignNodeId
      && data.flowNodeId
      && pendingCampaignNodeId !== data.flowNodeId
    ) {
      console.error('[GameScene] El nodo reiniciado no coincide con el nodo pendiente.', {
        pendingCampaignNodeId,
        receivedFlowNodeId: data.flowNodeId,
        campaignLevelConfigPath: data.campaignLevelConfigPath ?? null
      });
    }

    this.registry.remove('pendingCampaignNodeId');
    this.currentLevelId = selectedLevelId;
    const isInitialDiningLevel =
      selectedLevelId === INITIAL_DINING_LEVEL_ID
      || selectedLevelId === CANONICAL_DINING_LEVEL_ID;
    const isSpiralHallLevel =
      selectedLevelId === SPIRAL_HALL_LEVEL_ID;

    this.registry.set(
      'activeRuntimeLevelId',
      selectedLevelId
    );

    console.info('[GameScene] runtime jugable seleccionado', {
      runtimeLevelId: selectedLevelId,
      flowNodeId: data.flowNodeId ?? null,
      campaignLevelConfigPath:
        data.campaignLevelConfigPath ?? null,
      isInitialDiningLevel,
      isSpiralHallLevel
    });

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

    this.combatFeedbackSystem = new CombatFeedbackSystem(this, this.cameras.main);
    this.registry.set('combatFeedbackSystem', this.combatFeedbackSystem);

    this.drawSubsueloBackground(levelConfig.layout, floorHeight, this.activeEnvironmentProfile);
    const ambientZones =
      (levelConfig.layout.background_zones ?? []) as AmbientZoneDefinition[];

    this.ambientVisualSystem = new AmbientVisualSystem(this, {
      levelWidth,
      levelHeight,
      floorTop: levelHeight - floorHeight,
      zones: ambientZones
    });
    this.ambientVisualSystem.create();
    addRetroScreenOverlay(this, 17.5);

    const environment = this.physics.add.staticGroup();

    this.createPlatform(environment, {
      x: levelWidth / 2,
      y: floorY,
      width: levelWidth,
      height: floorHeight
    });

    if (isInitialDiningLevel) {
      this.placeSubsueloProps(environment, tableTopY);
      this.placeDiningRoomProps(
        environment,
        levelWidth,
        floorY
      );
    } else if (isSpiralHallLevel) {
      this.placeSpiralHallProps(
        levelWidth,
        levelHeight - floorHeight
      );
    }

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

    const loadedSnapshot = this.registry.get('loadedCampaignSnapshot') as CampaignSnapshot | undefined;
    const carriedParty = this.registry.get('partyState') as ReturnType<PartyStateSystem['getSnapshot']> | undefined;
    const carriedCampaign = this.registry.get('campaignState') as ReturnType<CampaignState['getSnapshot']> | undefined;
    const loadedActivePartyNames = new Set(loadedSnapshot?.party.active ?? []);
    const loadedRescuedPartyNames = new Set(loadedSnapshot?.party.rescued ?? []);
    const runtimePartyAllies = [
      ...partySeed.allies.filter((ally) => !carriedParty
        || carriedParty.some((member) => member.id === ally.id && member.status === 'active')),
      ...LATE_RESCUE_ALLIES
        .filter((ally) => (
          (carriedParty?.some((member) => member.id === ally.id && member.status === 'active') ?? false)
          || loadedActivePartyNames.has(ally.name)
        ) && !partySeed.allies.some((seedAlly) => seedAlly.id === ally.id))
        .map((ally) => ({ ...ally }))
    ];
    this.campaignState = new CampaignState(data.flowNodeId ?? 'GameScene', carriedCampaign ?? {
      activeCharacters: [
        ...activePlayerConfigs.map((config) => `player-${config.slot}`),
        ...runtimePartyAllies.map((ally) => ally.id)
      ],
      rescuedCharacters: runtimePartyAllies
        .filter((ally) => loadedRescuedPartyNames.has(ally.name)
          || LATE_RESCUE_ALLIES.some((lateAlly) => lateAlly.id === ally.id && loadedActivePartyNames.has(ally.name)))
        .map((ally) => ally.id),
      narrativeProgress: loadedSnapshot?.narrative.flags ?? {},
      irreversibleEvents: loadedSnapshot?.narrative.irreversible_events ?? [],
      seenCinematics: loadedSnapshot?.narrative.seen_cinematics ?? []
    });
    this.partyState = carriedParty ? PartyStateSystem.restore(carriedParty) : new PartyStateSystem([
      ...activePlayerConfigs.map((config) => ({
        id: `player-${config.slot}`,
        name: config.name,
        characterId: config.characterId,
        controlMode: 'human' as const,
        status: 'active' as const,
        permanentlyLost: false,
        narrative: { deathPending: false }
      })),
      ...runtimePartyAllies.map((ally) => ({
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

    if (isInitialDiningLevel) {
      const initialSegmentSpawns = level2Subsuelo.segmentos[0]?.spawnPointsPosibles ?? [];
      initialSegmentSpawns.forEach((spawnPoint) => {
        this.zombieSystem?.spawn(spawnPoint.x, spawnPoint.y);
      });
    }

    this.spawnManager = levelManager.instantiateSpawns(selectedLevelId, this, this.zombieSystem, this.players, {
      spawnPressureMultiplier: difficultyRuntime.spawnPressureMultiplier,
      getEnemyLimit: () => this.zombieSystem?.getGroup().maxSize ?? Number.MAX_SAFE_INTEGER
    });
    this.cleanupZonesRequired = this.spawnManager.getTotalAreasCount();
    this.setupResistancePhase(levelConfig.layout.level_flow);
    this.objectiveSystem = levelManager.instantiateObjectives(selectedLevelId);
    this.interactableSystem = levelManager.instantiateInteractables(
      selectedLevelId,
      controlManager.getDisplayLabel('interact')
    );
    const runtimeExitIds = new Set(
      levelConfig.exits.map((exit) => exit.id)
    );
    const hasExplicitRuntimeExit =
      levelConfig.interactables.some(
        (interactable) => {
          const effect = interactable.interactionEffect;

          return Boolean(
            effect?.targetId
            && (
              effect.type === 'stairs'
              || effect.type === 'door'
              || effect.type === 'vehicle'
            )
            && runtimeExitIds.has(effect.targetId)
          );
        }
      );
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
          canSkip: true,
          canAdvance: true
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
        isDialogueInterrupted: () => this.skipDialogueRequested,
        consumeDialogueAdvance: () => {
          if (!this.advanceDialogueRequested) {
            return false;
          }

          this.advanceDialogueRequested = false;
          return true;
        }
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

    if (!hasExplicitRuntimeExit) {
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
        transitionDelayMs: 700,
        onTransitionComplete: (target) => {
          this.completeExitTransition(target);
        }
      },
      () => this.spawnManager?.getCompletedAreasCount() ?? 0,
      (message) => this.showMissionStatus(message),
      (transitionMessage) => this.triggerLevelExitTransition(transitionMessage),
      () => this.handleExitUnlocked()
      );
    }

    const leadPlayer = this.players[0];
    if (leadPlayer) {
      this.allySystem.spawnInitialAllies(leadPlayer, runtimePartyAllies);
    }

    const configuredPickups = (levelConfig.pickups as PickupDefinition[] | undefined) ?? level2PickupConfig.pickups;
    this.pickupSystem = PickupSystem.fromJSON(this, { pickups: configuredPickups });
    this.interactKey = this.input.keyboard?.addKey(controlManager.getKeyCode('interact'));

    if (isInitialDiningLevel) {
      this.setupMissionSystem();
      this.stairSegmentSystem = StairSegmentSystem.fromLegacyStairAreas(this, stairConfigLevel2);
      stairConfigLevel2.stairs.forEach((stair) => {
        this.addStairVisual(stair.x, stair.y, stair.width, stair.height);
      });
    }

    // Ejemplo de integración para Nivel 4 (escaleras por tramos + rellanos desde JSON):
    // const level4Stairs = new StairSegmentSystem(this, level4StairSegments);

    this.createMissionStatusUI();
    this.createPauseMenuUI();

    this.cameras.main.setBackgroundColor('#0a1020');
    this.registry.set('partyHud', this.buildPartyHud());
    this.registry.set('zombiesRemaining', this.zombieSystem.getActiveCount());
    const initialObjective =
      this.resistancePhaseConfig?.holdObjectiveText
      ?? this.objectiveSystem?.getActiveObjective()?.label
      ?? this.missionSystem?.getActiveObjectiveText()
      ?? '';
    this.registry.set('currentObjective', initialObjective);
    this.registry.set('interactionHint', '');
    this.registry.set('campaignState', this.campaignState?.getSnapshot());
    this.registry.set('partyState', this.partyState?.getSnapshot());
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('audioMuted', getAudioManager(this).isMuted());
    this.registry.set('audioVolume', getAudioManager(this).getVolumePercent());
    this.registry.set('gameDifficultyLabel', difficultyRuntime.label);

    if (isInitialDiningLevel) {
      this.setupNarrativeSystems();
    }

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
      this.exitTransitionTimer?.remove(false);
      this.exitTransitionTimer = undefined;
      this.pendingExitTarget = undefined;
      this.exitTransitionCommitInProgress = false;
      this.ambientVisualSystem?.destroy();
      this.ambientVisualSystem = undefined;
      this.combatFeedbackSystem?.destroy();
      this.combatFeedbackSystem = undefined;
      this.registry.remove('combatFeedbackSystem');
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
      this.pauseMenuVisible = false;
      this.publishPauseMenuView();
      this.setTransitionView(false, '');
      this.setNarrativeMovementLock(false);
      this.physics.resume();
      getAudioManager(this).stopGameplayAmbient();
    });
  }

  private resolveLevelIdFromCampaignConfig(data: GameSceneData): string {
    const defaultLevelId = INITIAL_DINING_LEVEL_ID;

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
      return candidateLevelId;
    } catch {
      console.warn(`[LevelScene] fallback activado: runtime level id desconocido (${candidateLevelId}). Se usará ${defaultLevelId}.`);
      return defaultLevelId;
    }
  }

  private resetRuntimeStateForRestart(): void {
    this.exitTransitionTimer?.remove(false);
    this.exitTransitionTimer = undefined;
    this.pendingExitTarget = undefined;
    this.exitTransitionCommitInProgress = false;
    this.hasTriggeredTransition = false;
    this.hasPlayerBeenDefeated = false;
    this.pauseMenuOptions = [];
    this.audioToggleOptionIndex = -1;
    this.audioVolumeOptionIndex = -1;
    this.pauseMenuVisible = false;
    this.pauseMenuHint = '';
    this.pauseMenuIndex = 0;
    this.pauseMenuState = 'root';
    this.cleanupZonesRequired = 0;
    this.exitUnlocked = false;
    this.spawnsShutDown = false;
    this.advanceDialogueRequested = false;
    this.skipDialogueRequested = false;
    this.selectedDialogueChoiceIndex = 0;
    this.movementLockedByNarrative = false;
    this.firstCleanupNarrativeTriggered = false;
    this.lateRescueAlliesIntegrated = false;
    this.nextFootstepAt = 0;
    this.resistancePhaseConfig = undefined;
    this.resistancePhaseEndsAt = undefined;
    this.resistancePhaseCompleted = false;
    this.missionSystem = undefined;
    this.stairSegmentSystem = undefined;
    this.cinematicCallSystem = undefined;
    this.objectiveSystem = undefined;
    this.interactableSystem = undefined;
    this.triggerSystem = undefined;
    this.levelCinematicSystem = undefined;
    this.dialogueSystem = undefined;
    this.levelExitSystem = undefined;
    this.spawnManager = undefined;
    this.pickupSystem = undefined;
    this.checkpointSystem = undefined;
    this.levelRestartManager = undefined;
    this.triggeredRetroCheckpoints.clear();
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('interactionHint', '');
  }

  update(): void {
    if (this.isPauseMenuOpen()) {
      return;
    }

    this.ambientVisualSystem?.update(this.time.now);
    this.updateResistancePhase();

    if (this.movementLockedByNarrative) {
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

    if (!this.hasPlayerBeenDefeated) {
      this.zombieSystem?.update(this.players);
    }

    const leadPlayer = this.players.find((player) => !player.isDead());
    if (leadPlayer) {
      this.allySystem?.update(leadPlayer, this.zombieSystem?.getActiveZombies() ?? [], this.time.now);
    }

    const activeZombies = this.zombieSystem?.getActiveZombies() ?? [];
    const livingPlayers = this.players.filter((player) => !player.isDead());
    const pickupConsumers = [...livingPlayers, ...(this.allySystem?.getActiveAllies() ?? [])];
    this.pickupSystem?.update(livingPlayers, pickupConsumers);

    livingPlayers.forEach((player) => {
      this.combatActionSystem?.tryStartPlayerMeleeAction(player);
    });
    if (!this.hasPlayerBeenDefeated) {
      this.combatActionSystem?.update(livingPlayers, this.allySystem?.getActiveAllies() ?? [], activeZombies);
    }

    this.registry.set('partyHud', this.buildPartyHud());

    const zombiesRemaining = this.zombieSystem?.getActiveCount() ?? 0;
    this.registry.set('zombiesRemaining', zombiesRemaining);
    if (!this.hasPlayerBeenDefeated) {
      this.spawnManager?.update(this.time.now);
    }
    this.syncCleanupNarrativeProgress();
    if (!this.hasPlayerBeenDefeated) {
      this.levelExitSystem?.update();
    }

    this.updateMissionProgress(zombiesRemaining);

    if (!this.hasPlayerBeenDefeated) {
      this.stairSegmentSystem?.update(livingPlayers);
    }

    if (!this.hasPlayerBeenDefeated) {
      this.projectileSystem?.update();
    }

    this.updateInteractables();
    this.updateRetroCheckpointCinematics();
  }



  private updateRetroCheckpointCinematics(): void {
    if (this.currentLevelId !== INITIAL_DINING_LEVEL_ID || this.hasPlayerBeenDefeated || this.movementLockedByNarrative || this.hasTriggeredTransition) {
      return;
    }

    const cameraBounds = this.cameras.main.getBounds();
    const levelWidth = Math.max(1, cameraBounds.width || this.physics.world.bounds.width);
    const averagePlayerPosition = this.getAveragePlayerPosition();
    const progressRatio = Phaser.Math.Clamp(averagePlayerPosition.x / levelWidth, 0, 1);
    const checkpoint = RETRO_CHECKPOINTS.find((candidate) => progressRatio >= candidate.ratio && !this.triggeredRetroCheckpoints.has(candidate.id));

    if (!checkpoint) {
      return;
    }

    this.triggeredRetroCheckpoints.add(checkpoint.id);
    void this.triggerNarrativeCheckpoint(checkpoint.id);
    this.flashRetroCheckpointCard(checkpoint.label, 'Cinemática de avance desbloqueada');
  }

  private flashRetroCheckpointCard(title: string, subtitle: string): void {
    const card = addCheckpointCinematicCard(this, title, subtitle);
    this.tweens.add({
      targets: card,
      alpha: { from: 0, to: 1 },
      duration: 160,
      yoyo: true,
      hold: 1250,
      ease: 'Stepped',
      onComplete: () => card.destroy(true)
    });
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

    const leadPlayer = this.players.find((player) => !player.isDead());
    if (!leadPlayer) {
      if (this.interactionHintOwnedByInteractables) {
        this.registry.set('interactionHint', '');
        this.interactionHintOwnedByInteractables = false;
      }
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

    const objectiveEventType = interaction.effect.objectiveEventType ?? 'interactable_used';
    const objectiveUpdate = this.objectiveSystem?.process({
      type: objectiveEventType,
      targetId: interaction.effect.targetId ?? interaction.definition?.id
    });

    if (objectiveUpdate?.status === 'completed') {
      this.registry.set('currentObjective', this.objectiveSystem?.getActiveObjective()?.label ?? 'Objetivo completado');
    }

    this.applyInteractionEffect(
      interaction.definition?.id ?? 'unknown',
      interaction.effect
    );

    if (interaction.cinematicTrigger) {
      void this.triggerNarrativeCheckpoint(interaction.cinematicTrigger);
    }
  }

  private applyInteractionEffect(
    interactableId: string,
    effect: {
      type: string;
      targetId?: string;
      message?: string;
      rewardPickupType?: PickupDefinition['type'];
      rewardPickupLabel?: string;
      consumesOnUse?: boolean;
      checkpoint?: { x: number; y: number; label?: string };
    }
  ): void {
    const fallbackByType: Record<string, string> = {
      door: 'Puerta desbloqueada.',
      stairs: 'Escaleras activadas.',
      vehicle: 'Vehículo preparado.',
      loot: 'Contenedor revisado.',
      switch: 'Switch activado.',
      ally_rescue: 'Aliado rescatado.'
    };

    let interactionSucceeded = true;
    let statusMessage = effect.message ?? fallbackByType[effect.type] ?? `Interacción ejecutada: ${interactableId}`;

    if (effect.rewardPickupType) {
      const livingPlayers = this.players.filter((player) => !player.isDead());
      const rewardPlayer = livingPlayers[0] ?? this.players[0];
      const consumers = [
        ...livingPlayers,
        ...(this.allySystem?.getActiveAllies() ?? [])
      ];
      interactionSucceeded = PickupSystem.applyReward({
        type: effect.rewardPickupType,
        label: effect.rewardPickupLabel,
        x: rewardPlayer?.x ?? 0,
        y: rewardPlayer?.y ?? 0
      }, consumers);

      if (interactionSucceeded) {
        statusMessage = effect.message ?? `${PickupSystem.describeReward({ type: effect.rewardPickupType, label: effect.rewardPickupLabel })} recuperado del entorno.`;
      } else {
        statusMessage = `No se pudo aprovechar ${PickupSystem.describeReward({ type: effect.rewardPickupType, label: effect.rewardPickupLabel })} ahora.`;
      }
    }

    const startsImmediateTransition = interactionSucceeded
      && ['stairs', 'door', 'vehicle'].includes(effect.type)
      && Boolean(effect.targetId);
    if (!startsImmediateTransition) {
      this.showMissionStatus(statusMessage);
    }

    if (interactionSucceeded && effect.consumesOnUse) {
      this.interactableSystem?.consume(interactableId);
    }

    if (effect.type === 'ally_rescue') {
      this.integrateLateRescueAllies(LATE_ALLY_JOIN_CHECKPOINT_ID);
    }

    if (interactionSucceeded && effect.checkpoint && this.checkpointSystem) {
      this.checkpointSystem.setCheckpoint({ x: effect.checkpoint.x, y: effect.checkpoint.y });
      this.visitedCheckpoints.add(effect.checkpoint.label ?? `${Math.round(effect.checkpoint.x)},${Math.round(effect.checkpoint.y)}`);
      this.showMissionStatus(`Checkpoint asegurado: ${effect.checkpoint.label ?? 'progreso guardado'}.`);
    }

    if (startsImmediateTransition && effect.targetId) {
      if (this.objectiveSystem && !this.objectiveSystem.isCompleted()) {
        this.showMissionStatus('La salida sigue bloqueada: completá el objetivo activo.');
        return;
      }
      this.beginExitTransition(effect.targetId, statusMessage);
    }

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
    this.showMissionStatus(
      this.resistancePhaseConfig.holdObjectiveText
      ?? 'Fase de resistencia iniciada.'
    );
  }

  private updateResistancePhase(): void {
    if (this.hasPlayerBeenDefeated || !this.resistancePhaseConfig || this.resistancePhaseCompleted || this.resistancePhaseEndsAt === undefined) {
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
    this.resistancePhaseConfig.holdAreaIds.forEach((areaId) => {
      this.spawnManager?.completeArea(areaId, 'level1-resistance-hold-complete');
    });
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
    if (
      this.currentLevelId
      !== INITIAL_DINING_LEVEL_ID
    ) {
      return;
    }

    if (this.hasPlayerBeenDefeated || this.firstCleanupNarrativeTriggered) {
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
        isSkipRequested: () => this.hasPlayerBeenDefeated || this.skipDialogueRequested
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
    const fromNewGameFlow = data.skipLoad === true
      && data.flowNodeId === 'lvl01-esc01-comedor-resistencia';
    const hasStoredCheckpoint = Boolean(this.registry.get('checkpoint'));
    const fromDirectFreshStart = data.skipLoad === undefined
      && data.flowNodeId === undefined
      && !hasStoredCheckpoint;

    return fromNewGameFlow || fromDirectFreshStart;
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

    const leadPlayer = this.players.find((player) => !player.isDead()) ?? this.players[0];
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
      color: visualTheme.palette.uiTextPrimary,
      fontSize: '22px',
      backgroundColor: '#1d1120',
      padding: { x: 20, y: 12 },
      align: 'center',
      wordWrap: { width: Math.max(320, this.scale.width - 120), useAdvancedWrap: true }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10).setVisible(false);

    this.apiStatusText = this.add.text(this.scale.width / 2, 140, '', {
      color: visualTheme.palette.uiTextSecondary,
      fontSize: '17px',
      backgroundColor: '#140d18',
      padding: { x: 16, y: 10 },
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(11).setVisible(false);

    this.setTransitionView(false, '');
  }

  private setTransitionView(
    visible: boolean,
    message: string,
    tone: TransitionView['tone'] = 'normal'
  ): void {
    const view: TransitionView = { visible, message, tone };
    this.registry.set('transitionView', view);
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
    this.shutdownSpawnSystems('level-transition');
    this.triggerSystem?.destroy();
    this.triggerSystem = undefined;
    this.interactionHintOwnedByInteractables = false;
    this.physics.pause();
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('interactionHint', '');
    this.registry.set('audioMuted', getAudioManager(this).isMuted());
    this.registry.set('audioVolume', getAudioManager(this).getVolumePercent());

    this.setTransitionView(true, message);
  }

  protected hasPendingExitTransition(): boolean {
    return Boolean(
      this.hasTriggeredTransition
      && this.pendingExitTarget
      && !this.exitTransitionCommitInProgress
    );
  }

  protected confirmPendingExitTransition(
    source: 'automatic' | 'manual'
  ): boolean {
    if (!this.hasPendingExitTransition()) {
      return false;
    }

    const target = this.pendingExitTarget;
    if (!target) {
      return false;
    }

    this.exitTransitionCommitInProgress = true;
    this.exitTransitionTimer?.remove(false);
    this.exitTransitionTimer = undefined;

    console.info(
      '[GameScene] confirmando transición de salida',
      {
        source,
        currentLevelId: this.currentLevelId,
        currentSceneKey: this.scene.key,
        targetSceneKey: target.sceneKey,
        spawnPoint: target.spawnPoint
      }
    );

    try {
      this.completeExitTransition(target);
      return true;
    } catch (error) {
      console.error(
        '[GameScene] Falló la confirmación de la transición.',
        error
      );

      this.exitTransitionCommitInProgress = false;
      this.hasTriggeredTransition = false;
      this.pendingExitTarget = undefined;

      this.setTransitionView(false, '');
      this.physics.resume();

      this.registry.set(
        'interactionHint',
        'No se pudo cambiar de nivel. Intentá usar la escalera nuevamente.'
      );

      return false;
    }
  }

  protected completeExitTransition(
    target: LevelExitTarget
  ): void {
    this.registry.set(
      'checkpoint',
      target.spawnPoint
    );

    this.scene.start(
      target.sceneKey,
      {
        respawnPoint: target.spawnPoint,
        skipLoad: true
      }
    );
  }

  private beginExitTransition(
    exitId: string,
    message: string
  ): void {
    if (
      this.hasTriggeredTransition
      || this.hasPlayerBeenDefeated
    ) {
      return;
    }

    try {
      const levelDefinition =
        levelManager.loadLevel(
          this.currentLevelId
        );

      const exit =
        levelDefinition.exits.find(
          (entry) => entry.id === exitId
        );

      if (!exit) {
        throw new Error(
          `Exit "${exitId}" no encontrado en "${this.currentLevelId}".`
        );
      }

      const target: LevelExitTarget = {
        sceneKey: exit.scene_key,
        spawnPoint: exit.spawn_point
      };

      this.pendingExitTarget = target;
      this.exitTransitionCommitInProgress = false;

      const transitionMessage = [
        message,
        'Avanzando al siguiente nivel...',
        '',
        'ENTER · continuar ahora'
      ].join('\n');

      this.triggerLevelExitTransition(
        transitionMessage
      );

      this.exitTransitionTimer?.remove(false);

      this.exitTransitionTimer =
        this.time.delayedCall(
          900,
          () => {
            this.confirmPendingExitTransition(
              'automatic'
            );
          }
        );
    } catch (error) {
      console.error(
        '[GameScene] No se pudo preparar la transición de nivel.',
        error
      );

      this.pendingExitTarget = undefined;
      this.exitTransitionCommitInProgress = false;
      this.hasTriggeredTransition = false;

      this.setTransitionView(false, '');
      this.physics.resume();

      this.registry.set(
        'interactionHint',
        'La salida no está configurada correctamente.'
      );
    }
  }

  private createPlatform(group: Phaser.Physics.Arcade.StaticGroup, config: PlatformConfig): void {
    group.create(config.x, config.y, 'ground-placeholder')
      .setDisplaySize(config.width, config.height)
      .refreshBody()
      .setDepth(4);

    const topY = config.y - config.height / 2 + 6;
    this.add.rectangle(config.x, topY, config.width, 8, visualTheme.palette.platformTop).setDepth(5);
    this.add.rectangle(config.x, topY + 6, config.width, 5, visualTheme.palette.worldShadow, 0.82).setDepth(5.1);

    for (let jointX = config.x - config.width / 2 + 64; jointX < config.x + config.width / 2; jointX += 128) {
      this.add.rectangle(jointX, topY + 1, 5, 3, visualTheme.palette.worldBrass, 0.78).setDepth(5.2);
    }

    this.add.rectangle(
      config.x,
      config.y + config.height / 2 - 2,
      config.width,
      3,
      visualTheme.palette.platformEdge,
      0.95
    ).setDepth(5.2);

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

  private drawSubsueloBackground(
    layout: { width: number; height: number; background_zones?: Array<{ id: string; zone: string; x: number; y: number; width: number; height: number }> },
    floorHeight: number,
    profile: EnvironmentProfile | null
  ): void {
    const levelWidth = layout.width;
    const levelHeight = layout.height;
    const usesInstitutionalHall = profile?.level.zones.includes('hall_publico') ?? false;
    const usesVerticalCore = profile?.level.zones.includes('circulacion_vertical') ?? false;
    const usesServiceWing = profile?.level.zones.includes('servicios_comedor_cocina') ?? false;
    const floorTop = levelHeight - floorHeight;
    const backgroundZones = layout.background_zones ?? [];

    const base = this.add.graphics();
    const fallbackVisual = getEnvironmentZoneVisual(usesServiceWing ? 'servicios_comedor_cocina' : usesInstitutionalHall ? 'hall_publico' : 'circulacion_vertical');
    base.fillGradientStyle(fallbackVisual.wallTop, fallbackVisual.wallTop, fallbackVisual.wallBottom, fallbackVisual.wallBottom, 1);
    base.fillRect(0, 0, levelWidth, floorTop);
    backgroundZones.forEach((zone) => {
      const visual = getEnvironmentZoneVisual(zone.zone);
      const zoneTop = Math.max(0, zone.y);
      const zoneBottom = Math.min(floorTop, zone.y + zone.height);
      const zoneHeight = Math.max(140, zoneBottom - zoneTop);
      base.fillStyle(visual.wallTop, 1);
      base.fillRect(zone.x, zoneTop, zone.width, Math.min(160, zoneHeight * 0.32));
      base.fillStyle(visual.wallMid, 1);
      base.fillRect(zone.x, zoneTop + Math.min(120, zoneHeight * 0.2), zone.width, Math.max(90, zoneHeight * 0.34));
      base.fillStyle(visual.wallBottom, 1);
      base.fillRect(zone.x, zoneBottom - Math.max(140, zoneHeight * 0.28), zone.width, Math.max(140, zoneHeight * 0.28));
      base.fillStyle(visual.trim, 0.95);
      base.fillRect(zone.x, floorTop - 40, zone.width, 40);
      base.fillStyle(visual.floor, 0.12);
      base.fillRect(zone.x, 0, zone.width, floorTop);
    });
    base.fillStyle(fallbackVisual.trim, 1);
    base.fillRect(0, floorTop - 40, levelWidth, 40);
    base.fillStyle(fallbackVisual.floor, 1);
    base.fillRect(0, floorTop, levelWidth, floorHeight);
    base.fillStyle(fallbackVisual.floorShadow, 1);
    base.fillRect(0, floorTop + floorHeight - 16, levelWidth, 16);
    base.destroy();

    backgroundZones.forEach((zone, index) => {
      this.renderSubsueloZoneBackdrop(zone.zone, zone.x, zone.width, floorTop, index, profile);
    });

    for (let x = 180; x < levelWidth; x += 420) {
      this.add.image(x, 116, 'prop-tall-window')
        .setDepth(0.78)
        .setScrollFactor(0.28, 1)
        .setAlpha(usesInstitutionalHall ? 0.32 : 0.2)
        .setScale(1.04);
    }

    for (let x = 120; x < levelWidth; x += 360) {
      this.add.image(x, floorTop - 66, 'prop-stone-column')
        .setDepth(1.7)
        .setScrollFactor(0.54, 1)
        .setAlpha(usesVerticalCore ? 0.34 : 0.22)
        .setScale(1.12);
    }

    if (usesServiceWing) {
      for (let x = 240; x < levelWidth; x += 620) {
        this.add.image(x, floorTop - 88, 'prop-service-table')
          .setDepth(2.2)
          .setScrollFactor(0.74, 1)
          .setAlpha(0.34);
      }
    }

    for (let x = 0; x < levelWidth; x += 104) {
      this.add.rectangle(x + 52, floorTop + 18, 92, 24, 0x8f5e55, x % 208 === 0 ? 0.36 : 0.24).setDepth(3.2);
      this.add.rectangle(x + 52, floorTop + floorHeight - 10, 88, 2, 0x1d1715, 0.35).setDepth(3.25);
    }

    if (usesVerticalCore) {
      for (let x = 5100; x < levelWidth; x += 160) {
        this.add.rectangle(x, floorTop - 110, 72, 148, 0x2b211c, 0.24).setDepth(2.1).setScrollFactor(0.72, 1);
      }
    }

    this.createAtmosphericLighting(levelWidth, floorTop, usesServiceWing, usesInstitutionalHall);
  }

  private createAtmosphericLighting(
    levelWidth: number,
    floorTop: number,
    usesServiceWing: boolean,
    usesInstitutionalHall: boolean
  ): void {
    for (let x = 210; x < levelWidth; x += 440) {
      const shadowIndex = Math.floor(x / 440);
      const shadowWidth = 10 + (shadowIndex % 3) * 5;
      const shadowAlpha = usesServiceWing
        ? 0.17
        : usesInstitutionalHall
          ? 0.11
          : 0.14;

      this.add.rectangle(
        x,
        floorTop / 2,
        shadowWidth,
        floorTop,
        visualTheme.palette.worldShadow,
        shadowAlpha
      )
        .setDepth(2.42)
        .setScrollFactor(0.64, 1);
    }

    for (
      let x = 150, lightIndex = 0;
      x < levelWidth;
      x += 520, lightIndex += 1
    ) {
      const useColdLight = usesServiceWing
        && (!usesInstitutionalHall || lightIndex % 3 === 1);

      const lightColor = useColdLight
        ? visualTheme.palette.worldColdLight
        : visualTheme.palette.worldWarmLight;

      const intensity = useColdLight ? 0.064 : 0.076;
      const scrollFactor = useColdLight ? 0.74 : 0.68;

      this.addAtmosphericLightCone(
        x,
        floorTop,
        lightColor,
        intensity,
        scrollFactor
      );
    }
  }

  private addAtmosphericLightCone(
    x: number,
    floorTop: number,
    color: number,
    intensity: number,
    scrollFactor: number
  ): void {
    const topY = 52;
    const bottomY = Math.max(topY + 150, floorTop - 10);
    const height = bottomY - topY;
    const centerY = topY + height / 2;

    const layers = [
      {
        width: 190,
        alpha: intensity * 0.32,
        depth: 2.78
      },
      {
        width: 122,
        alpha: intensity * 0.46,
        depth: 2.8
      },
      {
        width: 58,
        alpha: intensity * 0.6,
        depth: 2.82
      }
    ];

    layers.forEach((layer) => {
      this.add.triangle(
        x,
        centerY,
        layer.width / 2,
        0,
        0,
        height,
        layer.width,
        height,
        color,
        layer.alpha
      )
        .setDepth(layer.depth)
        .setScrollFactor(scrollFactor, 1)
        .setBlendMode(Phaser.BlendModes.ADD);
    });

    this.add.ellipse(
      x,
      floorTop + 6,
      126,
      10,
      color,
      intensity * 0.72
    )
      .setDepth(4.35)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.add.rectangle(
      x,
      topY - 3,
      22,
      4,
      visualTheme.palette.worldBrass,
      0.74
    )
      .setDepth(3.02)
      .setScrollFactor(scrollFactor, 1);

    this.add.rectangle(
      x,
      topY,
      10,
      3,
      color,
      0.86
    )
      .setDepth(3.04)
      .setScrollFactor(scrollFactor, 1)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  private renderSubsueloZoneBackdrop(
    zoneId: string,
    zoneX: number,
    zoneWidth: number,
    floorTop: number,
    zoneIndex: number,
    profile: EnvironmentProfile | null
  ): void {
    const visual = getEnvironmentZoneVisual(zoneId);
    const layerPreset = profile?.zoneLayerPreset?.[zoneId] as string[] | undefined;

    this.add.rectangle(zoneX + zoneWidth / 2, floorTop / 2, zoneWidth, floorTop, visual.wallMid, visual.overlayAlpha)
      .setDepth(0.2)
      .setScrollFactor(0.18, 1);

    if (zoneId === 'servicios_comedor_cocina' || zoneId === 'subsuelo_estacionamiento') {
      for (let x = zoneX + 56; x < zoneX + zoneWidth; x += 168) {
        this.add.rectangle(x, 74, 132, 14, 0x4c4239, 0.52).setDepth(0.85).setScrollFactor(0.32, 1);
        this.add.rectangle(x, 112, 104, 8, 0x655a51, 0.38).setDepth(0.82).setScrollFactor(0.36, 1);
      }
    }

    if (zoneId === 'servicios_comedor_cocina') {
      for (let x = zoneX + 110; x < zoneX + zoneWidth; x += 240) {
        this.add.image(x, floorTop - 126, 'prop-service-table').setDepth(1.65).setScrollFactor(0.68, 1).setAlpha(0.24);
      }
    }

    if (zoneId === 'hall_publico') {
      for (let x = zoneX + 132; x < zoneX + zoneWidth; x += 236) {
        this.add.image(x, 122, 'prop-tall-window').setDepth(1.1).setScrollFactor(0.34, 1).setAlpha(0.68).setScale(1.08);
      }
      for (let x = zoneX + 94; x < zoneX + zoneWidth; x += 220) {
        this.add.image(x, floorTop - 60, 'prop-stone-column').setDepth(1.75).setScrollFactor(0.54, 1).setAlpha(0.44).setScale(1.2);
      }
    }

    if (zoneId === 'circulacion_vertical') {
      for (let x = zoneX + 70; x < zoneX + zoneWidth; x += 154) {
        this.add.rectangle(x, floorTop - 120, 78, 164, 0x31251f, 0.24).setDepth(1.54).setScrollFactor(0.7, 1);
        this.add.rectangle(x, floorTop - 46, 92, 10, 0xb99556, 0.34).setDepth(1.56).setScrollFactor(0.74, 1);
      }
    }

    if (zoneId === 'pisos_oficina') {
      for (let x = zoneX + 100; x < zoneX + zoneWidth; x += 188) {
        for (let y = 80; y < 188; y += 52) {
          this.add.rectangle(x, y, 118, 30, 0xefeadb, 0.56).setDepth(1.2).setScrollFactor(0.5, 1);
          this.add.rectangle(x, y + 14, 118, 2, 0xb39c7f, 0.55).setDepth(1.22).setScrollFactor(0.5, 1);
        }
      }
    }

    const glowY = zoneId === 'subsuelo_estacionamiento' ? 84 : 52;
    for (let x = zoneX + 140; x < zoneX + zoneWidth; x += 260) {
      this.add.ellipse(
        x,
        glowY + (zoneIndex % 2) * 16,
        zoneId === 'subsuelo_estacionamiento' ? 40 : 52,
        zoneId === 'subsuelo_estacionamiento' ? 7 : 9,
        visual.glow,
        0.075
      )
        .setDepth(1.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(0.58, 1);
    }

    if (layerPreset?.includes('bg_parking_concrete_bays')) {
      for (let x = zoneX + 120; x < zoneX + zoneWidth; x += 210) {
        this.add.rectangle(x, floorTop - 108, 140, 148, 0x2f3135, 0.16).setDepth(1.3).setScrollFactor(0.44, 1);
      }
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
      const propY = lowerY - 44;
      addEnvironmentProp(this, { kind: 'atm', x, y: propY, depth: 6, scale: Phaser.Math.Clamp(width / 50, 0.9, 1.4) });
      this.ambientVisualSystem?.registerScreen(x, propY - 20, 26, 18);
      return;
    }

    if (tipo.includes('banco')) {
      addEnvironmentProp(this, { kind: 'bench', x, y: lowerY - 8, depth: 6, scale: Phaser.Math.Clamp(width / 96, 0.8, 1.5) });
      return;
    }

    if (tipo.includes('pantalla')) {
      const propY = lowerY - 36;
      addEnvironmentProp(this, { kind: 'info-screen', x, y: propY, depth: 6, scale: Phaser.Math.Clamp(height / 78, 0.8, 1.3) });
      this.ambientVisualSystem?.registerScreen(x, propY - 17, 28, 20);
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


  private placeDiningRoomProps(environment: Phaser.Physics.Arcade.StaticGroup, levelWidth: number, floorY: number): void {
    const floorTop = floorY - 48;

    for (let x = 210; x < levelWidth - 120; x += 520) {
      addEnvironmentProp(this, { kind: 'dining-table', x, y: floorTop - 18, depth: 6.4, scale: 1.05 });
      this.createPlatform(environment, { x, y: floorTop - 10, width: 116, height: 22 });
    }

    for (let x = 455; x < levelWidth - 160; x += 1040) {
      addEnvironmentProp(this, { kind: 'cafeteria-counter', x, y: floorTop - 16, depth: 6.2, scale: 1.05 });
      this.createPlatform(environment, { x, y: floorTop - 8, width: 138, height: 26 });
      this.ambientVisualSystem?.registerSteamSource(x + 18, floorTop - 42);
    }

    for (let x = 780; x < levelWidth - 220; x += 1560) {
      const propY = floorTop - 56;
      addEnvironmentProp(this, { kind: 'vending-machine', x, y: propY, depth: 5.9, scale: 1 });
      this.ambientVisualSystem?.registerScreen(x - 5, propY - 10, 22, 38);
      this.createPlatform(environment, { x, y: floorTop - 18, width: 42, height: 26 });
    }

    for (let x = 330; x < levelWidth; x += 720) {
      addEnvironmentProp(this, { kind: 'menu-board', x, y: 238, depth: 2.1, scale: 1 });
    }

    for (let x = 620; x < levelWidth - 100; x += 910) {
      addEnvironmentProp(this, { kind: 'mop-bucket', x, y: floorTop - 18, depth: 6.5, scale: 0.9 });
    }
  }

  private placeSpiralHallProps(
    levelWidth: number,
    floorTop: number
  ): void {
    this.addStairVisual(
      460,
      floorTop - 82,
      360,
      210
    );

    addEnvironmentProp(this, { kind: 'stone-column', x: 760, y: floorTop - 62, depth: 5.8, scale: 1.25 });
    addEnvironmentProp(this, { kind: 'bronze-door', x: 900, y: floorTop - 58, depth: 5.9, scale: 1.1 });
    addEnvironmentProp(this, { kind: 'stone-column', x: 1120, y: floorTop - 62, depth: 5.8, scale: 1.25 });
    addEnvironmentProp(this, { kind: 'bench', x: 1380, y: floorTop - 18, depth: 6.2, scale: 1.05 });
    addEnvironmentProp(this, { kind: 'info-screen', x: 1660, y: floorTop - 48, depth: 6.3, scale: 1 });

    const hallProps = [
      { kind: 'stone-column' as const, x: 1700, y: floorTop - 62, depth: 5.8 },
      { kind: 'bank-counter' as const, x: 2800, y: floorTop - 22, depth: 6.1 },
      { kind: 'bench' as const, x: 3900, y: floorTop - 18, depth: 6.2 },
      { kind: 'atm' as const, x: 5000, y: floorTop - 48, depth: 6.3 },
      { kind: 'info-screen' as const, x: 6100, y: floorTop - 48, depth: 6.3 },
      { kind: 'turnstile' as const, x: 7200, y: floorTop - 25, depth: 6.2 },
      { kind: 'stone-column' as const, x: 8300, y: floorTop - 62, depth: 5.8 }
    ];
    hallProps.forEach((prop) => {
      addEnvironmentProp(this, { ...prop, scale: 1.1 });
    });

    const finalStairX = Math.min(levelWidth - 400, 9400);
    this.addStairVisual(
      finalStairX,
      floorTop - 84,
      400,
      220
    );
    addEnvironmentProp(this, { kind: 'stone-column', x: finalStairX - 250, y: floorTop - 62, depth: 5.8, scale: 1.25 });
    addEnvironmentProp(this, { kind: 'bronze-door', x: finalStairX, y: floorTop - 58, depth: 5.9, scale: 1.1 });
    addEnvironmentProp(this, { kind: 'stone-column', x: finalStairX + 250, y: floorTop - 62, depth: 5.8, scale: 1.25 });
  }

  private addTableVisual(x: number, y: number, width: number, height: number): void {
    this.add.image(x, y + 4, 'prop-service-table')
      .setDepth(6)
      .setDisplaySize(width, Math.max(38, height + 18));
  }

  private addStairVisual(x: number, y: number, width: number, height: number): void {
    this.add.tileSprite(x, y + 6, width, height, 'stair-placeholder').setDepth(7).setAlpha(0.98);
    this.add.rectangle(x, y - height / 2 + 8, width, 8, 0xd9ccb6, 0.95).setDepth(7);
    this.add.rectangle(x - width / 2, y, 8, height, 0x766554, 0.9).setDepth(7);
    this.add.rectangle(x + width / 2, y, 8, height, 0x766554, 0.9).setDepth(7);
    this.add.rectangle(x, y + height / 2 - 4, width - 16, 6, 0xb58b43, 0.55).setDepth(7);
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

    if (player.isDead()) {
      this.handlePlayerDefeat(player);
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

  private handlePlayerDefeat(fallenPlayer: Player): void {
    if (this.hasPlayerBeenDefeated || this.players.some((player) => !player.isDead())) {
      return;
    }

    this.hasPlayerBeenDefeated = true;
    const fallenId = `player-${fallenPlayer.getProfile().slot}`;
    this.registry.set('lastCombatDefeat', {
      fallenId,
      levelId: this.currentLevelId,
      defeatedAt: Date.now()
    });
    this.physics.pause();
    this.registry.set('isGamePaused', false);
    this.registry.set('dialogueState', null);
    this.registry.set('audioMuted', getAudioManager(this).isMuted());
    this.registry.set('audioVolume', getAudioManager(this).getVolumePercent());

    this.setTransitionView(
      true,
      'Todo el grupo ha caído en combate.\nReiniciando...',
      'danger'
    );

    this.time.delayedCall(PLAYER_RESPAWN_DELAY_MS, () => {
      if (!this.scene.isActive()) {
        return;
      }

      this.physics.resume();
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

    return [...playerEntries, ...allyEntries].slice(0, 9);
  }

  private getAveragePlayerPosition(): Phaser.Math.Vector2 {
    const livingPlayers = this.players.filter((player) => !player.isDead());
    return getAveragePlayerPosition(livingPlayers.length > 0 ? livingPlayers : this.players);
  }

  private updateSharedCamera(): void {
    const center = this.getAveragePlayerPosition();
    const camera = this.cameras.main;
    const lerpFactor = 0.08;
    const livingPlayers = this.players.filter((player) => !player.isDead());
    const velocityLookAhead = livingPlayers.length > 0
      ? livingPlayers.reduce((acc, player) => {
          const body = player.body as Phaser.Physics.Arcade.Body | null;
          return acc + (body?.velocity.x ?? 0);
        }, 0) / livingPlayers.length
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
    enforceMaxPlayerSeparation(this.players.filter((player) => !player.isDead()));
  }

  private createPauseMenuUI(): void {
    this.pauseMenuVisible = false;
    this.pauseMenuState = 'root';
    this.pauseMenuIndex = 0;
    this.pauseMenuHint = '';
    this.publishPauseMenuView();
  }

  private publishPauseMenuView(): void {
    const view: PauseMenuView = {
      visible: this.pauseMenuVisible,
      state: this.pauseMenuState,
      title: this.pauseMenuState === 'options' ? 'OPCIONES' : 'PAUSA',
      options: this.pauseMenuOptions.map((option) => option.label),
      selectedIndex: this.pauseMenuIndex,
      details: this.pauseMenuState === 'options' ? this.getFormattedControlSummary() : '',
      hint: this.pauseMenuHint
    };
    this.registry.set('pauseMenuView', view);
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
    return this.pauseMenuVisible;
  }

  private pauseGameplay(): void {
    getAudioManager(this).play('uiPause');
    this.physics.pause();
    this.pauseMenuVisible = true;
    this.openPauseRoot();
    this.registry.set('isGamePaused', true);
  }

  private resumeGameplay(): void {
    getAudioManager(this).play('uiConfirm');
    this.pauseMenuVisible = false;
    this.publishPauseMenuView();
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
    this.pauseMenuVisible = false;
    this.publishPauseMenuView();
    this.setTransitionView(false, '');
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
    if (!isNowMuted) audioManager.play('uiConfirm');
    this.showMissionStatus(`Audio ${isNowMuted ? 'silenciado' : 'activado'}.`);
  }

  private adjustMasterVolume(delta: number): void {
    const audioManager = getAudioManager(this);
    const volume = audioManager.adjustVolumePercent(delta);
    this.refreshVolumePauseOptionLabel();
    this.registry.set('audioVolume', volume);
    if (!audioManager.isMuted() && volume > 0) audioManager.play('uiConfirm');
    this.showMissionStatus(`Volumen ${volume}%.`);
  }

  private refreshAudioPauseOptionLabel(): void {
    if (this.audioToggleOptionIndex < 0) return;
    const label = getAudioManager(this).isMuted() ? 'Sonido: Silenciado' : 'Sonido: Activado';
    if (this.pauseMenuOptions[this.audioToggleOptionIndex]) {
      this.pauseMenuOptions[this.audioToggleOptionIndex].label = label;
      this.publishPauseMenuView();
    }
  }

  private refreshVolumePauseOptionLabel(): void {
    if (this.audioVolumeOptionIndex < 0) return;
    const label = `Volumen: ${getAudioManager(this).getVolumePercent()}%`;
    if (this.pauseMenuOptions[this.audioVolumeOptionIndex]) {
      this.pauseMenuOptions[this.audioVolumeOptionIndex].label = label;
      this.publishPauseMenuView();
    }
  }

  private updatePauseMenuSelection(): void {
    this.publishPauseMenuView();
  }

  private openPauseRoot(): void {
    this.pauseMenuState = 'root';
    this.audioToggleOptionIndex = -1;
    this.audioVolumeOptionIndex = -1;
    this.pauseMenuOptions = [
      { label: 'Reanudar', action: () => this.resumeGameplay() },
      { label: 'Opciones', action: () => this.openPauseOptions() },
      { label: 'Salir al menú', action: () => this.returnToMainMenu() }
    ];
    this.pauseMenuIndex = 0;
    this.pauseMenuHint = '↑/↓ seleccionar · ENTER confirmar · ESC reanudar';
    this.publishPauseMenuView();
  }

  private openPauseOptions(): void {
    this.pauseMenuState = 'options';
    this.pauseMenuOptions = [
      { label: 'Sonido: --', action: () => this.toggleAudioMute() },
      { label: 'Volumen: --', action: () => this.adjustMasterVolume(10) },
      { label: 'Volver', action: () => this.openPauseRoot() }
    ];
    this.audioToggleOptionIndex = 0;
    this.audioVolumeOptionIndex = 1;
    this.pauseMenuIndex = 0;
    this.pauseMenuHint = '↑/↓ seleccionar · ←/→ volumen · ENTER confirmar · ESC volver';
    this.refreshAudioPauseOptionLabel();
    this.refreshVolumePauseOptionLabel();
    this.publishPauseMenuView();
  }

  private getFormattedControlSummary(): string {
    const movement = controlManager.getMovementDisplayLabel().toUpperCase();
    const jump = controlManager.getDisplayLabel('jump').toUpperCase();
    const shoot = controlManager.getDisplayLabel('shoot').toUpperCase();
    const reload = controlManager.getDisplayLabel('reload').toUpperCase();
    const switchWeapon = controlManager.getDisplayLabel('switch_weapon').toUpperCase();
    const interact = controlManager.getDisplayLabel('interact').toUpperCase();
    return [
      `${movement} MOVER · ${jump} SALTAR · ${shoot} DISPARAR`,
      `${reload} RECARGAR · ${switchWeapon} CAMBIAR ARMA`,
      `${interact} INTERACTUAR · SPACE DIÁLOGO · X SALTAR`
    ].join('\n');
  }

  private refreshPauseMenuTexts(): void {
    this.publishPauseMenuView();
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
    const checkpoint = this.checkpointSystem?.getCheckpoint()
      ?? this.respawnPoint
      ?? { x: 140, y: this.scale.height - 140 };
    const checkpointLabel = `${Math.round(checkpoint.x)},${Math.round(checkpoint.y)}`;
    this.visitedCheckpoints.add(checkpointLabel);
    const campaignSnapshot = this.buildCampaignSnapshot(checkpointLabel);

    return {
      user_id: this.getPlayerId(),
      current_level: this.scene.key,
      life: this.players.filter((player) => !player.isDead()).length,
      allies_rescued: campaignSnapshot.party.rescued.length,
      checkpoint: checkpointLabel,
      save_version: 2,
      campaign_snapshot: campaignSnapshot
    };
  }

  private getInitialSetup(): InitialRunSetup | null {
    return (this.registry.get('initialRunSetup') as InitialRunSetup | undefined) ?? loadInitialRunSetup();
  }

  private buildCampaignSnapshot(checkpoint: string): CampaignSnapshot {
    const setup = this.getInitialSetup();
    const campaign = this.campaignState?.getSnapshot();
    const partyMembers = this.partyState?.getSnapshot() ?? [];
    const rescuedCharacterIds = new Set(campaign?.rescuedCharacters ?? []);

    const party = {
      active: partyMembers.filter((member) => member.status === 'active').map((member) => member.name),
      dead: partyMembers.filter((member) => member.status === 'dead').map((member) => member.name),
      rescued: partyMembers
        .filter((member) => member.status === 'rescued' || rescuedCharacterIds.has(member.id))
        .map((member) => member.name),
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
        flow_node_id: new SceneFlowManager(this).migrateProgressNodeId(this.registry.get('flowNodeId') as string | undefined),
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
    const flowDefinition = new SceneFlowManager(this).ensureDefinitionLoadedFromCache();
    const manager = new SceneFlowManager(this);
    const canonicalSavedId = manager.migrateProgressNodeId(snapshot.progress.flow_node_id);
    if (canonicalSavedId) snapshot.progress.flow_node_id = canonicalSavedId;
    const savedFlowNodeIndex = flowDefinition?.nodes.findIndex((node) => node.id === canonicalSavedId) ?? -1;
    const savedFlowNode = flowDefinition?.nodes[savedFlowNodeIndex];
    if (savedFlowNode?.sceneKey === 'LevelScene' && savedFlowNode.levelConfigPath) {
      this.registry.set('activeCampaignNode', savedFlowNode);
      this.registry.set('flowNodeId', savedFlowNode.id);
      this.registry.set('campaignFlowCursor', savedFlowNodeIndex);
    }

    this.visitedCheckpoints.clear();
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

      if (protagonist && validDifficulty) {
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
    const saveOwner = this.levelRestartManager;

    const payload = this.buildProgressPayload();
    this.saveProgressLocally(payload);

    try {
      await progressApi.saveProgress(payload);
      if (this.hasPlayerBeenDefeated || this.hasTriggeredTransition || this.levelRestartManager !== saveOwner) {
        return;
      }

      this.showApiStatus('Progreso guardado en servidor.', false);
    } catch (error) {
      if (this.hasPlayerBeenDefeated || this.hasTriggeredTransition || this.levelRestartManager !== saveOwner) {
        return;
      }

      const message = error instanceof Error ? error.message : 'No se pudo guardar progreso.';
      this.showApiStatus(`Guardado local activo. ${message}`, true);
    }
  }

  private async loadProgressFromApi(): Promise<void> {
    const loadOwner = this.levelRestartManager;

    try {
      const progress = await progressApi.loadProgress(this.getPlayerId());
      const loadedSceneKey = normalizeProgressSceneKey(progress.current_level);
      if (!loadedSceneKey) {
        throw new Error(`Escena guardada incompatible: ${progress.current_level}`);
      }

      if (this.hasPlayerBeenDefeated || this.hasTriggeredTransition || this.levelRestartManager !== loadOwner) {
        return;
      }

      const loadedCheckpoint = parseCheckpoint(progress.checkpoint);
      this.applyLoadedSnapshot(progress.campaign_snapshot);

      if (loadedCheckpoint) {
        this.registry.set('checkpoint', loadedCheckpoint);
      }

      this.showApiStatus('Partida cargada desde servidor.', false);

      if (loadedSceneKey !== this.scene.key) {
        this.registry.remove('campaignState');
        this.registry.remove('partyState');
        this.scene.start(loadedSceneKey, { respawnPoint: loadedCheckpoint, skipLoad: true });
        return;
      }

      this.scene.restart({ respawnPoint: loadedCheckpoint, skipLoad: true });
    } catch (error) {
      if (this.hasPlayerBeenDefeated || this.hasTriggeredTransition || this.levelRestartManager !== loadOwner) {
        return;
      }

      const localProgress = this.loadLocalProgress();
      if (localProgress) {
        const loadedSceneKey = normalizeProgressSceneKey(localProgress.current_level);
        if (!loadedSceneKey) {
          this.showApiStatus('Partida local incompatible: escena desconocida.', true);
          return;
        }

        const loadedCheckpoint = parseCheckpoint(localProgress.checkpoint);
        this.applyLoadedSnapshot(localProgress.campaign_snapshot);
        if (loadedCheckpoint) {
          this.registry.set('checkpoint', loadedCheckpoint);
        }

        this.showApiStatus('Servidor no disponible. Partida local cargada.', true);
        if (loadedSceneKey !== this.scene.key) {
          this.registry.remove('campaignState');
          this.registry.remove('partyState');
          this.scene.start(loadedSceneKey, {
            respawnPoint: loadedCheckpoint,
            skipLoad: true
          });
          return;
        }
        this.scene.restart({ respawnPoint: loadedCheckpoint, skipLoad: true });
        return;
      }

      const message = error instanceof Error ? error.message : 'No se pudo cargar progreso.';
      this.showApiStatus(`No se pudo cargar: ${message}`, true);
    }
  }

  private showApiStatus(message: string, isError: boolean): void {
    const statusVersion = ++this.apiStatusVersion;

    this.apiStatusText
      ?.setText(message)
      .setStyle({
        color: isError ? '#fecaca' : '#bfdbfe',
        backgroundColor: isError ? '#450a0a' : '#0b1120'
      })
      .setVisible(true);

    this.time.delayedCall(API_MESSAGE_DURATION_MS, () => {
      if (statusVersion !== this.apiStatusVersion) {
        return;
      }

      this.apiStatusText?.setVisible(false);
    });
  }
}
