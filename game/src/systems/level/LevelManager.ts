import Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { SpawnManager, SpawnManagerConfig } from '../SpawnManager';
import { ZombieSystem } from '../ZombieSystem';
import { ObjectiveDefinition, ObjectiveSystem } from '../core/ObjectiveSystem';
import { InteractableDefinition, InteractableSystem } from '../core/InteractableSystem';
import { CinematicConfig } from '../core/CinematicSystem';
import { TriggerDefinition, TriggerSystem, TriggerSystemCallbacks } from '../TriggerSystem';
import { LevelRestartManager, LevelRestartManagerDependencies } from '../core/LevelRestartManager';
import { PickupDefinition } from '../PickupSystem';

export interface LevelExitDefinition {
  id: string;
  target_level_id: string;
  scene_key: string;
  spawn_point: { x: number; y: number };
  label?: string;
}

export interface LevelLayoutDefinition {
  width: number;
  height: number;
  floor_y?: number;
  floor_height?: number;
  environment_profile?: string;
  default_spawn?: { x: number; y: number };
  [key: string]: unknown;
}

export interface LevelDefinition {
  level_id: string;
  layout: LevelLayoutDefinition;
  spawn_zones: SpawnManagerConfig;
  objectives: ObjectiveDefinition[];
  interactables: InteractableDefinition[];
  triggers: TriggerDefinition[];
  cinematics: CinematicConfig[];
  exits: LevelExitDefinition[];
  pickups?: PickupDefinition[];
}

export class LevelManager {
  private readonly definitions = new Map<string, LevelDefinition>();

  constructor(levels: LevelDefinition[]) {
    levels.forEach((level) => {
      this.definitions.set(level.level_id, level);
    });
  }

  loadLevel(levelId: string): LevelDefinition {
    const level = this.definitions.get(levelId);
    if (!level) {
      throw new Error(`LevelManager: unknown level "${levelId}".`);
    }

    return level;
  }

  instantiateSpawns(
    levelId: string,
    scene: Phaser.Scene,
    zombieSystem: ZombieSystem,
    players: Player[],
    options: { spawnPressureMultiplier?: number; getEnemyLimit?: () => number } = {}
  ): SpawnManager {
    const definition = this.loadLevel(levelId);
    const multiplier = options.spawnPressureMultiplier ?? 1;

    const config: SpawnManagerConfig = {
      ...definition.spawn_zones,
      points: definition.spawn_zones.points.map((point) => ({
        ...point,
        spawnCooldown: Math.max(100, Math.round(point.spawnCooldown * (1 / Math.max(multiplier, 0.1))))
      }))
    };

    return new SpawnManager(scene, zombieSystem, players, config, {
      getEnemyLimit: options.getEnemyLimit
    });
  }

  instantiateObjectives(levelId: string): ObjectiveSystem | undefined {
    const definition = this.loadLevel(levelId);
    if (definition.objectives.length === 0) {
      return undefined;
    }

    return new ObjectiveSystem(definition.objectives);
  }

  instantiateInteractables(levelId: string): InteractableSystem | undefined {
    const definition = this.loadLevel(levelId);
    if (definition.interactables.length === 0) {
      return undefined;
    }

    return new InteractableSystem(definition.interactables);
  }

  instantiateTriggers(
    levelId: string,
    scene: Phaser.Scene,
    players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
    callbacks: TriggerSystemCallbacks = {}
  ): TriggerSystem | undefined {
    const definition = this.loadLevel(levelId);
    if (definition.triggers.length === 0) {
      return undefined;
    }

    return new TriggerSystem(scene, players, {
      levelId,
      triggers: definition.triggers
    }, callbacks);
  }

  getCinematics(levelId: string): CinematicConfig[] {
    return this.loadLevel(levelId).cinematics;
  }


  instantiateRestartManager(
    scene: Phaser.Scene,
    dependencies: LevelRestartManagerDependencies
  ): LevelRestartManager {
    return new LevelRestartManager(scene, dependencies);
  }

  transitionToLevel(scene: Phaser.Scene, levelId: string, exitId: string): void {
    const level = this.loadLevel(levelId);
    const exit = level.exits.find((entry) => entry.id === exitId);
    if (!exit) {
      throw new Error(`LevelManager: exit "${exitId}" not found in level "${levelId}".`);
    }

    scene.scene.start(exit.scene_key, {
      respawnPoint: exit.spawn_point
    });
  }
}
