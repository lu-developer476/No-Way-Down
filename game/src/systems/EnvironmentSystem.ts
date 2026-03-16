import Phaser from 'phaser';
import { Level10ParkingExplorationSystem } from './Level10ParkingExplorationSystem';

export class EnvironmentSystem {
  private readonly instantiated: unknown[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  instantiate(systemNames: string[]): void {
    const constructors: Record<string, () => unknown> = {
      Level10ParkingExplorationSystem: () => new Level10ParkingExplorationSystem({
        levelId: 'parking-runtime',
        vehicles: [],
        resources: []
      })
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
