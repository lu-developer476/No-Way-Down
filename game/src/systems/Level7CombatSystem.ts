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
import { CombatEventSystem } from './core/CombatEventSystem';

interface Level7Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Level7Section {
  id: string;
  name: string;
  bounds: Level7Bounds;
}

interface Level7SpawnPoint {
  id: string;
  section_id: string;
  position: {
    x: number;
    y: number;
  };
}

export interface Level7LayoutConfig {
  sections: Level7Section[];
  spawn_points: Level7SpawnPoint[];
}

export interface Level7NarrativeGateConfig {
  checkpointId: string;
  checkpointLabel: string;
  blocksUntilCleared?: boolean;
  onCombatClearedObjective?: string;
}

export interface Level7WaveConfig {
  wave: number;
  enemy_type?: string;
  enemies: number;
  spawn_ids: string[];
}

export interface Level7CombatZoneConfig {
  id: string;
  label: string;
  section_id: string;
  trigger: Level7Bounds;
  lock_mode: 'block' | 'tension';
  blocker?: {
    id?: string;
    offset_x?: number;
    thickness?: number;
    extra_height?: number;
  };
  waves: Level7WaveConfig[];
  narrative_gate?: Level7NarrativeGateConfig;
}

export interface Level7CombatJsonConfig {
  levelId: string;
  registryProgressKey?: string;
  registryNarrativeGateKey?: string;
  zones: Level7CombatZoneConfig[];
}

export interface Level7CombatResolvedZone {
  id: string;
  label: string;
  sectionId: string;
  sectionName: string;
  lockMode: 'block' | 'tension';
  blockerId?: string;
  narrativeGate?: Level7NarrativeGateConfig;
}

export interface Level7CombatSystemCallbacks {
  onZoneActivated?: (zone: Level7CombatResolvedZone) => void;
  onZoneCompleted?: (zone: Level7CombatResolvedZone) => void;
  onProgressUpdated?: (payload: { completed: number; total: number; ratio: number }) => void;
  onNarrativeGateUpdated?: (payload: {
    checkpointId: string;
    checkpointLabel: string;
    blocked: boolean;
    zone: Level7CombatResolvedZone;
  }) => void;
}

interface Level7ProgressionBuild {
  config: LevelProgressionConfig;
  resolvedZones: Level7CombatResolvedZone[];
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function resolveSpawnPoints(spawnIds: string[], spawnPointById: Map<string, Level7SpawnPoint>): Array<{ x: number; y: number }> {
  const points = spawnIds
    .map((spawnId) => spawnPointById.get(spawnId)?.position)
    .filter((point): point is { x: number; y: number } => Boolean(point));

  if (points.length === 0) {
    throw new Error(`Level7CombatSystem: no se encontraron spawn_ids válidos para [${spawnIds.join(', ')}].`);
  }

  return points;
}

function buildBlocker(zone: Level7CombatZoneConfig, section: Level7Section): { id: string; bounds: Level7Bounds } | null {
  if (zone.lock_mode !== 'block') {
    return null;
  }

  const blockerId = zone.blocker?.id ?? `blocker-${zone.id}`;
  const thickness = zone.blocker?.thickness ?? 56;
  const offsetX = zone.blocker?.offset_x ?? 0;
  const extraHeight = zone.blocker?.extra_height ?? 120;

  return {
    id: blockerId,
    bounds: {
      x: section.bounds.x + section.bounds.width + thickness / 2 + offsetX,
      y: section.bounds.y,
      width: thickness,
      height: section.bounds.height + extraHeight
    }
  };
}

export function createLevel7CombatProgressionConfig(
  layoutConfig: Level7LayoutConfig,
  combatConfig: Level7CombatJsonConfig
): Level7ProgressionBuild {
  const sectionById = new Map(layoutConfig.sections.map((section) => [section.id, section]));
  const spawnPointById = new Map(layoutConfig.spawn_points.map((spawnPoint) => [spawnPoint.id, spawnPoint]));

  const resolvedZones = combatConfig.zones.map<Level7CombatResolvedZone>((zone) => {
    const section = sectionById.get(zone.section_id);
    if (!section) {
      throw new Error(`Level7CombatSystem: la zona "${zone.id}" referencia section_id desconocido "${zone.section_id}".`);
    }

    return {
      id: zone.id,
      label: zone.label,
      sectionId: section.id,
      sectionName: section.name,
      lockMode: zone.lock_mode,
      blockerId: zone.lock_mode === 'block' ? zone.blocker?.id ?? `blocker-${zone.id}` : undefined,
      narrativeGate: zone.narrative_gate
    };
  });

  const blockers = uniqueById(
    combatConfig.zones
      .map((zone) => {
        const section = sectionById.get(zone.section_id);
        if (!section) {
          throw new Error(`Level7CombatSystem: no se encontró la sección ${zone.section_id}.`);
        }

        return buildBlocker(zone, section);
      })
      .filter((blocker): blocker is { id: string; bounds: Level7Bounds } => Boolean(blocker))
  );

  const zones = combatConfig.zones.map<LevelProgressionZoneConfig>((zone) => {
    const resolvedZone = resolvedZones.find((candidate) => candidate.id === zone.id);
    if (!resolvedZone) {
      throw new Error(`Level7CombatSystem: no se pudo resolver la zona ${zone.id}.`);
    }

    return {
      id: zone.id,
      trigger: zone.trigger,
      lockBlockers: resolvedZone.blockerId ? [resolvedZone.blockerId] : [],
      unlockBlockers: resolvedZone.blockerId ? [resolvedZone.blockerId] : [],
      hintOnActivate: `Zona activa: ${zone.label}. ${zone.lock_mode === 'block' ? 'Paso bloqueado: elimina la amenaza.' : 'Presión hostil: mantén el avance bajo fuego.'}`,
      hintOnComplete: `Zona completada: ${zone.label}.`,
      spawnWaves: zone.waves.map((wave) => ({
        enemyType: wave.enemy_type ?? 'zombie',
        count: wave.enemies,
        spawnPoints: resolveSpawnPoints(wave.spawn_ids, spawnPointById),
        metadata: {
          sourceWave: wave.wave,
          sourceZoneId: zone.id,
          sourceSectionId: zone.section_id,
          narrativeCheckpointId: zone.narrative_gate?.checkpointId,
          lockMode: zone.lock_mode
        }
      }))
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

export class Level7CombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: Level7CombatSystemCallbacks;
  private readonly progression: LevelProgressionSystem<Zombie>;
  private readonly zoneById: Map<string, Level7CombatResolvedZone>;
  private readonly totalZones: number;
  private readonly coreCombatEvents: CombatEventSystem;
  private readonly narrativeGateByCheckpointId = new Map<string, boolean>();
  private readonly registryProgressKey: string;
  private readonly registryNarrativeGateKey: string;

  constructor(
    scene: Phaser.Scene,
    players: Player[],
    zombieSystem: ZombieSystem,
    layoutConfig: Level7LayoutConfig,
    combatConfig: Level7CombatJsonConfig,
    callbacks: Level7CombatSystemCallbacks = {}
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.registryProgressKey = combatConfig.registryProgressKey ?? 'level7CombatProgress';
    this.registryNarrativeGateKey = combatConfig.registryNarrativeGateKey ?? 'level7NarrativeCombatGates';

    const progressionBuild = createLevel7CombatProgressionConfig(layoutConfig, combatConfig);
    this.zoneById = new Map(progressionBuild.resolvedZones.map((zone) => [zone.id, zone]));
    this.totalZones = progressionBuild.resolvedZones.length;
    this.coreCombatEvents = new CombatEventSystem(progressionBuild.resolvedZones.map((zone) => zone.id));

    progressionBuild.resolvedZones.forEach((zone) => {
      if (!zone.narrativeGate?.blocksUntilCleared) {
        return;
      }

      this.narrativeGateByCheckpointId.set(zone.narrativeGate.checkpointId, true);
    });

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
          const zone = this.zoneById.get(zoneId);
          if (!zone) {
            return;
          }

          this.coreCombatEvents.applyEvent({ type: 'zone-activated', zoneId });
          this.callbacks.onZoneActivated?.(zone);
        },
        onZoneCompleted: (zoneId) => {
          const zone = this.zoneById.get(zoneId);
          if (!zone) {
            return;
          }

          this.coreCombatEvents.applyEvent({ type: 'zone-cleared', zoneId });
          this.callbacks.onZoneCompleted?.(zone);
          this.onZoneCompleted(zone);
          this.publishProgress();
        },
        onHintChanged: (hint) => {
          this.scene.registry.set('interactionHint', hint);
        }
      }
    );

    this.publishNarrativeGates();
    this.publishProgress();
  }

  update(): void {
    this.progression.update();
  }

  destroy(): void {
    this.progression.destroy();
  }

  isCheckpointBlocked(checkpointId: string): boolean {
    return this.narrativeGateByCheckpointId.get(checkpointId) ?? false;
  }

  getCompletedZones(): number {
    return Array.from(this.zoneById.keys()).filter(
      (zoneId) => this.progression.getZoneState(zoneId) === 'completed'
    ).length;
  }

  private onZoneCompleted(zone: Level7CombatResolvedZone): void {
    const gate = zone.narrativeGate;
    if (!gate?.blocksUntilCleared) {
      return;
    }

    this.narrativeGateByCheckpointId.set(gate.checkpointId, false);
    this.publishNarrativeGates();

    this.callbacks.onNarrativeGateUpdated?.({
      checkpointId: gate.checkpointId,
      checkpointLabel: gate.checkpointLabel,
      blocked: false,
      zone
    });

    if (gate.onCombatClearedObjective) {
      this.scene.registry.set('currentObjective', gate.onCombatClearedObjective);
    }
  }

  private publishNarrativeGates(): void {
    this.scene.registry.set(
      this.registryNarrativeGateKey,
      Object.fromEntries(this.narrativeGateByCheckpointId.entries())
    );
  }

  private publishProgress(): void {
    const completed = this.getCompletedZones();
    const total = this.totalZones;
    const ratio = total > 0 ? completed / total : 0;

    this.scene.registry.set(this.registryProgressKey, {
      completed,
      total,
      ratio,
      completedAll: total > 0 && completed === total
    });

    this.callbacks.onProgressUpdated?.({ completed, total, ratio });
  }
}
