import Phaser from 'phaser';
import { ZombieSystem } from '../systems/ZombieSystem';
import {
  Office422RescueConfig,
  Office422RescueSystem,
  RescuePresentation
} from '../systems/Office422RescueSystem';
import {
  Office422WaveCombatConfig,
  Office422WaveCombatSystem
} from '../systems/Office422WaveCombatSystem';
import rescueJson from '../../public/assets/levels/level8_office422_rescue.json';
import waveCombatJson from '../../public/assets/levels/level8_office422_wave_combat.json';

export interface Office422RescueWaveRuntime {
  rescueSystem: Office422RescueSystem;
  waveCombatSystem: Office422WaveCombatSystem;
}

/**
 * Integración sugerida para Oficina 422:
 * 1) Se dispara el rescate.
 * 2) Se entrega arma a la compañera.
 * 3) Inicia automáticamente la oleada de combate en espacio cerrado/semi-cerrado.
 * 4) Al completar la oleada se desbloquea la salida.
 */
export function buildOffice422RescueWaveCombatExample(
  scene: Phaser.Scene,
  players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
  zombieSystem: ZombieSystem,
  presentation: RescuePresentation
): Office422RescueWaveRuntime {
  const rescueConfig = rescueJson as Office422RescueConfig;
  const combatConfig = waveCombatJson as Office422WaveCombatConfig;

  const waveCombatSystem = Office422WaveCombatSystem.fromJson(scene, players, zombieSystem, combatConfig, {
    onCombatStarted: () => {
      scene.registry.set('interactionHint', 'Oleada iniciada: protege la oficina 422.');
      scene.registry.set('currentObjective', 'Elimina la oleada para abrir la salida.');
    },
    onWaveStarted: ({ waveIndex, totalWaves }) => {
      scene.registry.set('interactionHint', `Oleada ${waveIndex + 1}/${totalWaves} activa.`);
    },
    onCombatCompleted: () => {
      scene.registry.set('interactionHint', 'Zona asegurada. Salida habilitada.');
      scene.registry.set('currentObjective', 'Reagrúpate y avanza al siguiente sector.');
    }
  });

  const rescueSystem = Office422RescueSystem.fromJson(scene, players, rescueConfig, presentation, {
    onWeaponGranted: (weapon, companion) => {
      scene.registry.set(
        'interactionHint',
        `${companion.codename} recibe ${weapon.name} (${weapon.ammo} balas). Prepárate para la oleada.`
      );
    },
    onRescueCompleted: () => {
      waveCombatSystem.startAfterRescue();
    }
  });

  return {
    rescueSystem,
    waveCombatSystem
  };
}
