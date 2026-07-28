import Phaser from 'phaser';
import { ZombieSystem } from '../systems/ZombieSystem';
import {
  ExitEvaluationConfig,
  ExitEvaluationSystem,
  ExitEvaluationResult
} from '../systems/ExitEvaluationSystem';
import {
  IrreversibleLossEventConfig,
  IrreversibleLossEventSystem,
  SquadMember
} from '../systems/IrreversibleLossEventSystem';
import {
  ExitADialogueConfig,
  ExitACinematicSystem,
  ExitAPresentation
} from '../systems/ExitACinematicSystem';
import {
  ExitECinematicDecisionConfig,
  ExitECinematicDecisionSystem,
  ExitEPresentation
} from '../systems/ExitECinematicDecisionSystem';
import {
  Subsuelo2InfectionCinematicConfig,
  Subsuelo2InfectionCinematicSystem,
  Subsuelo2Presentation,
  Subsuelo2SquadMember
} from '../systems/Subsuelo2InfectionCinematicSystem';
import {
  FlankingEscapeCombatConfig,
  FlankingEscapeCombatSystem
} from '../systems/FlankingEscapeCombatSystem';
import {
  FinalSacrificeAlly,
  FinalSacrificeConfig,
  FinalSacrificePresentation,
  FinalSacrificeSystem
} from '../systems/FinalSacrificeSystem';
import {
  Level9ObjectiveChain,
  Level9ObjectiveChainConfig,
  Level9ObjectiveEvent
} from '../systems/Level9ObjectiveChain';
import objectiveChainJson from '../../public/assets/levels/level9_objective_chain.json';
import exitEvaluationJson from '../../public/assets/levels/level9_exit_evaluation.json';
import exitALogJson from '../../public/assets/levels/level9_exitA_dialogue.json';
import exitBLossJson from '../../public/assets/levels/level9_exitB_loss_event.json';
import exitAOptionalLossJson from '../../public/assets/levels/level9_exitA_optional_loss_event.json';
import exitEDecisionJson from '../../public/assets/levels/level9_exitE_decision_dialogue.json';
import subsuelo2Json from '../../public/assets/levels/level9_subsuelo2_infection_dialogue.json';
import finalSacrificeJson from '../../public/assets/levels/level9_final_sacrifice.json';
import flankCombatJson from '../../config/levels/level9/level9_flank_combat_zones.json';

export interface Level9ObjectiveChainRuntime {
  objectiveChain: Level9ObjectiveChain;
  exitEvaluationSystem: ExitEvaluationSystem;
  irreversibleLossSystem: IrreversibleLossEventSystem;
  optionalExitALossSystem: IrreversibleLossEventSystem;
  exitACinematicSystem: ExitACinematicSystem;
  exitECinematicSystem: ExitECinematicDecisionSystem;
  flankCombatSystem: FlankingEscapeCombatSystem;
  subsuelo2InfectionSystem: Subsuelo2InfectionCinematicSystem;
  finalSacrificeSystem: FinalSacrificeSystem;
  emitObjectiveEvent: (event: Level9ObjectiveEvent) => void;
}

/**
 * Ejemplo de integración del Nivel 9:
 * - secuencia de objetivos en JSON (sin hardcode en GameScene)
 * - eventos de cinemáticas, combate y pérdidas permanentes
 * - progresión de objetivos bloqueado/activo/completado/fallido
 */
export function buildLevel9ObjectiveChainExample(
  scene: Phaser.Scene,
  players: Phaser.Types.Physics.Arcade.GameObjectWithBody[],
  zombieSystem: ZombieSystem,
  squad: SquadMember[],
  infectionSquad: Subsuelo2SquadMember[],
  finalGroup: FinalSacrificeAlly[],
  exitAPresentation: ExitAPresentation,
  exitEPresentation: ExitEPresentation,
  infectionPresentation: Subsuelo2Presentation,
  finalSacrificePresentation: FinalSacrificePresentation
): Level9ObjectiveChainRuntime {
  const objectiveChainConfig = objectiveChainJson as Level9ObjectiveChainConfig;
  const exitEvaluationConfig = exitEvaluationJson as ExitEvaluationConfig;
  const exitAConfig = exitALogJson as ExitADialogueConfig;
  const exitBLossConfig = exitBLossJson as IrreversibleLossEventConfig;
  const exitAOptionalLossConfig = exitAOptionalLossJson as IrreversibleLossEventConfig;
  const exitEConfig = exitEDecisionJson as ExitECinematicDecisionConfig;
  const subsuelo2Config = subsuelo2Json as Subsuelo2InfectionCinematicConfig;
  const finalSacrificeConfig = finalSacrificeJson as FinalSacrificeConfig;
  const flankCombatConfig = flankCombatJson as FlankingEscapeCombatConfig;

  const objectiveChain = Level9ObjectiveChain.fromJson(objectiveChainConfig, {
    onObjectiveActivated: (objective) => {
      scene.registry.set('currentObjective', objective.label);
      scene.registry.set('interactionHint', `Objetivo activo: ${objective.label}.`);
    },
    onObjectiveCompleted: (objective) => {
      scene.registry.set('interactionHint', `Objetivo completado: ${objective.label}.`);
    },
    onObjectiveFailed: (objective) => {
      scene.registry.set('interactionHint', `Objetivo fallido: ${objective.label}.`);
    },
    onStateChanged: (snapshot) => {
      scene.registry.set(objectiveChainConfig.registryKey ?? 'level9ObjectiveChainState', snapshot);
    }
  });

  const emitObjectiveEvent = (event: Level9ObjectiveEvent): void => {
    objectiveChain.processEvent(event);
  };

  const exitEvaluationSystem = ExitEvaluationSystem.fromJson(exitEvaluationConfig, {
    onExitEvaluated: (result: ExitEvaluationResult) => {
      emitObjectiveEvent({ type: 'exit-evaluated', targetId: result.exitId });
    }
  });

  const irreversibleLossSystem = IrreversibleLossEventSystem.fromJson(exitBLossConfig, squad, {
    onLossTriggered: (snapshot) => {
      emitObjectiveEvent({
        type: 'permanent-loss-applied',
        targetId: snapshot.eventId,
        losses: snapshot.removedMemberIds.length
      });
    }
  });

  const optionalExitALossSystem = IrreversibleLossEventSystem.fromJson(exitAOptionalLossConfig, squad, {
    onLossTriggered: (snapshot) => {
      if (snapshot.removedMemberIds.length === 0) {
        return;
      }

      emitObjectiveEvent({
        type: 'permanent-loss-applied',
        targetId: snapshot.eventId,
        losses: snapshot.removedMemberIds.length
      });
    }
  });

  const exitACinematicSystem = ExitACinematicSystem.fromJson(scene, exitAConfig, exitAPresentation, {
    onCinematicStarted: () => {
      emitObjectiveEvent({ type: 'exit-attempted', targetId: 'A' });
    },
    onCinematicCompleted: ({ cinematicId }) => {
      emitObjectiveEvent({ type: 'cinematic-played', targetId: cinematicId });
      optionalExitALossSystem.processEvent({
        type: 'cinematic-confirmed',
        eventId: cinematicId
      });
      exitEvaluationSystem.markBacktrackFromExit('A');
      emitObjectiveEvent({ type: 'exit-backtracked', targetId: 'A' });
    }
  });

  const flankCombatSystem = FlankingEscapeCombatSystem.fromJson(scene, players, zombieSystem, flankCombatConfig, {
    onAllEncountersCompleted: () => {
      emitObjectiveEvent({ type: 'combat-completed', targetId: 'salidas_cd_flanqueadas' });
    }
  });

  const exitECinematicSystem = ExitECinematicDecisionSystem.fromJson(scene, exitEConfig, exitEPresentation, {
    onCinematicCompleted: ({ cinematicId }) => {
      emitObjectiveEvent({ type: 'cinematic-played', targetId: cinematicId });
    }
  });

  const subsuelo2InfectionSystem = Subsuelo2InfectionCinematicSystem.fromJson(
    scene,
    subsuelo2Config,
    infectionSquad,
    infectionPresentation,
    {
      onCinematicCompleted: ({ cinematicId }) => {
        emitObjectiveEvent({ type: 'cinematic-played', targetId: cinematicId });
      }
    }
  );

  const finalSacrificeSystem = FinalSacrificeSystem.fromJson(
    scene,
    finalSacrificeConfig,
    finalGroup,
    finalSacrificePresentation,
    {
      onSequenceFinished: ({ eventId }) => {
        emitObjectiveEvent({ type: 'cinematic-played', targetId: eventId });
      },
      onEscapeTransitionRequested: (transition) => {
        emitObjectiveEvent({ type: 'group-escaped', targetId: transition.destination });
      }
    }
  );

  return {
    objectiveChain,
    exitEvaluationSystem,
    irreversibleLossSystem,
    optionalExitALossSystem,
    exitACinematicSystem,
    exitECinematicSystem,
    flankCombatSystem,
    subsuelo2InfectionSystem,
    finalSacrificeSystem,
    emitObjectiveEvent
  };
}
