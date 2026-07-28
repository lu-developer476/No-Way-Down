import Phaser from 'phaser';

export interface CheckpointLocation {
  x: number;
  y: number;
}

export class CheckpointSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registryKey = 'checkpoint'
  ) {}

  getCheckpoint(): CheckpointLocation | undefined {
    const checkpoint = this.scene.registry.get(this.registryKey) as CheckpointLocation | undefined;
    if (checkpoint?.x === undefined || checkpoint?.y === undefined) {
      return undefined;
    }

    return checkpoint;
  }

  setCheckpoint(checkpoint: CheckpointLocation): void {
    this.scene.registry.set(this.registryKey, checkpoint);
  }

  resolveRespawnPoint(data: { respawnPoint?: CheckpointLocation }, fallback: CheckpointLocation): CheckpointLocation {
    return this.getCheckpoint() ?? data.respawnPoint ?? fallback;
  }
}
