import Phaser from 'phaser';
import { DriveToSanTelmoCinematicSystem } from './DriveToSanTelmoCinematicSystem';
import {
  Office422RescueConfig,
  Office422RescueSystem,
  RescuePresentation
} from './Office422RescueSystem';
import {
  SisterMessageCinematicConfig,
  SisterMessageCinematicSystem,
  SisterMessagePresentation
} from './SisterMessageCinematicSystem';
import { VehicleLootSystem } from './VehicleLootSystem';
import level4Office422RescueJson from '../../public/assets/levels/level8_office422_rescue.json';
import level4SeleneCallJson from '../../public/assets/levels/level8_sister_message_dialogue.json';

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
      Office422RescueSystem: () => {
        const rescueConfig = level4Office422RescueJson as Office422RescueConfig;
        const setup = this.scene.registry.get('initialRunSetup') as { protagonist?: string } | undefined;
        const rescuePresentation: RescuePresentation = {
          showRescueStep: (step, context) => {
            this.scene.registry.set('interactionHint', `${step.actor}: ${step.text}`);
            this.scene.registry.set('level4RescueCurrentStep', {
              rescueId: context.rescueId,
              stepId: step.id,
              actor: step.actor,
              text: step.text
            });
          },
          clearRescueScene: () => {
            this.scene.registry.set('level4RescueCurrentStep', null);
          }
        };

        const rescueSystem = Office422RescueSystem.fromJson(this.scene, [], rescueConfig, rescuePresentation, {
          resolveRescuerCharacterId: () => setup?.protagonist,
          onRescueVariantSelected: (variant) => {
            this.scene.registry.set('level4RescueVariant', variant);
          },
          onCompanionRescued: (companion) => {
            this.scene.registry.set('interactionHint', `Rescate completado en oficina 422: ${companion.codename} se une al grupo.`);
          },
          onWeaponGranted: (weapon, companion) => {
            this.scene.registry.set('level4LorenaWeapon', {
              companionId: companion.id,
              weaponId: weapon.id,
              ammo: weapon.ammo
            });
          },
          onGroupCompositionUpdated: (groupUpdate) => {
            this.scene.registry.set('level4PartyUpdate', groupUpdate);
          },
          onRescueCompleted: (state) => {
            this.scene.registry.set('level4RescueState', state);
          }
        });

        void rescueSystem.triggerRescueByScript();
        return rescueSystem;
      },
      SisterMessageCinematicSystem: () => {
        const sisterConfig = level4SeleneCallJson as SisterMessageCinematicConfig;
        const sisterPresentation: SisterMessagePresentation = {
          showDialogueLine: (line) => {
            this.scene.registry.set('interactionHint', `${line.speaker}: ${line.text}`);
            this.scene.registry.set('level4SeleneCallLine', line);
          },
          clearDialogue: () => {
            this.scene.registry.set('level4SeleneCallLine', null);
          }
        };

        const sisterSystem = SisterMessageCinematicSystem.fromJson(this.scene, sisterConfig, sisterPresentation, {
          onObjectiveUpdated: (objective) => {
            this.scene.registry.set('currentObjective', objective.label);
            this.scene.registry.set('level4TransitionReady', {
              objectiveId: objective.id,
              ready: true
            });
          }
        });

        void sisterSystem.playAfterRescue(sisterConfig.triggerId);
        return sisterSystem;
      },
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
