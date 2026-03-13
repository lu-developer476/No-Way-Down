import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ZombieSystem } from '../systems/ZombieSystem';
import {
  Level4CombatJsonConfig,
  Level4CombatSystem
} from '../systems/Level4CombatSystem';
import level4CombatJson from '../../public/assets/levels/level4_combat_zones.json';

export function buildLevel4CombatSystemExample(
  scene: Phaser.Scene,
  players: Player[],
  zombieSystem: ZombieSystem,
  setMissionProgress: (payload: { completed: number; total: number; ratio: number }) => void,
  onAllZonesCompleted: () => void
): Level4CombatSystem {
  const combatConfig = level4CombatJson as Level4CombatJsonConfig;

  return new Level4CombatSystem(scene, players, zombieSystem, combatConfig, {
    onZoneActivated: (zone) => {
      scene.registry.set('interactionHint', `${zone.nombre} activa. Cierra filas y limpia la zona.`);
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
}
