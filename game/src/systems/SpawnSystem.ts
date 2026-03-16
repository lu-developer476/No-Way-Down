import Phaser from 'phaser';
import { MixedSpawnSystem } from './MixedSpawnSystem';
import { OfficeSpawnSystem } from './OfficeSpawnSystem';
import { VerticalSpawnSystem } from './VerticalSpawnSystem';

export class SpawnSystem {
  private readonly instantiated: unknown[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  instantiate(systemNames: string[]): void {
    const constructors: Record<string, () => unknown> = {
      MixedSpawnSystem: () => new (MixedSpawnSystem as unknown as new (...args: any[]) => unknown)(this.scene, [], {
        minPlayerDistance: 0,
        unsafePlayerDistance: 0,
        pointsBySource: {}
      }, {}),
      OfficeSpawnSystem: () => new (OfficeSpawnSystem as unknown as new (...args: any[]) => unknown)(this.scene, [], {
        offices: [],
        minPlayerDistance: 0
      }, {}),
      VerticalSpawnSystem: () => new (VerticalSpawnSystem as unknown as new (...args: any[]) => unknown)(this.scene, undefined, [], [])
    };

    this.instantiateWithRegistry(systemNames, constructors, 'spawnSystem');
  }

  private instantiateWithRegistry(systemNames: string[], constructors: Record<string, () => unknown>, keyPrefix: string): void {
    systemNames.forEach((name) => {
      const createSystem = constructors[name];
      if (!createSystem) {
        this.scene.registry.set(`${keyPrefix}Missing:${name}`, true);
        return;
      }

      try {
        this.instantiated.push(createSystem());
      } catch {
        this.scene.registry.set(`${keyPrefix}InvalidConfig:${name}`, true);
      }
    });
  }
}
