import Phaser from 'phaser';
import { DriveToSanTelmoCinematicSystem } from './DriveToSanTelmoCinematicSystem';
import { VehicleLootSystem } from './VehicleLootSystem';

export class MissionRuntimeSystem {
  private readonly instantiated: unknown[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  instantiate(systemNames: string[]): void {
    const constructors: Record<string, () => unknown> = {
      DriveToSanTelmoCinematicSystem: () =>
        DriveToSanTelmoCinematicSystem.fromJson(
          this.scene,
          {
            levelId: 'mission-runtime',
            cinematicId: 'drive-to-santelmo-runtime',
            triggerId: 'mission-trigger',
            movementLocked: false,
            cameraShakeOnStartMs: 0,
            preDialoguePauseMs: 0,
            dialogue: [{ speaker: 'Nora', text: 'Seguimos avanzando.' }],
            routeBeats: [{ id: 'safe-route', label: 'Salida segura', distanceToBarrioBlocks: 3 }],
            ambushTrigger: {
              id: 'runtime-ambush',
              distanceToBarrioBlocks: 2,
              objectiveId: 'reach-safe-route',
              objectiveLabel: 'Llegar al barrio'
            }
          },
          {
            showDialogueLine: () => undefined,
            showRouteBeat: () => undefined,
            clearDialogue: () => undefined
          }
        ),
      VehicleLootSystem: () =>
        VehicleLootSystem.fromJson({
          levelId: 'mission-runtime',
          vehicles: [
            {
              id: 'runtime-car',
              label: 'Auto abandonado',
              locked: false,
              breakable: true,
              allowOpen: true,
              allowBreak: true,
              lootTable: [{ itemId: 'scrap', label: 'Chatarra', category: 'resource', chance: 1, quantity: 1 }]
            }
          ]
        })
    };

    systemNames.forEach((name) => {
      const createSystem = constructors[name];
      if (!createSystem) {
        this.scene.registry.set(`missionSystemMissing:${name}`, true);
        return;
      }

      try {
        this.instantiated.push(createSystem());
      } catch {
        this.scene.registry.set(`missionSystemInvalidConfig:${name}`, true);
      }
    });
  }
}
