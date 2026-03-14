import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ZombieSystem } from '../systems/ZombieSystem';
import {
  Level8ObjectiveChain,
  Level8ObjectiveChainConfig,
  Level8ObjectiveEvent
} from '../systems/Level8ObjectiveChain';
import {
  Office422RescueConfig,
  Office422RescueSystem,
  RescuePresentation
} from '../systems/Office422RescueSystem';
import {
  Office422WaveCombatConfig,
  Office422WaveCombatSystem
} from '../systems/Office422WaveCombatSystem';
import {
  SisterMessageCinematicConfig,
  SisterMessageCinematicSystem,
  SisterMessagePresentation
} from '../systems/SisterMessageCinematicSystem';
import { TimedCheckpointSystem, TimedCheckpointSystemConfig } from '../systems/TimedCheckpointSystem';
import {
  Level8DescentRouteConfig,
  Level8TimedDescentSystem
} from '../systems/Level8TimedDescentSystem';
import {
  Level8FinalSiegeConfig,
  Level8FinalSiegeSystem
} from '../systems/Level8FinalSiegeSystem';
import {
  Level8OutroDialogueConfig,
  Level8OutroCinematicSystem,
  Level8OutroPresentation
} from '../systems/Level8OutroCinematicSystem';
import objectiveChainJson from '../../public/assets/levels/level8_objective_chain.json';
import rescueJson from '../../public/assets/levels/level8_office422_rescue.json';
import waveCombatJson from '../../public/assets/levels/level8_office422_wave_combat.json';
import sisterMessageJson from '../../public/assets/levels/level8_sister_message_dialogue.json';
import timedCheckpointJson from '../../../level8_timed_checkpoint.json';
import descentRouteJson from '../../public/assets/levels/level8_descent_route.json';
import finalSiegeJson from '../../public/assets/levels/level8_final_siege.json';
import outroJson from '../../public/assets/levels/level8_outro_dialogue.json';

export interface Level8ObjectiveChainRuntime {
  objectiveChain: Level8ObjectiveChain;
  rescueSystem: Office422RescueSystem;
  waveCombatSystem: Office422WaveCombatSystem;
  sisterMessageSystem: SisterMessageCinematicSystem;
  timedCheckpointSystem: TimedCheckpointSystem;
  timedDescentSystem: Level8TimedDescentSystem<unknown>;
  finalSiegeSystem: Level8FinalSiegeSystem;
  outroSystem: Level8OutroCinematicSystem;
  emitObjectiveEvent: (event: Level8ObjectiveEvent) => void;
}

/**
 * Ejemplo de integración para Nivel 8 sin hardcodear toda la secuencia en GameScene.
 *
 * - La secuencia obligatoria vive en level8_objective_chain.json.
 * - Cada sistema (cinemática, combate, checkpoint temporizado) emite eventos desacoplados.
 * - Level8ObjectiveChain consume eventos y avanza/falla objetivos según configuración JSON.
 */
export function buildLevel8ObjectiveChainExample(
  scene: Phaser.Scene,
  players: Player[],
  zombieSystem: ZombieSystem,
  rescuePresentation: RescuePresentation,
  sisterPresentation: SisterMessagePresentation,
  outroPresentation: Level8OutroPresentation
): Level8ObjectiveChainRuntime {
  const objectiveChainConfig = objectiveChainJson as Level8ObjectiveChainConfig;
  const rescueConfig = rescueJson as Office422RescueConfig;
  const waveCombatConfig = waveCombatJson as Office422WaveCombatConfig;
  const sisterConfig = sisterMessageJson as SisterMessageCinematicConfig;
  const timedCheckpointConfig = timedCheckpointJson as TimedCheckpointSystemConfig;
  const descentRouteConfig = descentRouteJson as Level8DescentRouteConfig;
  const finalSiegeConfig = finalSiegeJson as Level8FinalSiegeConfig;
  const outroConfig = outroJson as Level8OutroDialogueConfig;

  const physicsPlayers = players as Phaser.Types.Physics.Arcade.GameObjectWithBody[];

  const objectiveChain = Level8ObjectiveChain.fromJson(objectiveChainConfig, {
    onObjectiveActivated: (objective) => {
      scene.registry.set('currentObjective', objective.label);
      scene.registry.set('interactionHint', `Objetivo activo: ${objective.label}.`);
    },
    onObjectiveCompleted: (objective) => {
      scene.registry.set('interactionHint', `Objetivo completado: ${objective.label}.`);
    },
    onObjectiveFailed: (objective) => {
      scene.registry.set('interactionHint', `Objetivo fallido: ${objective.label}. Reinicia desde checkpoint.`);
    },
    onStateChanged: (snapshot) => {
      scene.registry.set(objectiveChainConfig.registryKey ?? 'level8ObjectiveChainState', snapshot);
    }
  });

  const emitObjectiveEvent = (event: Level8ObjectiveEvent): void => {
    objectiveChain.processEvent(event);
  };

  const waveCombatSystem = Office422WaveCombatSystem.fromJson(scene, physicsPlayers, zombieSystem, waveCombatConfig, {
    onCombatCompleted: ({ combatId }) => {
      emitObjectiveEvent({ type: 'combat-completed', targetId: combatId });
    }
  });

  const rescueSystem = Office422RescueSystem.fromJson(scene, physicsPlayers, rescueConfig, rescuePresentation, {
    onRescueCompleted: (state) => {
      emitObjectiveEvent({ type: 'rescue-completed', targetId: state.rescueId });
      waveCombatSystem.startAfterRescue();
    }
  });

  const sisterMessageSystem = SisterMessageCinematicSystem.fromJson(scene, sisterConfig, sisterPresentation, {
    onCinematicCompleted: ({ cinematicId }) => {
      emitObjectiveEvent({ type: 'cinematic-played', targetId: cinematicId });
    }
  });

  const timedCheckpointSystem = TimedCheckpointSystem.fromJson(scene, physicsPlayers, timedCheckpointConfig, {
    onCheckpointRestored: (checkpoint) => {
      emitObjectiveEvent({ type: 'checkpoint-restored', targetId: checkpoint.id });
    },
    onTimerStarted: ({ checkpointId }) => {
      emitObjectiveEvent({ type: 'timer-started', targetId: checkpointId });
    },
    onExpired: ({ checkpoint }) => {
      emitObjectiveEvent({ type: 'timer-expired', targetId: checkpoint.id });
    }
  });

  const timedDescentSystem = new Level8TimedDescentSystem<unknown>(scene, players, timedCheckpointSystem, descentRouteConfig, {
    spawnEnemy: () => null,
    isEnemyAlive: (_enemy: unknown) => false,
    onSectionEntered: (section) => {
      if (section.floor === 1) {
        emitObjectiveEvent({ type: 'floor-reached', targetId: 'floor_1' });
      }
    },
    onRouteCompleted: () => {
      emitObjectiveEvent({ type: 'floor-reached', targetId: 'floor_1' });
    }
  });

  const finalSiegeSystem = Level8FinalSiegeSystem.fromJson(scene, physicsPlayers, zombieSystem, finalSiegeConfig, {
    onSiegeCompleted: (snapshot) => {
      emitObjectiveEvent({ type: 'combat-completed', targetId: snapshot.siegeId });
    }
  });

  const outroSystem = Level8OutroCinematicSystem.fromJson(scene, outroConfig, outroPresentation, {
    onCinematicCompleted: ({ cinematicId }) => {
      emitObjectiveEvent({ type: 'cinematic-played', targetId: cinematicId });
    },
    onTransitionReady: () => {
      emitObjectiveEvent({ type: 'transition-enabled', targetId: 'level_9_access' });
    }
  });

  return {
    objectiveChain,
    rescueSystem,
    waveCombatSystem,
    sisterMessageSystem,
    timedCheckpointSystem,
    timedDescentSystem,
    finalSiegeSystem,
    outroSystem,
    emitObjectiveEvent
  };
}
