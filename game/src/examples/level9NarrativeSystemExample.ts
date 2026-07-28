import {
  Level9NarrativeCallbacks,
  Level9NarrativeConfig,
  Level9NarrativeEvent,
  Level9NarrativeSnapshot,
  Level9NarrativeSystem
} from '../systems/Level9NarrativeSystem';
import level9NarrativeChainJson from '../../public/assets/levels/level9_narrative_chain.json';

export interface Level9NarrativeRuntime {
  narrativeSystem: Level9NarrativeSystem;
  emitNarrativeEvent: (event: Level9NarrativeEvent) => void;
}

/**
 * Ejemplo de conexión del Nivel 9 con lógica desacoplada de GameScene.
 * GameScene sólo emite eventos de dominio y consume snapshot/callbacks.
 */
export function buildLevel9NarrativeSystemExample(
  callbacks: Level9NarrativeCallbacks = {}
): Level9NarrativeRuntime {
  const config = level9NarrativeChainJson as Level9NarrativeConfig;

  const narrativeSystem = Level9NarrativeSystem.fromJson(config, {
    ...callbacks,
    onStateChanged: (snapshot: Level9NarrativeSnapshot) => {
      callbacks.onStateChanged?.(snapshot);
    }
  });

  const emitNarrativeEvent = (event: Level9NarrativeEvent): void => {
    narrativeSystem.processEvent(event);
  };

  return {
    narrativeSystem,
    emitNarrativeEvent
  };
}
