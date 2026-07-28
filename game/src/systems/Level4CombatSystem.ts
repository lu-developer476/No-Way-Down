import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import {
  LevelProgressionConfig,
  LevelProgressionSystem,
  LevelProgressionZoneConfig,
  SpawnEnemyRequest
} from './LevelProgressionSystem';
import { ZombieSystem } from './ZombieSystem';

export type Level4CombatZoneId =
  | 'zona-1-escaleras-bajas'
  | 'zona-2-rellano-intermedio'
  | 'zona-3-acceso-segundo-piso'
  | 'zona-4-sector-central'
  | 'zona-5-salida-final';

export interface Level4CombatJsonBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Level4CombatJsonBlocker {
  id: string;
  area: Level4CombatJsonBounds;
  color?: number;
  alpha?: number;
  empiezaActivo?: boolean;
}

export interface Level4CombatJsonSpawnWave {
  tipoEnemigo?: string;
  cantidad: number;
  puntosAparicion: Array<{ x: number; y: number }>;
  metadata?: Record<string, unknown>;
}

export interface Level4CombatJsonZone {
  id: Level4CombatZoneId;
  nombre: string;
  trigger: Level4CombatJsonBounds;
  bloquearAlActivar: string[];
  desbloquearAlCompletar?: string[];
  habilitarSecciones?: string[];
  oleadas: Level4CombatJsonSpawnWave[];
  hintAlActivar?: string;
  hintAlCompletar?: string;
}

export interface Level4CombatJsonConfig {
  bloqueos: Level4CombatJsonBlocker[];
  zonas: Level4CombatJsonZone[];
}

export interface Level4CombatSystemCallbacks {
  onZoneActivated?: (zone: Level4CombatJsonZone) => void;
  onZoneCompleted?: (zone: Level4CombatJsonZone) => void;
  onProgressUpdated?: (payload: { completed: number; total: number; ratio: number }) => void;
}

export interface Level4CombatSystemOptions {
  debugHintsInRegistry?: boolean;
  registryProgressKey?: string;
}

const DEFAULT_OPTIONS: Required<Level4CombatSystemOptions> = {
  debugHintsInRegistry: true,
  registryProgressKey: 'level4CombatProgress'
};

export function createLevel4CombatProgressionConfig(config: Level4CombatJsonConfig): LevelProgressionConfig {
  return {
    blockers: config.bloqueos.map((blocker) => ({
      id: blocker.id,
      bounds: blocker.area,
      color: blocker.color,
      alpha: blocker.alpha,
      startsEnabled: blocker.empiezaActivo ?? false
    })),
    zones: config.zonas.map<LevelProgressionZoneConfig>((zone) => ({
      id: zone.id,
      trigger: zone.trigger,
      lockBlockers: zone.bloquearAlActivar,
      unlockBlockers: zone.desbloquearAlCompletar,
      enableSections: zone.habilitarSecciones,
      hintOnActivate: zone.hintAlActivar ?? `${zone.nombre} activa: elimina a todos los enemigos.`,
      hintOnComplete: zone.hintAlCompletar ?? `${zone.nombre} completada.`,
      spawnWaves: zone.oleadas.map((wave) => ({
        enemyType: wave.tipoEnemigo ?? 'zombie',
        count: wave.cantidad,
        spawnPoints: wave.puntosAparicion,
        metadata: wave.metadata
      }))
    }))
  };
}

export class Level4CombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly zoneById: Map<string, Level4CombatJsonZone>;
  private readonly callbacks: Level4CombatSystemCallbacks;
  private readonly options: Required<Level4CombatSystemOptions>;
  private readonly progression: LevelProgressionSystem<Zombie>;
  private readonly totalZones: number;

  constructor(
    scene: Phaser.Scene,
    players: Player[],
    zombieSystem: ZombieSystem,
    config: Level4CombatJsonConfig,
    callbacks: Level4CombatSystemCallbacks = {},
    options: Level4CombatSystemOptions = {}
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.options = {
      debugHintsInRegistry: options.debugHintsInRegistry ?? DEFAULT_OPTIONS.debugHintsInRegistry,
      registryProgressKey: options.registryProgressKey ?? DEFAULT_OPTIONS.registryProgressKey
    };

    this.zoneById = new Map(config.zonas.map((zone) => [zone.id, zone]));
    this.totalZones = config.zonas.length;

    this.progression = new LevelProgressionSystem<Zombie>(
      scene,
      players as Phaser.Types.Physics.Arcade.GameObjectWithBody[],
      createLevel4CombatProgressionConfig(config),
      {
        spawnEnemy: (request: SpawnEnemyRequest) => {
          if (request.enemyType !== 'zombie') {
            return null;
          }

          return zombieSystem.spawn(request.spawnPoint.x, request.spawnPoint.y);
        },
        isEnemyAlive: (enemy) => enemy.active,
        onZoneActivated: (zoneId) => {
          const zone = this.zoneById.get(zoneId);
          if (!zone) {
            return;
          }

          this.callbacks.onZoneActivated?.(zone);
        },
        onZoneCompleted: (zoneId) => {
          const zone = this.zoneById.get(zoneId);
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
    return Array.from(this.zoneById.keys()).filter((zoneId) => this.progression.getZoneState(zoneId) === 'completed').length;
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
