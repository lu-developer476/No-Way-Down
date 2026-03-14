import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import {
  LevelProgressionConfig,
  LevelProgressionSystem,
  LevelProgressionZoneConfig,
  SpawnEnemyRequest
} from './LevelProgressionSystem';
import {
  Level5CombatZone,
  Level5SpawnPoint,
  Level5ThirdFloorConfig
} from './Level5ThirdFloorTypes';
import { ZombieSystem } from './ZombieSystem';

export type Level5CombatZoneId =
  | 'zona-1-acceso-al-piso'
  | 'zona-2-corredor-inicial'
  | 'zona-3-galeria-central'
  | 'zona-4-sector-oficinas'
  | 'zona-5-corredor-final';

interface Level5ZoneBlueprint {
  id: Level5CombatZoneId;
  fallbackName: string;
  sectionNameMatcher: RegExp;
}

const LEVEL5_ZONE_BLUEPRINTS: Level5ZoneBlueprint[] = [
  {
    id: 'zona-1-acceso-al-piso',
    fallbackName: 'acceso al piso',
    sectionNameMatcher: /acceso\s+por\s+escaleras|acceso\s+al\s+piso/i
  },
  {
    id: 'zona-2-corredor-inicial',
    fallbackName: 'corredor inicial',
    sectionNameMatcher: /corredor\s+inicial/i
  },
  {
    id: 'zona-3-galeria-central',
    fallbackName: 'galería central',
    sectionNameMatcher: /galer[ií]a\s+(con\s+vista\s+al\s+hall|central)/i
  },
  {
    id: 'zona-4-sector-oficinas',
    fallbackName: 'sector de oficinas',
    sectionNameMatcher: /sector\s+de\s+oficinas|bloque\s+administrativo/i
  },
  {
    id: 'zona-5-corredor-final',
    fallbackName: 'corredor final',
    sectionNameMatcher: /corredor\s+final|tramo\s+final/i
  }
];

const BLOCKER_THICKNESS = 48;

export interface Level5CombatResolvedZone {
  id: Level5CombatZoneId;
  name: string;
  blockerId: string;
  sourceZone: Level5CombatZone;
}

export interface Level5CombatSystemCallbacks {
  onZoneActivated?: (zone: Level5CombatResolvedZone) => void;
  onZoneCompleted?: (zone: Level5CombatResolvedZone) => void;
  onProgressUpdated?: (payload: { completed: number; total: number; ratio: number }) => void;
}

export interface Level5CombatSystemOptions {
  debugHintsInRegistry?: boolean;
  registryProgressKey?: string;
}

const DEFAULT_OPTIONS: Required<Level5CombatSystemOptions> = {
  debugHintsInRegistry: true,
  registryProgressKey: 'level5CombatProgress'
};

interface Level5CombatProgressionBuild {
  config: LevelProgressionConfig;
  resolvedZones: Level5CombatResolvedZone[];
}

function buildSpawnPointsForWave(spawnIds: string[], spawnPointById: Map<string, Level5SpawnPoint>): Array<{ x: number; y: number }> {
  const spawnPoints = spawnIds
    .map((spawnId) => spawnPointById.get(spawnId)?.position)
    .filter((position): position is { x: number; y: number } => Boolean(position));

  if (spawnPoints.length === 0) {
    throw new Error(`Level5CombatSystem: no hay puntos de aparición válidos para [${spawnIds.join(', ')}].`);
  }

  return spawnPoints;
}

function buildBlockerFromArea(zoneId: Level5CombatZoneId, area: { x: number; y: number; width: number; height: number }): {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
} {
  const blockerId = `blocker-${zoneId}`;
  return {
    id: blockerId,
    bounds: {
      x: area.x + area.width + BLOCKER_THICKNESS / 2,
      y: area.y,
      width: BLOCKER_THICKNESS,
      height: area.height + 120
    }
  };
}

export function createLevel5CombatProgressionConfig(config: Level5ThirdFloorConfig): Level5CombatProgressionBuild {
  const spawnPointById = new Map(config.spawn_points.map((spawnPoint) => [spawnPoint.id, spawnPoint]));

  const resolvedZones = LEVEL5_ZONE_BLUEPRINTS.map<Level5CombatResolvedZone>((blueprint) => {
    const sourceZone = config.combat_zones.find((zone) => {
      const section = config.sections.find((candidate) => candidate.id === zone.section_id);
      return section ? blueprint.sectionNameMatcher.test(section.name) : false;
    });

    if (!sourceZone) {
      throw new Error(`Level5CombatSystem: no se encontró zona de combate para "${blueprint.fallbackName}".`);
    }

    return {
      id: blueprint.id,
      name: blueprint.fallbackName,
      blockerId: `blocker-${blueprint.id}`,
      sourceZone
    };
  });

  const blockers = resolvedZones.map((zone) => buildBlockerFromArea(zone.id, zone.sourceZone.area));

  const zones = resolvedZones.map<LevelProgressionZoneConfig>((zone) => ({
    id: zone.id,
    trigger: zone.sourceZone.area,
    lockBlockers: [zone.blockerId],
    unlockBlockers: [zone.blockerId],
    hintOnActivate: `Zona activa: ${zone.name}. Elimina a todos los zombies.`,
    hintOnComplete: `Zona completada: ${zone.name}.`,
    spawnWaves: zone.sourceZone.waves.map((wave) => ({
      enemyType: 'zombie',
      count: wave.enemies,
      spawnPoints: buildSpawnPointsForWave(wave.spawns, spawnPointById),
      metadata: {
        sourceWave: wave.wave,
        sourceSectionId: zone.sourceZone.section_id,
        sourceZoneId: zone.sourceZone.id
      }
    }))
  }));

  return {
    config: {
      blockers,
      zones
    },
    resolvedZones
  };
}

export class Level5CombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: Level5CombatSystemCallbacks;
  private readonly options: Required<Level5CombatSystemOptions>;
  private readonly progression: LevelProgressionSystem<Zombie>;
  private readonly zoneById: Map<Level5CombatZoneId, Level5CombatResolvedZone>;
  private readonly totalZones: number;

  constructor(
    scene: Phaser.Scene,
    players: Player[],
    zombieSystem: ZombieSystem,
    config: Level5ThirdFloorConfig,
    callbacks: Level5CombatSystemCallbacks = {},
    options: Level5CombatSystemOptions = {}
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.options = {
      debugHintsInRegistry: options.debugHintsInRegistry ?? DEFAULT_OPTIONS.debugHintsInRegistry,
      registryProgressKey: options.registryProgressKey ?? DEFAULT_OPTIONS.registryProgressKey
    };

    const progressionBuild = createLevel5CombatProgressionConfig(config);
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
          const zone = this.zoneById.get(zoneId as Level5CombatZoneId);
          if (!zone) {
            return;
          }

          this.callbacks.onZoneActivated?.(zone);
        },
        onZoneCompleted: (zoneId) => {
          const zone = this.zoneById.get(zoneId as Level5CombatZoneId);
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
