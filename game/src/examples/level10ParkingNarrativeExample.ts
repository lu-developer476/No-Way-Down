import Phaser from 'phaser';
import {
  Level10ParkingExplorationConfig,
  Level10ParkingExplorationSystem
} from '../systems/Level10ParkingExplorationSystem';
import {
  Level10NarrativeConfig,
  Level10NarrativeEvent,
  Level10NarrativeSystem
} from '../systems/Level10NarrativeSystem';
import {
  Level10ResistanceCombatConfig,
  Level10ResistanceCombatSystem
} from '../systems/Level10ResistanceCombatSystem';
import explorationJson from '../../public/assets/levels/level10_parking_exploration.json';
import narrativeJson from '../../public/assets/levels/level10_narrative_chain.json';
import resistanceJson from '../../public/assets/levels/level10_resistance_encounters.json';

export interface Level10ParkingNarrativeRuntime {
  explorationSystem: Level10ParkingExplorationSystem;
  narrativeSystem: Level10NarrativeSystem;
  resistanceSystem: Level10ResistanceCombatSystem;
  emitNarrativeEvent: (event: Level10NarrativeEvent) => void;
}

/**
 * Ejemplo de integración de Nivel 10 sin acoplar lógica narrativa a GameScene.
 */
export function buildLevel10ParkingNarrativeExample(scene: Phaser.Scene): Level10ParkingNarrativeRuntime {
  const explorationConfig = explorationJson as Level10ParkingExplorationConfig;
  const narrativeConfig = narrativeJson as Level10NarrativeConfig;
  const resistanceConfig = resistanceJson as Level10ResistanceCombatConfig;

  const narrativeSystem = Level10NarrativeSystem.fromJson(narrativeConfig, {
    onBeatActivated: (beat) => {
      scene.registry.set('currentObjective', beat.label);
      scene.registry.set('interactionHint', beat.description);
    },
    onStateChanged: (snapshot) => {
      scene.registry.set(narrativeConfig.registryKey ?? 'level10NarrativeState', snapshot);
    }
  });

  const emitNarrativeEvent = (event: Level10NarrativeEvent): void => {
    narrativeSystem.processEvent(event);
  };

  const explorationSystem = Level10ParkingExplorationSystem.fromJson(explorationConfig, {
    onVehicleInspected: (vehicle, snapshot) => {
      scene.registry.set('interactionHint', `Vehículo inspeccionado: ${vehicle.label}.`);
      if (snapshot.interactiveVehiclesInspected >= snapshot.interactiveVehiclesTotal) {
        emitNarrativeEvent({ type: 'parking-explored', targetId: 'zonas_estacionamiento_completas' });
      }
    },
    onResourceCollected: (resource, snapshot) => {
      scene.registry.set('interactionHint', `Recurso obtenido: ${resource.label}.`);

      const requiredResources = ['llave_sedan_supervivencia', 'botiquin_trauma', 'racion_energia'];
      const hasAll = requiredResources.every((resourceId) => snapshot.resourcesCollected.includes(resourceId));
      if (hasAll) {
        emitNarrativeEvent({ type: 'resources-secured', targetId: 'kit_supervivencia_b3' });
      }
    },
    onVehicleUnlocked: (vehicle) => {
      emitNarrativeEvent({ type: 'usable-car-discovered', targetId: vehicle.id });
    }
  });

  const resistanceSystem = Level10ResistanceCombatSystem.fromJson(resistanceConfig, {
    onEncounterStarted: (encounter) => {
      emitNarrativeEvent({ type: 'resistance-started', targetId: encounter.id, durationMs: encounter.durationMs });
    },
    onEncounterCompleted: (encounter) => {
      emitNarrativeEvent({ type: 'resistance-completed', targetId: encounter.id, durationMs: encounter.durationMs });
    }
  });

  return {
    explorationSystem,
    narrativeSystem,
    resistanceSystem,
    emitNarrativeEvent
  };
}
