import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ZombieSystem } from '../systems/ZombieSystem';
import {
  NarrativeCheckpointSystem,
  NarrativeCheckpointSystemConfig
} from '../systems/NarrativeCheckpointSystem';
import {
  Level7CombatJsonConfig,
  Level7CombatSystem,
  Level7LayoutConfig
} from '../systems/Level7CombatSystem';
import level7LayoutJson from '../../public/assets/levels/level7_quinto_piso.json';
import level7CombatJson from '../../public/assets/levels/level7_combat_system.json';
import level7NarrativeJson from '../../public/assets/levels/level7_narrative_checkpoints.json';

export interface Level7CombatAndNarrativeRuntime {
  combatSystem: Level7CombatSystem;
  narrativeCheckpointSystem: NarrativeCheckpointSystem;
}

export function buildLevel7CombatSystemExample(
  scene: Phaser.Scene,
  players: Player[],
  zombieSystem: ZombieSystem
): Level7CombatAndNarrativeRuntime {
  const layoutConfig = level7LayoutJson as Level7LayoutConfig;
  const combatConfig = level7CombatJson as Level7CombatJsonConfig;
  const narrativeConfig = level7NarrativeJson as NarrativeCheckpointSystemConfig;

  const combatSystem = new Level7CombatSystem(scene, players, zombieSystem, layoutConfig, combatConfig, {
    onZoneActivated: (zone) => {
      scene.registry.set('interactionHint', `Combate activo: ${zone.label}.`);
    },
    onZoneCompleted: (zone) => {
      scene.registry.set('interactionHint', `Zona despejada: ${zone.label}.`);
    },
    onProgressUpdated: (progress) => {
      scene.registry.set('level7CombatProgress', progress);

      if (progress.completed === progress.total) {
        scene.registry.set('currentObjective', 'Todos los tramos del piso despejados. Dirígete al punto previo a la cinemática.');
      }
    },
    onNarrativeGateUpdated: ({ checkpointLabel }) => {
      scene.registry.set('interactionHint', `${checkpointLabel} liberado: puedes iniciar la secuencia narrativa.`);
    }
  });

  const narrativeCheckpointSystem = NarrativeCheckpointSystem.fromJson(scene, players, narrativeConfig, {
    isCombatPending: ({ checkpoint }) => combatSystem.isCheckpointBlocked(checkpoint.id),
    onCheckpointActivated: ({ checkpoint }) => {
      scene.registry.set('interactionHint', `Checkpoint activado: ${checkpoint.label}.`);
    },
    onCombatResolutionRequired: ({ checkpoint }) => {
      scene.registry.set('interactionHint', `Checkpoint en espera: limpia el combate asociado a ${checkpoint.label}.`);
    },
    onRecoveryCompleted: ({ checkpoint }) => {
      scene.registry.set('interactionHint', `Checkpoint resuelto: ${checkpoint.label}.`);
    },
    onObjectiveUpdated: (objectiveText) => {
      scene.registry.set('currentObjective', objectiveText);
    }
  });

  return {
    combatSystem,
    narrativeCheckpointSystem
  };
}
