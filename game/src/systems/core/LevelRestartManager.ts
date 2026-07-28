import Phaser from 'phaser';
import { CheckpointLocation, CheckpointSystem } from './CheckpointSystem';

export interface LevelRestartManagerDependencies {
  checkpointSystem: CheckpointSystem;
  resetEnemies?: () => void;
  resetObjectives?: () => void;
  resetInteractables?: () => void;
  beforeRestart?: () => void;
  preservedRegistryKeys?: string[];
}

interface RestartOptions {
  respawnPoint?: CheckpointLocation;
  preserveCampaignProgress?: boolean;
}

const DEFAULT_PRESERVED_KEYS = ['campaignState', 'partyState', 'campaignSnapshot'];

export class LevelRestartManager {
  private readonly preservedRegistryKeys: string[];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly dependencies: LevelRestartManagerDependencies
  ) {
    this.preservedRegistryKeys = dependencies.preservedRegistryKeys ?? DEFAULT_PRESERVED_KEYS;
  }

  restartLevel(options: RestartOptions = {}): void {
    const preservedState = new Map<string, unknown>();

    if (options.preserveCampaignProgress ?? true) {
      this.preservedRegistryKeys.forEach((key) => {
        preservedState.set(key, this.scene.registry.get(key));
      });
    }

    this.dependencies.resetEnemies?.();
    this.dependencies.resetObjectives?.();
    this.dependencies.resetInteractables?.();
    this.dependencies.beforeRestart?.();

    const respawnPoint = options.respawnPoint ?? this.dependencies.checkpointSystem.getCheckpoint();
    if (respawnPoint) {
      this.dependencies.checkpointSystem.setCheckpoint(respawnPoint);
    }

    preservedState.forEach((value, key) => {
      this.scene.registry.set(key, value);
    });

    this.scene.scene.restart({ respawnPoint });
  }
}
