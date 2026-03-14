import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { TimedCheckpointSystem, TimedCheckpointSnapshot } from './TimedCheckpointSystem';

export interface Level8DescentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Level8DescentSpawnPoint {
  x: number;
  y: number;
}

export interface Level8DescentWaveConfig {
  enemyType: string;
  count: number;
  spawnPoints: Level8DescentSpawnPoint[];
  metadata?: Record<string, unknown>;
}

export interface Level8DescentEncounterConfig {
  id: string;
  label: string;
  trigger: Level8DescentBounds;
  required: boolean;
  spawnWaves: Level8DescentWaveConfig[];
  hintOnActivate?: string;
  hintOnClear?: string;
}

export interface Level8DescentSectionConfig {
  id: string;
  label: string;
  floor: number;
  trigger: Level8DescentBounds;
  objectiveOnEnter?: string;
  optionalSkirmishHint?: string;
  encounters: Level8DescentEncounterConfig[];
  requireRequiredEncountersToComplete?: boolean;
  completionZone?: Level8DescentBounds;
}

export interface Level8DescentRouteConfig {
  levelId: string;
  finalSectionId: string;
  registryRouteKey?: string;
  sections: Level8DescentSectionConfig[];
}

export interface Level8DescentSpawnRequest {
  sectionId: string;
  encounterId: string;
  waveIndex: number;
  enemyIndex: number;
  enemyType: string;
  spawnPoint: Level8DescentSpawnPoint;
  metadata?: Record<string, unknown>;
}

export interface Level8TimedDescentCallbacks<TEnemyHandle> {
  spawnEnemy: (request: Level8DescentSpawnRequest) => TEnemyHandle | null;
  isEnemyAlive: (enemy: TEnemyHandle) => boolean;
  onSectionEntered?: (section: Level8DescentSectionConfig) => void;
  onEncounterActivated?: (payload: { section: Level8DescentSectionConfig; encounter: Level8DescentEncounterConfig }) => void;
  onEncounterCleared?: (payload: { section: Level8DescentSectionConfig; encounter: Level8DescentEncounterConfig }) => void;
  onRouteCompleted?: (section: Level8DescentSectionConfig) => void;
  onHintChanged?: (hint: string) => void;
}

type ZoneState = 'idle' | 'active' | 'completed';

interface RuntimeEncounter<TEnemyHandle> {
  config: Level8DescentEncounterConfig;
  trigger: Phaser.GameObjects.Zone;
  state: ZoneState;
  enemies: TEnemyHandle[];
}

interface RuntimeSection<TEnemyHandle> {
  config: Level8DescentSectionConfig;
  trigger: Phaser.GameObjects.Zone;
  completionZone?: Phaser.GameObjects.Zone;
  entered: boolean;
  completed: boolean;
  encounters: RuntimeEncounter<TEnemyHandle>[];
}

function disableStaticBody(zone: Phaser.GameObjects.Zone): void {
  const body = zone.body as Phaser.Physics.Arcade.StaticBody;
  body.enable = false;
}

export class Level8TimedDescentSystem<TEnemyHandle> {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Types.Physics.Arcade.GameObjectWithBody[];
  private readonly timedCheckpointSystem: TimedCheckpointSystem;
  private readonly callbacks: Level8TimedDescentCallbacks<TEnemyHandle>;
  private readonly config: Level8DescentRouteConfig;
  private readonly sections: RuntimeSection<TEnemyHandle>[];
  private readonly sectionById: Map<string, RuntimeSection<TEnemyHandle>>;
  private readonly registryRouteKey: string;

  constructor(
    scene: Phaser.Scene,
    players: Player[],
    timedCheckpointSystem: TimedCheckpointSystem,
    config: Level8DescentRouteConfig,
    callbacks: Level8TimedDescentCallbacks<TEnemyHandle>
  ) {
    this.scene = scene;
    this.players = players as Phaser.Types.Physics.Arcade.GameObjectWithBody[];
    this.timedCheckpointSystem = timedCheckpointSystem;
    this.callbacks = callbacks;
    this.config = config;
    this.registryRouteKey = config.registryRouteKey ?? 'level8TimedDescent';

    this.validateConfig(config);

    this.sections = config.sections.map((section) => this.createRuntimeSection(section));
    this.sectionById = new Map(this.sections.map((section) => [section.config.id, section]));

    this.bindOverlaps();
    this.publishState();
  }

  update(): void {
    this.sections.forEach((section) => {
      section.encounters.forEach((encounter) => {
        if (encounter.state !== 'active') {
          return;
        }

        const hasAliveEnemies = encounter.enemies.some((enemy) => this.callbacks.isEnemyAlive(enemy));
        if (!hasAliveEnemies) {
          encounter.state = 'completed';
          disableStaticBody(encounter.trigger);
          encounter.trigger.setActive(false).setVisible(false);

          if (encounter.config.hintOnClear) {
            this.callbacks.onHintChanged?.(encounter.config.hintOnClear);
          }

          this.callbacks.onEncounterCleared?.({ section: section.config, encounter: encounter.config });
          this.publishState();
          this.tryCompleteSection(section);
        }
      });
    });
  }

  destroy(): void {
    this.sections.forEach((section) => {
      section.trigger.destroy();
      section.completionZone?.destroy();
      section.encounters.forEach((encounter) => encounter.trigger.destroy());
    });
  }

  private createRuntimeSection(config: Level8DescentSectionConfig): RuntimeSection<TEnemyHandle> {
    const sectionTrigger = this.scene.add.zone(config.trigger.x, config.trigger.y, config.trigger.width, config.trigger.height);
    this.scene.physics.add.existing(sectionTrigger, true);

    const completionZone = config.completionZone
      ? this.scene.add.zone(
          config.completionZone.x,
          config.completionZone.y,
          config.completionZone.width,
          config.completionZone.height
        )
      : undefined;

    if (completionZone) {
      this.scene.physics.add.existing(completionZone, true);
    }

    const encounters = config.encounters.map<RuntimeEncounter<TEnemyHandle>>((encounter) => {
      const encounterTrigger = this.scene.add.zone(
        encounter.trigger.x,
        encounter.trigger.y,
        encounter.trigger.width,
        encounter.trigger.height
      );

      this.scene.physics.add.existing(encounterTrigger, true);

      return {
        config: encounter,
        trigger: encounterTrigger,
        state: 'idle',
        enemies: []
      };
    });

    return {
      config,
      trigger: sectionTrigger,
      completionZone,
      entered: false,
      completed: false,
      encounters
    };
  }

  private bindOverlaps(): void {
    this.sections.forEach((section) => {
      this.players.forEach((player) => {
        this.scene.physics.add.overlap(player, section.trigger, () => {
          this.enterSection(section);
        });

        if (section.completionZone) {
          this.scene.physics.add.overlap(player, section.completionZone, () => {
            this.tryCompleteSection(section);
          });
        }

        section.encounters.forEach((encounter) => {
          this.scene.physics.add.overlap(player, encounter.trigger, () => {
            this.activateEncounter(section, encounter);
          });
        });
      });
    });
  }

  private enterSection(section: RuntimeSection<TEnemyHandle>): void {
    if (!this.isTimerRunning() || section.entered) {
      return;
    }

    section.entered = true;
    this.callbacks.onSectionEntered?.(section.config);

    if (section.config.objectiveOnEnter) {
      this.scene.registry.set('currentObjective', section.config.objectiveOnEnter);
    }

    if (section.config.optionalSkirmishHint) {
      this.callbacks.onHintChanged?.(section.config.optionalSkirmishHint);
    }

    this.publishState();
  }

  private activateEncounter(section: RuntimeSection<TEnemyHandle>, encounter: RuntimeEncounter<TEnemyHandle>): void {
    if (!this.isTimerRunning() || !section.entered || encounter.state !== 'idle') {
      return;
    }

    encounter.state = 'active';
    encounter.enemies = this.spawnEncounterEnemies(section.config, encounter.config);

    if (encounter.config.hintOnActivate) {
      this.callbacks.onHintChanged?.(encounter.config.hintOnActivate);
    }

    this.callbacks.onEncounterActivated?.({ section: section.config, encounter: encounter.config });
    this.publishState();
  }

  private spawnEncounterEnemies(
    section: Level8DescentSectionConfig,
    encounter: Level8DescentEncounterConfig
  ): TEnemyHandle[] {
    const spawned: TEnemyHandle[] = [];

    encounter.spawnWaves.forEach((wave, waveIndex) => {
      for (let enemyIndex = 0; enemyIndex < wave.count; enemyIndex += 1) {
        const spawnPoint = wave.spawnPoints[enemyIndex % wave.spawnPoints.length];

        const enemy = this.callbacks.spawnEnemy({
          sectionId: section.id,
          encounterId: encounter.id,
          waveIndex,
          enemyIndex,
          enemyType: wave.enemyType,
          spawnPoint,
          metadata: wave.metadata
        });

        if (enemy) {
          spawned.push(enemy);
        }
      }
    });

    return spawned;
  }

  private tryCompleteSection(section: RuntimeSection<TEnemyHandle>): void {
    if (!this.isTimerRunning() || section.completed || !section.entered) {
      return;
    }

    if (section.completionZone) {
      const anyPlayerInsideCompletion = this.players.some((player) => this.scene.physics.overlap(player, section.completionZone));
      if (!anyPlayerInsideCompletion) {
        return;
      }
    }

    const requireRequiredEncounters = section.config.requireRequiredEncountersToComplete ?? false;
    if (requireRequiredEncounters) {
      const hasPendingRequiredEncounter = section.encounters.some(
        (encounter) => encounter.config.required && encounter.state !== 'completed'
      );

      if (hasPendingRequiredEncounter) {
        return;
      }
    }

    section.completed = true;
    disableStaticBody(section.trigger);
    section.trigger.setActive(false).setVisible(false);
    section.completionZone?.setActive(false).setVisible(false);
    if (section.completionZone) {
      disableStaticBody(section.completionZone);
    }

    this.publishState();

    if (section.config.id === this.config.finalSectionId) {
      this.timedCheckpointSystem.completeRace();
      this.callbacks.onRouteCompleted?.(section.config);
      this.callbacks.onHintChanged?.('Descenso completado: objetivo final asegurado en piso 1.');
    }
  }

  private isTimerRunning(): boolean {
    const snapshot = this.timedCheckpointSystem.getSnapshot();
    return snapshot.state === 'running';
  }

  private publishState(): void {
    const timerSnapshot: TimedCheckpointSnapshot = this.timedCheckpointSystem.getSnapshot();

    this.scene.registry.set(this.registryRouteKey, {
      levelId: this.config.levelId,
      timerState: timerSnapshot.state,
      remainingMs: timerSnapshot.remainingMs,
      sections: this.sections.map((section) => ({
        id: section.config.id,
        entered: section.entered,
        completed: section.completed,
        requiredEncountersTotal: section.encounters.filter((encounter) => encounter.config.required).length,
        requiredEncountersCompleted: section.encounters.filter(
          (encounter) => encounter.config.required && encounter.state === 'completed'
        ).length,
        encounters: section.encounters.map((encounter) => ({
          id: encounter.config.id,
          required: encounter.config.required,
          state: encounter.state
        }))
      }))
    });
  }

  private validateConfig(config: Level8DescentRouteConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level8TimedDescentSystem: levelId es obligatorio.');
    }

    if (config.sections.length === 0) {
      throw new Error('Level8TimedDescentSystem: se requiere al menos una sección en route.sections.');
    }

    const sectionIds = new Set<string>();
    config.sections.forEach((section) => {
      if (sectionIds.has(section.id)) {
        throw new Error(`Level8TimedDescentSystem: sección duplicada "${section.id}".`);
      }

      sectionIds.add(section.id);

      const encounterIds = new Set<string>();
      section.encounters.forEach((encounter) => {
        if (encounterIds.has(encounter.id)) {
          throw new Error(`Level8TimedDescentSystem: encounter duplicado "${encounter.id}" en sección "${section.id}".`);
        }

        encounterIds.add(encounter.id);

        encounter.spawnWaves.forEach((wave, waveIndex) => {
          if (wave.count <= 0) {
            throw new Error(
              `Level8TimedDescentSystem: encounter "${encounter.id}" en sección "${section.id}" tiene wave #${waveIndex} con count <= 0.`
            );
          }

          if (wave.spawnPoints.length === 0) {
            throw new Error(
              `Level8TimedDescentSystem: encounter "${encounter.id}" en sección "${section.id}" tiene wave #${waveIndex} sin spawnPoints.`
            );
          }
        });
      });
    });

    if (!sectionIds.has(config.finalSectionId)) {
      throw new Error(`Level8TimedDescentSystem: finalSectionId "${config.finalSectionId}" no existe en sections.`);
    }
  }
}
