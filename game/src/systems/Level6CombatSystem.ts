import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import {
  LevelProgressionConfig,
  LevelProgressionSystem,
  LevelProgressionZoneConfig,
  SpawnEnemyRequest
} from './LevelProgressionSystem';
import { Level6CombatZone, Level6FourthFloorConfig, Level6SpawnPoint } from './Level6FourthFloorTypes';
import { ZombieSystem } from './ZombieSystem';

export type Level6CombatZoneId =
  | 'zona-1-pasillo-servicio'
  | 'zona-2-cocina'
  | 'zona-3-area-preparacion'
  | 'zona-4-comedor'
  | 'zona-5-salida';

interface Level6ZoneBlueprint {
  id: Level6CombatZoneId;
  fallbackName: string;
  sectionNameMatcher: RegExp;
}

const LEVEL6_ZONE_BLUEPRINTS: Level6ZoneBlueprint[] = [
  {
    id: 'zona-1-pasillo-servicio',
    fallbackName: 'pasillo de servicio',
    sectionNameMatcher: /pasillo\s+de\s+servicio/i
  },
  {
    id: 'zona-2-cocina',
    fallbackName: 'cocina',
    sectionNameMatcher: /cocina\s+industrial|cocina/i
  },
  {
    id: 'zona-3-area-preparacion',
    fallbackName: 'área de preparación',
    sectionNameMatcher: /[áa]rea\s+de\s+preparaci[oó]n/i
  },
  {
    id: 'zona-4-comedor',
    fallbackName: 'comedor',
    sectionNameMatcher: /comedor\s+de\s+empleados|comedor/i
  },
  {
    id: 'zona-5-salida',
    fallbackName: 'salida',
    sectionNameMatcher: /salida/i
  }
];

const BLOCKER_THICKNESS = 56;
const EXTRA_BLOCKER_HEIGHT = 120;

export interface Level6CombatResolvedZone {
  id: Level6CombatZoneId;
  name: string;
  blockerId: string;
  sourceCombatZone?: Level6CombatZone;
  sectionId: string;
}

export interface Level6CombatSystemCallbacks {
  onZoneActivated?: (zone: Level6CombatResolvedZone) => void;
  onZoneCompleted?: (zone: Level6CombatResolvedZone) => void;
  onProgressUpdated?: (payload: { completed: number; total: number; ratio: number }) => void;
}

export interface Level6CombatSystemOptions {
  debugHintsInRegistry?: boolean;
  registryProgressKey?: string;
}

const DEFAULT_OPTIONS: Required<Level6CombatSystemOptions> = {
  debugHintsInRegistry: true,
  registryProgressKey: 'level6CombatProgress'
};

interface Level6CombatProgressionBuild {
  config: LevelProgressionConfig;
  resolvedZones: Level6CombatResolvedZone[];
}

function buildSpawnPointsFromIds(spawnIds: string[], spawnPointById: Map<string, Level6SpawnPoint>): Array<{ x: number; y: number }> {
  const spawnPoints = spawnIds
    .map((spawnId) => spawnPointById.get(spawnId)?.position)
    .filter((position): position is { x: number; y: number } => Boolean(position));

  if (spawnPoints.length === 0) {
    throw new Error(`Level6CombatSystem: no hay puntos de aparición válidos para [${spawnIds.join(', ')}].`);
  }

  return spawnPoints;
}

function buildBlockerFromBounds(zoneId: Level6CombatZoneId, bounds: { x: number; y: number; width: number; height: number }): {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
} {
  return {
    id: `blocker-${zoneId}`,
    bounds: {
      x: bounds.x + bounds.width + BLOCKER_THICKNESS / 2,
      y: bounds.y,
      width: BLOCKER_THICKNESS,
      height: bounds.height + EXTRA_BLOCKER_HEIGHT
    }
  };
}

export function createLevel6CombatProgressionConfig(config: Level6FourthFloorConfig): Level6CombatProgressionBuild {
  const spawnPointById = new Map(config.spawn_points.map((spawnPoint) => [spawnPoint.id, spawnPoint]));
  const spawnPointsBySectionId = new Map<string, Level6SpawnPoint[]>();

  config.spawn_points.forEach((spawnPoint) => {
    const sectionSpawnPoints = spawnPointsBySectionId.get(spawnPoint.section_id) ?? [];
    sectionSpawnPoints.push(spawnPoint);
    spawnPointsBySectionId.set(spawnPoint.section_id, sectionSpawnPoints);
  });

  const resolvedZones = LEVEL6_ZONE_BLUEPRINTS.map<Level6CombatResolvedZone>((blueprint) => {
    const section = config.sections.find((candidate) => blueprint.sectionNameMatcher.test(candidate.name));

    if (!section) {
      throw new Error(`Level6CombatSystem: no se encontró sección para "${blueprint.fallbackName}".`);
    }

    return {
      id: blueprint.id,
      name: blueprint.fallbackName,
      blockerId: `blocker-${blueprint.id}`,
      sectionId: section.id,
      sourceCombatZone: config.combat_zones.find((zone) => zone.section_id === section.id)
    };
  });

  const blockers = resolvedZones.map((zone) => {
    const section = config.sections.find((candidate) => candidate.id === zone.sectionId);
    if (!section) {
      throw new Error(`Level6CombatSystem: no se encontró la sección ${zone.sectionId}.`);
    }

    return buildBlockerFromBounds(zone.id, section.bounds);
  });

  const zones = resolvedZones.map<LevelProgressionZoneConfig>((zone) => {
    const section = config.sections.find((candidate) => candidate.id === zone.sectionId);
    if (!section) {
      throw new Error(`Level6CombatSystem: no se encontró la sección ${zone.sectionId}.`);
    }

    const sectionSpawnPoints = spawnPointsBySectionId.get(zone.sectionId) ?? [];

    const spawnWaves = zone.sourceCombatZone
      ? zone.sourceCombatZone.waves.map((wave) => ({
          enemyType: 'zombie',
          count: wave.enemies,
          spawnPoints: buildSpawnPointsFromIds(wave.spawns, spawnPointById),
          metadata: {
            sourceWave: wave.wave,
            sourceZoneId: zone.sourceCombatZone?.id,
            sourceSectionId: zone.sectionId
          }
        }))
      : [
          {
            enemyType: 'zombie',
            count: Math.max(4, sectionSpawnPoints.length * 3),
            spawnPoints: sectionSpawnPoints.map((spawnPoint) => spawnPoint.position),
            metadata: {
              sourceWave: 1,
              sourceSectionId: zone.sectionId,
              generatedBySystem: true
            }
          }
        ];

    if (spawnWaves.some((wave) => wave.spawnPoints.length === 0)) {
      throw new Error(`Level6CombatSystem: la zona "${zone.name}" no tiene puntos de aparición.`);
    }

    return {
      id: zone.id,
      trigger: section.bounds,
      lockBlockers: [zone.blockerId],
      unlockBlockers: [zone.blockerId],
      hintOnActivate: `Zona activa: ${zone.name}. Elimina a todos los zombies.`,
      hintOnComplete: `Zona completada: ${zone.name}.`,
      spawnWaves
    };
  });

  return {
    config: {
      blockers,
      zones
    },
    resolvedZones
  };
}

export class Level6CombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: Level6CombatSystemCallbacks;
  private readonly options: Required<Level6CombatSystemOptions>;
  private readonly progression: LevelProgressionSystem<Zombie>;
  private readonly zoneById: Map<Level6CombatZoneId, Level6CombatResolvedZone>;
  private readonly totalZones: number;

  constructor(
    scene: Phaser.Scene,
    players: Player[],
    zombieSystem: ZombieSystem,
    config: Level6FourthFloorConfig,
    callbacks: Level6CombatSystemCallbacks = {},
    options: Level6CombatSystemOptions = {}
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.options = {
      debugHintsInRegistry: options.debugHintsInRegistry ?? DEFAULT_OPTIONS.debugHintsInRegistry,
      registryProgressKey: options.registryProgressKey ?? DEFAULT_OPTIONS.registryProgressKey
    };

    const progressionBuild = createLevel6CombatProgressionConfig(config);
    this.zoneById = new Map(progressionBuild.resolvedZones.map((zone) => [zone.id, zone]));
    this.totalZones = progressionBuild.resolvedZones.length;

    this.progression = new LevelProgressionSystem<Zombie>(
      scene,
      players as Phaser.Types.Physics.Arcade.GameObjectWithBody[],
      progressionBuild.config,
      {
        spawnEnemy: (request: SpawnEnemyRequest) => {
          if (request.enemyType !== 'zombie') {
            return null;
          }

          return zombieSystem.spawn(request.spawnPoint.x, request.spawnPoint.y);
        },
        isEnemyAlive: (enemy) => enemy.active,
        onZoneActivated: (zoneId) => {
          const zone = this.zoneById.get(zoneId as Level6CombatZoneId);
          if (!zone) {
            return;
          }

          this.callbacks.onZoneActivated?.(zone);
        },
        onZoneCompleted: (zoneId) => {
          const zone = this.zoneById.get(zoneId as Level6CombatZoneId);
          if (!zone) {
            return;
          }

          this.callbacks.onZoneCompleted?.(zone);
          this.publishProgress();
        },
        onHintChanged: (hint) => {
          if (this.options.debugHintsInRegistry) {
            this.scene.registry.set('interactionHint', hint);
          }
        }
      }
    );

    this.publishProgress();
  }

  update(): void {
    this.progression.update();
  }

  destroy(): void {
    this.progression.destroy();
  }

  getCompletedZones(): number {
    return Array.from(this.zoneById.keys()).filter(
      (zoneId) => this.progression.getZoneState(zoneId) === 'completed'
    ).length;
  }

  areAllZonesCompleted(): boolean {
    return this.totalZones > 0 && this.getCompletedZones() === this.totalZones;
  }

  private publishProgress(): void {
    const completed = this.getCompletedZones();
    const total = this.totalZones;
    const ratio = total > 0 ? completed / total : 0;

    this.scene.registry.set(this.options.registryProgressKey, {
      completed,
      total,
      ratio,
      completedAll: total > 0 && completed === total
    });

    this.callbacks.onProgressUpdated?.({ completed, total, ratio });
  }
}
