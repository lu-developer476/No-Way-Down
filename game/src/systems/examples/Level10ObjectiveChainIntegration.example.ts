import objectiveChainConfig from '../../../public/assets/levels/level10_objective_chain.json';
import {
  Level10ObjectiveChain,
  type Level10ObjectiveChainConfig,
  integrateLevel10ObjectiveChainExample
} from '../Level10ObjectiveChain';

/**
 * Ejemplo mínimo de cableado para una escena/sistema de nivel.
 *
 * Nota: este archivo es demostrativo para mostrar integración sin hardcodear
 * la secuencia de objetivos dentro de GameScene.
 */
export function createLevel10ObjectiveChainIntegrationExample(deps: {
  cinematicSystem: {
    onPlayed: (handler: (cinematicId: string) => void) => void;
  };
  timerSystem: {
    onCompleted: (handler: (timerId: string, elapsedMs: number) => void) => void;
  };
  vehicleSystem: {
    onVehicleInspected: (handler: (vehicleId: string) => void) => void;
    onUsableVehicleLocated: (handler: (vehicleId: string) => void) => void;
    onVehicleEscaped: (handler: (vehicleId: string, survivors: number) => void) => void;
    onParkingExitDetected: (handler: (exitId: string) => void) => void;
  };
  combatSystem: {
    onAmbushSurvived: (handler: (encounterId: string, elapsedMs: number) => void) => void;
  };
}): Level10ObjectiveChain {
  const chain = Level10ObjectiveChain.fromJson(objectiveChainConfig as Level10ObjectiveChainConfig, {
    onObjectiveActivated: (objective) => {
      console.info('[Level10ObjectiveChain] Objetivo activo:', objective.id);
    },
    onObjectiveCompleted: (objective) => {
      console.info('[Level10ObjectiveChain] Objetivo completado:', objective.id);
    },
    onChainCompleted: () => {
      console.info('[Level10ObjectiveChain] Cadena completada.');
    }
  });

  integrateLevel10ObjectiveChainExample(chain, deps);

  return chain;
}
