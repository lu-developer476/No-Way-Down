import Phaser from 'phaser';
import { Level10ParkingExplorationSystem } from './Level10ParkingExplorationSystem';
import level4ReverseRouteJson from '../../public/assets/levels/level4_reverse_route.json';
import { ReverseRouteConfig, ReverseRouteSystem } from './ReverseRouteSystem';

export class EnvironmentSystem {
  private readonly instantiated: unknown[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  instantiate(systemNames: string[]): void {
    const constructors: Record<string, () => unknown> = {
      Level10ParkingExplorationSystem: () => new Level10ParkingExplorationSystem({
        levelId: 'parking-runtime',
        vehicles: [],
        resources: []
      }),

      ReverseRouteSystem: () => {
        const reverseRouteSystem = ReverseRouteSystem.fromJson(level4ReverseRouteJson as ReverseRouteConfig);
        this.scene.registry.set('level4CanonicalReverseRoute', reverseRouteSystem.getSnapshot());
        this.scene.registry.set('interactionHint', 'Ruta inversa habilitada: regreso hacia la oficina 422.');
        return reverseRouteSystem;
      }
    };

    systemNames.forEach((name) => {
      const createSystem = constructors[name];
      if (!createSystem) {
        this.scene.registry.set(`environmentSystemMissing:${name}`, true);
        return;
      }

      try {
        this.instantiated.push(createSystem());
      } catch {
        this.scene.registry.set(`environmentSystemInvalidConfig:${name}`, true);
      }
    });
  }
}
