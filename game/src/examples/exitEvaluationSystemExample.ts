import {
  ExitEvaluationCallbacks,
  ExitEvaluationConfig,
  ExitEvaluationResult,
  ExitEvaluationSystem
} from '../systems/ExitEvaluationSystem';
import level9ExitEvaluationJson from '../../public/assets/levels/level9_exit_evaluation.json';

export interface ExitEvaluationRuntime {
  exitEvaluationSystem: ExitEvaluationSystem;
  markBacktrackFromExitA: () => void;
  tryEvaluateExit: (exitId: string) => ExitEvaluationResult | undefined;
}

/**
 * Integración de ejemplo para GameScene:
 * 1) retroceso desde A => markBacktrackFromExitA()
 * 2) inspección/uso de B,C,D,E => tryEvaluateExit(id)
 * 3) aplicar outcomes a combate, narrativa y estado de ruta
 */
export function buildExitEvaluationSystemExample(
  callbacks: ExitEvaluationCallbacks = {}
): ExitEvaluationRuntime {
  const config = level9ExitEvaluationJson as ExitEvaluationConfig;

  const exitEvaluationSystem = ExitEvaluationSystem.fromJson(config, callbacks);

  const markBacktrackFromExitA = (): void => {
    exitEvaluationSystem.markBacktrackFromExit('A');
  };

  const tryEvaluateExit = (exitId: string): ExitEvaluationResult | undefined => {
    if (!exitEvaluationSystem.canEvaluateExit(exitId)) {
      return undefined;
    }

    return exitEvaluationSystem.evaluateExit(exitId);
  };

  return {
    exitEvaluationSystem,
    markBacktrackFromExitA,
    tryEvaluateExit
  };
}
