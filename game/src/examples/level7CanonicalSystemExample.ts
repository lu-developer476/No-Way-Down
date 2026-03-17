import canonicalConfigJson from '../../public/assets/levels/level7_canonical_subsuelo_descent.json';
import { Level7CanonicalConfig, Level7CanonicalSystem } from '../systems/Level7CanonicalSystem';

const config = canonicalConfigJson as Level7CanonicalConfig;

export function runLevel7CanonicalSystemExample(): void {
  const system = new Level7CanonicalSystem(config, {
    onCinematicStarted: ({ cinematicId, dialogue }) => {
      console.info('[L7 Canon] Cinemática iniciada:', cinematicId, `(${dialogue.length} líneas)`);
    },
    onInventoryShown: ({ inventory }) => {
      console.info('[L7 Canon] Inventario actual:', inventory);
    },
    onObjectiveUpdated: (objective) => {
      console.info('[L7 Canon] Objetivo:', objective);
    },
    onCorridorProgress: ({ cleared, total, zoneId }) => {
      console.info(`[L7 Canon] Pasillo infectado: ${cleared}/${total} zonas limpias (última: ${zoneId}).`);
    },
    onLevel8LinkReady: ({ nextLevelId, triggerId }) => {
      console.info('[L7 Canon] Enlace preparado:', nextLevelId, '-> trigger', triggerId);
    },
    onCompleted: (snapshot) => {
      console.info('[L7 Canon] Nivel completado. Snapshot final:', snapshot);
    }
  });

  system.startBriefing();
  system.confirmInventoryAndResumeGameplay();

  system.processGameplayEvent({ type: 'floor-reached', floor: 2 });
  system.processGameplayEvent({ type: 'corridor-zone-cleared', targetId: 'b2_corridor_entry' });
  system.processGameplayEvent({ type: 'corridor-zone-cleared', targetId: 'b2_corridor_mid' });
  system.processGameplayEvent({ type: 'corridor-zone-cleared', targetId: 'b2_corridor_far_end' });
  system.processGameplayEvent({ type: 'level-link-triggered', targetId: 'b2_to_b3_spiral_access' });
}
