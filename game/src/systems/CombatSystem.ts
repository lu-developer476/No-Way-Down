import Phaser from 'phaser';
import { Level6CombatSystem } from './Level6CombatSystem';
import { Level7CombatSystem } from './Level7CombatSystem';
import { Level4CombatSystem } from './Level4CombatSystem';

export class CombatSystem {
  private readonly instantiated: unknown[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  instantiate(systemNames: string[]): void {
    const constructors: Record<string, () => unknown> = {
      Level4CombatSystem: () => new (Level4CombatSystem as unknown as new (...args: any[]) => unknown)(this.scene, [], undefined, { bloqueos: [], zonas: [] }),
      Level6CombatSystem: () => new (Level6CombatSystem as unknown as new (...args: any[]) => unknown)(this.scene, [], undefined, { sections: [], spawn_points: [], combat_zones: [] }),
      Level7CombatSystem: () => new (Level7CombatSystem as unknown as new (...args: any[]) => unknown)(this.scene, [], undefined, { sections: [], checkpoints: [], spawn_points: [] }, { zones: [] })
    };

    systemNames.forEach((name) => {
      const createSystem = constructors[name];
      if (!createSystem) {
        this.scene.registry.set(`combatSystemMissing:${name}`, true);
        return;
      }

      try {
        this.instantiated.push(createSystem());
      } catch {
        this.scene.registry.set(`combatSystemInvalidConfig:${name}`, true);
      }
    });
  }
}
