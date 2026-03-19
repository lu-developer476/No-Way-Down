import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { StaircaseSystem, StairTransitionTarget } from '../systems/StaircaseSystem';
import { getActivePlayerConfigs } from '../config/localMultiplayer';
import { CampaignSnapshot, PlayerProgressPayload, progressApi } from '../services/progressApi';
import {
  Checkpoint,
  enforceMaxPlayerSeparation,
  getAveragePlayerPosition,
  getScenePlayerId,
  InitialRunSetup,
  loadInitialRunSetup,
  parseCheckpoint
} from './sceneShared';
import { visualTheme } from './visualTheme';
import level3HallLayout from '../../public/assets/levels/level3_hall_planta_baja.json';
import level3PickupConfig from '../../public/assets/levels/level3_pickups.json';
import { addEnvironmentProp } from './environmentLayout';
import { registerEnvironmentProfile } from '../config/environmentProfiles';
import { PickupSystem } from '../systems/PickupSystem';
import { levelManager } from '../systems/level/levelCatalog';
import { ObjectiveSystem } from '../systems/core/ObjectiveSystem';
import { InteractableSystem } from '../systems/core/InteractableSystem';
import { controlManager } from '../input/ControlManager';

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
  private pickupSystem?: PickupSystem;
  private objectiveSystem?: ObjectiveSystem;
  private interactableSystem?: InteractableSystem;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private interactionHintOwnedByInteractables = false;
  private transitionOverlay?: Phaser.GameObjects.Rectangle;
  private transitionText?: Phaser.GameObjects.Text;
  private apiStatusText?: Phaser.GameObjects.Text;
  private hasTriggeredTransition = false;
  private visitedCheckpoints = new Set<string>();

  constructor() {
    super('UpperFloorScene');
  }

  create(data: UpperFloorSceneData = {}): void {
    const levelConfig = levelManager.loadLevel('level_3_upper_floor');
    const levelWidth = levelConfig.layout.width;
    const levelHeight = levelConfig.layout.height;
    const floorHeight = levelConfig.layout.floor_height ?? 84;

    this.physics.world.setBounds(0, 0, levelWidth, levelHeight);
    registerEnvironmentProfile(this, String(levelConfig.layout.environment_profile ?? 'level3_hall_planta_baja'));
    this.cameras.main
      .setBounds(0, 0, levelWidth, levelHeight)
      .setZoom(ARCADE_CAMERA_ZOOM)
      .setRoundPixels(true);

    this.drawUpperFloorBackground(levelWidth, levelHeight, floorHeight);

    const environment = this.physics.add.staticGroup();
    const floorY = this.resolveFloorY(levelHeight);
    environment.create(levelWidth / 2, floorY + floorHeight / 2, 'ground-placeholder')
      .setDisplaySize(levelWidth, floorHeight)
      .refreshBody()
      .setDepth(4);

    this.add.rectangle(levelWidth / 2, floorY + 8, levelWidth, 8, visualTheme.palette.platformTop).setDepth(5);
    this.placeHallLayoutProps(environment, floorY);

    this.projectileSystem = new ProjectileSystem(this);

    const setupFromStorage = loadInitialRunSetup();
    if (setupFromStorage && !this.registry.has('initialRunSetup')) {
      this.registry.set('initialRunSetup', setupFromStorage);
    }

    const defaultEntry = levelConfig.layout.default_spawn ?? this.resolveDefaultSpawnPoint(levelHeight);
    const spawnPoint = data.respawnPoint ?? defaultEntry;
    const setup = (this.registry.get('initialRunSetup') ?? loadInitialRunSetup()) ?? null;
    const activePlayerConfigs = getActivePlayerConfigs(setup);
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

    this.projectileSystem.createSolidCollider(environment);

    this.pickupSystem = PickupSystem.fromJSON(this, level3PickupConfig);
    this.objectiveSystem = levelManager.instantiateObjectives('level_3_upper_floor');
    this.interactableSystem = levelManager.instantiateInteractables('level_3_upper_floor');
    this.interactKey = this.input.keyboard?.addKey(controlManager.getKeyCode('interact'));
    this.staircaseSystem = new StaircaseSystem(this, this.players);
    this.staircaseSystem.registerStair({
      id: 'upper-to-dining',
      x: spawnPoint.x - 40,
      y: spawnPoint.y - 12,
      width: 180,
      height: 120,
      prompt: 'Mantén E para bajar al comedor',
      activeLabel: 'ESCALERA\nBAJADA',
      target: {
        sceneKey: 'GameScene',
        spawnPoint: { x: Math.max(180, levelWidth - 260), y: floorY - 36 }
      },
      startsUnlocked: true
    });

    this.addStairVisual(spawnPoint.x - 40, spawnPoint.y - 12, 180, 120);
    this.createTransitionUI();
    this.registry.set('currentObjective', this.objectiveSystem?.getActiveObjective()?.label ?? 'Cruza el hall de Planta Baja y reconoce su distribución antes de volver.');
    this.registry.set('interactionHint', '');
    this.registerApiControls();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pickupSystem?.destroy();
      this.pickupSystem = undefined;
    });

    if (!data.skipLoad) {
      void this.loadProgressFromApi();
    }
  }

  update(): void {
    this.players.forEach((player) => player.update());
    this.enforcePlayerSeparation();
    this.updateSharedCamera();
    this.projectileSystem?.update();
    this.pickupSystem?.update(this.players, this.players);

    if (this.hasTriggeredTransition) {
      return;
    }

    this.staircaseSystem?.update((target) => {
      this.transitionToTarget(target);
    });

    this.updateInteractables();
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
    if (!interaction.success || !interaction.effect || !interaction.definition) {
      return;
    }

    this.registry.set('interactionHint', interaction.effect.message ?? `Interacción: ${interaction.definition.id}`);
    const objectiveUpdate = this.objectiveSystem?.process({
      type: interaction.effect.objectiveEventType ?? 'interactable_used',
      targetId: interaction.effect.targetId ?? interaction.definition.id
    });

    if (objectiveUpdate?.status === 'completed') {
      this.registry.set('currentObjective', this.objectiveSystem?.getActiveObjective()?.label ?? 'Objetivo completado');
    }
  }

  private drawUpperFloorBackground(levelWidth: number, levelHeight: number, floorHeight: number): void {
    const floorY = this.resolveFloorY(levelHeight);

    const backdrop = this.add.graphics();
    backdrop.fillGradientStyle(0xd8c8ab, 0xd8c8ab, 0xb89d78, 0xb89d78, 1);
    backdrop.fillRect(0, 0, levelWidth, levelHeight);
    backdrop.fillStyle(0xe5d8bf, 1);
    backdrop.fillRect(0, 0, levelWidth, 170);
    backdrop.fillStyle(0xcab28f, 1);
    backdrop.fillRect(0, 170, levelWidth, 190);
    backdrop.fillStyle(0x754342, 1);
    backdrop.fillRect(0, floorY - 26, levelWidth, 26);
    backdrop.fillStyle(0x593f34, 1);
    backdrop.fillRect(0, floorY, levelWidth, floorHeight);
    backdrop.destroy();

    for (let x = 150; x < levelWidth; x += 230) {
      this.add.image(x, 166, 'prop-tall-window')
        .setDepth(1)
        .setScrollFactor(0.42, 1)
        .setDisplaySize(94, 180)
        .setAlpha(0.95);
    }

    for (let x = 112; x < levelWidth; x += 228) {
      this.add.image(x, 226, 'prop-stone-column')
        .setDepth(1.2)
        .setScrollFactor(0.5, 1)
        .setScale(1.3)
        .setAlpha(0.45);
    }

    for (let x = 120; x < levelWidth; x += 160) {
      for (let y = 42; y < 150; y += 54) {
        this.add.rectangle(x, y, 112, 36, 0xf5efe2, 0.85).setDepth(1.4).setScrollFactor(0.58, 1);
        this.add.rectangle(x, y + 18, 112, 2, 0xb9a07e, 0.75).setDepth(1.45).setScrollFactor(0.58, 1);
      }
    }

    for (let x = 120; x < levelWidth; x += 250) {
      this.add.circle(x, 92, 22, 0xf3d28f, 0.12).setDepth(1.5).setBlendMode(Phaser.BlendModes.ADD);
    }

    for (let x = 200; x < levelWidth; x += 440) {
      this.add.image(x, floorY - 120, 'prop-bank-counter')
        .setDepth(2.2)
        .setScrollFactor(0.72, 1)
        .setAlpha(0.22)
        .setScale(1.15, 1.25);
    }

    for (let x = 0; x < levelWidth; x += 116) {
      this.add.rectangle(x + 58, floorY + 18, 104, 24, 0x8f5e55, x % 232 === 0 ? 0.4 : 0.28).setDepth(3.4);
      this.add.rectangle(x + 58, floorY + 40, 104, 2, 0x251b18, 0.22).setDepth(3.45);
    }
  }

  private resolveLevelBounds(): { width: number; height: number } {
    const sections = level3HallLayout.sections ?? [];
    const maxX = sections.reduce((acc, section) => Math.max(acc, section.bounds.x + section.bounds.width), this.scale.width);
    const maxY = sections.reduce((acc, section) => Math.max(acc, section.bounds.y + section.bounds.height), this.scale.height);
    return { width: maxX, height: maxY };
  }

  private resolveFloorY(levelHeight: number): number {
    return Math.min(levelHeight - 120, 1560);
  }

  private resolveDefaultSpawnPoint(levelHeight: number): Checkpoint {
    const fallbackY = this.resolveFloorY(levelHeight) - 36;
    const section = level3HallLayout.sections?.find((entry) => entry.id === 'S1');
    const entry = section?.navigation?.entry;
    return {
      x: entry?.x ?? 220,
      y: entry?.y ?? fallbackY
    };
  }

  private placeHallLayoutProps(environment: Phaser.Physics.Arcade.StaticGroup, floorY: number): void {
    const hallSection = level3HallLayout.sections?.find((entry) => entry.id === 'S2');
    const columns = hallSection?.layout_points?.columns ?? [];
    const counters = hallSection?.layout_points?.service_counters ?? [];

    columns.forEach((column) => {
      addEnvironmentProp(this, {
        kind: 'stone-column',
        x: column.x,
        y: column.y - 56,
        depth: 6,
        scale: 1.28
      });

      environment.create(column.x, floorY - 22, 'ground-placeholder')
        .setDisplaySize(52, 44)
        .refreshBody()
        .setAlpha(0)
        .setDepth(4);
    });

    counters.forEach((counter) => {
      addEnvironmentProp(this, {
        kind: 'bank-counter',
        x: counter.x,
        y: counter.y - 4,
        depth: 6,
        scale: 1.12
      });

      addEnvironmentProp(this, {
        kind: 'tall-window',
        x: counter.x,
        y: counter.side === 'north' ? counter.y - 170 : counter.y - 138,
        depth: 4,
        alpha: 0.95,
        scale: 1.08
      });

      environment.create(counter.x, counter.y + 10, 'ground-placeholder')
        .setDisplaySize(148, 40)
        .refreshBody()
        .setAlpha(0)
        .setDepth(4);
    });

    const lanePoints = hallSection?.layout_points?.central_lane ?? [];
    lanePoints.forEach((lanePoint, index) => {
      addEnvironmentProp(this, {
        kind: index % 2 === 0 ? 'turnstile' : 'info-screen',
        x: lanePoint.x,
        y: lanePoint.y - 34,
        depth: 5,
        alpha: 0.96,
        scale: index % 2 === 0 ? 1.05 : 0.98
      });
    });
  }

  private addStairVisual(x: number, y: number, width: number, height: number): void {
    this.add.tileSprite(x, y + 4, width, height, 'stair-placeholder').setDepth(7).setAlpha(0.98);
    this.add.rectangle(x, y - height / 2 + 8, width, 8, 0xd9ccb6, 0.95).setDepth(7);
    this.add.rectangle(x, y + height / 2 - 6, width - 10, 6, 0xb58b43, 0.55).setDepth(7);
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
      if (target.sceneKey === 'GameScene') {
        levelManager.transitionToLevel(this, 'level_3_upper_floor', 'return_dining');
        return;
      }

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
    const loadedSnapshot = this.registry.get('loadedCampaignSnapshot') as CampaignSnapshot | undefined;

    if (loadedSnapshot?.checkpoints?.visited) {
      loadedSnapshot.checkpoints.visited.forEach((value) => this.visitedCheckpoints.add(value));
    }

    return {
      setup: {
        protagonist: setup?.protagonist ?? loadedSnapshot?.setup.protagonist ?? 'unknown',
        difficulty: setup?.difficulty ?? loadedSnapshot?.setup.difficulty ?? 'unknown',
        initial_party: {
          required: setup?.party.required ?? loadedSnapshot?.setup.initial_party.required ?? [],
          optional: setup?.party.optional ?? loadedSnapshot?.setup.initial_party.optional ?? []
        }
      },
      party: loadedSnapshot?.party ?? {
        active: [],
        dead: [],
        rescued: [],
        infected: []
      },
      progress: {
        level: this.scene.key,
        checkpoint,
        segment: 'upper_floor_exploration',
        life: this.players.filter((player) => !player.isDead()).length,
        allies_rescued: loadedSnapshot?.party?.rescued.length ?? 0
      },
      narrative: loadedSnapshot?.narrative ?? {
        flags: {},
        irreversible_events: [],
        seen_cinematics: []
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
    snapshot.checkpoints?.visited?.forEach((value) => this.visitedCheckpoints.add(value));
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
      this.applyLoadedSnapshot(progress.campaign_snapshot);
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
