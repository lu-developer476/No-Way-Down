import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ZombieSystem } from '../systems/ZombieSystem';
import {
  NarrativeCheckpointSystem,
  NarrativeCheckpointSystemConfig
} from '../systems/NarrativeCheckpointSystem';
import {
  CinematicCallSystem,
  CinematicCallSystemConfig
} from '../systems/CinematicCallSystem';
import {
  Level7CombatJsonConfig,
  Level7CombatSystem,
  Level7LayoutConfig
} from '../systems/Level7CombatSystem';
import {
  Level7ObjectiveChain,
  Level7ObjectiveChainConfig,
  Level7ObjectiveCompletionEvent
} from '../systems/Level7ObjectiveChain';
import level7LayoutJson from '../../public/assets/levels/level7_quinto_piso.json';
import level7CombatJson from '../../public/assets/levels/level7_combat_system.json';
import level7NarrativeJson from '../../public/assets/levels/level7_narrative_checkpoints.json';
import level7CinematicCallJson from '../../public/assets/levels/level7_cinematic_call.json';
import level7ObjectiveChainJson from '../../public/assets/levels/level7_objective_chain.json';

export interface Level7ObjectiveChainRuntime {
  objectiveChain: Level7ObjectiveChain;
  combatSystem: Level7CombatSystem;
  narrativeCheckpointSystem: NarrativeCheckpointSystem;
  cinematicCallSystem: CinematicCallSystem;
  onSectionEntered: (sectionId: string) => void;
}

/**
 * Ejemplo completo de integración sin hardcodear la secuencia en GameScene.
 * La secuencia vive en level7_objective_chain.json y los sistemas emiten eventos.
 */
export function buildLevel7ObjectiveChainExample(
  scene: Phaser.Scene,
  players: Player[],
  zombieSystem: ZombieSystem
): Level7ObjectiveChainRuntime {
  const layoutConfig = level7LayoutJson as Level7LayoutConfig;
  const combatConfig = level7CombatJson as Level7CombatJsonConfig;
  const narrativeConfig = level7NarrativeJson as NarrativeCheckpointSystemConfig;
  const cinematicConfig = level7CinematicCallJson as CinematicCallSystemConfig;
  const objectiveChainConfig = level7ObjectiveChainJson as Level7ObjectiveChainConfig;

  const objectiveChain = Level7ObjectiveChain.fromJson(objectiveChainConfig, {
    onObjectiveActivated: (objective) => {
      scene.registry.set('currentObjective', objective.label);
      scene.registry.set('interactionHint', `Objetivo activo: ${objective.label}.`);
    },
    onObjectiveCompleted: (objective) => {
      scene.registry.set('interactionHint', `Objetivo completado: ${objective.label}.`);
    },
    onStateChanged: (snapshot) => {
      scene.registry.set(objectiveChainConfig.registryKey ?? 'level7ObjectiveChainState', snapshot);
    }
  });

  const emitObjectiveEvent = (event: Level7ObjectiveCompletionEvent): void => {
    objectiveChain.processEvent(event);
  };

  const combatSystem = new Level7CombatSystem(scene, players, zombieSystem, layoutConfig, combatConfig, {
    onZoneCompleted: (zone) => {
      emitObjectiveEvent({ type: 'combat-zone-cleared', targetId: zone.id });
    }
  });

  const cinematicCallSystem = CinematicCallSystem.fromJson(
    scene,
    cinematicConfig,
    {
      showDialogueLine: (line) => {
        scene.registry.set('cinematicDialogueLine', `${line.speaker}: ${line.text}`);
      },
      clearDialogue: () => {
        scene.registry.set('cinematicDialogueLine', '');
      }
    },
    {
      onCinematicCompleted: (cinematic) => {
        emitObjectiveEvent({ type: 'cinematic-played', targetId: cinematic.id });
      }
    }
  );

  const narrativeCheckpointSystem = NarrativeCheckpointSystem.fromJson(scene, players, narrativeConfig, {
    isCombatPending: ({ checkpoint }) => combatSystem.isCheckpointBlocked(checkpoint.id),
    onRecoveryCompleted: ({ checkpoint }) => {
      emitObjectiveEvent({ type: 'checkpoint-completed', targetId: checkpoint.id });
      void cinematicCallSystem.triggerByCheckpoint(checkpoint.id);
    }
  });

  const onSectionEntered = (sectionId: string): void => {
    emitObjectiveEvent({ type: 'section-entered', targetId: sectionId });
  };

  return {
    objectiveChain,
    combatSystem,
    narrativeCheckpointSystem,
    cinematicCallSystem,
    onSectionEntered
  };
}
