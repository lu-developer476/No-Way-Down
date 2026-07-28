import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { ZombieSystem } from '../systems/ZombieSystem';
import {
  Level4CombatJsonConfig,
  Level4CombatSystem
} from '../systems/Level4CombatSystem';
import {
  MixedSpawnJsonConfig,
  MixedSpawnSystem
} from '../systems/MixedSpawnSystem';
import level4CombatJson from '../../public/assets/levels/level4_combat_zones.json';
import level4MixedSpawnJson from '../../public/assets/levels/level4_mixed_spawns.json';

export interface Level4MixedSpawnRuntime {
  combatSystem: Level4CombatSystem;
  mixedSpawnSystem: MixedSpawnSystem<Zombie>;
}

export function buildLevel4CombatSystemExample(
  scene: Phaser.Scene,
  players: Player[],
  zombieSystem: ZombieSystem,
  setMissionProgress: (payload: { completed: number; total: number; ratio: number }) => void,
  onAllZonesCompleted: () => void
): Level4MixedSpawnRuntime {
  const combatConfig = level4CombatJson as Level4CombatJsonConfig;
  const mixedSpawnConfig = level4MixedSpawnJson as MixedSpawnJsonConfig;

  const mixedSpawnSystem = MixedSpawnSystem.fromJson<Zombie>(scene, players, mixedSpawnConfig, {
    spawnEnemy: (x, y) => zombieSystem.spawn(x, y),
    isEnemyAlive: (enemy) => enemy.active,
    onWaveStarted: (wave) => {
      scene.registry.set('interactionHint', `Oleada ${wave.id} iniciada. Mantén cobertura.`);
    },
    onEncounterCompleted: () => {
      scene.registry.set('interactionHint', 'Encuentro mixto despejado. Sigue avanzando.');
    }
  });

  const combatSystem = new Level4CombatSystem(scene, players, zombieSystem, combatConfig, {
    onZoneActivated: (zone) => {
      scene.registry.set('interactionHint', `${zone.nombre} activa. Cierra filas y limpia la zona.`);

      const zoneWaves = mixedSpawnConfig.mixedSpawns.zoneWaves?.[zone.id];
      if (zoneWaves && zoneWaves.length > 0) {
        mixedSpawnSystem.startEncounter(zoneWaves);
      }
    },
    onZoneCompleted: (zone) => {
      scene.registry.set('interactionHint', `${zone.nombre} despejada. Sigue avanzando.`);
    },
    onProgressUpdated: (progress) => {
      setMissionProgress(progress);

      if (progress.completed === progress.total) {
        scene.registry.set('interactionHint', 'Nivel 4 asegurado. Habilita la transición final.');
        onAllZonesCompleted();
      }
    }
  });

  return {
    combatSystem,
    mixedSpawnSystem
  };
}
