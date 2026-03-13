import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
  private healthText?: Phaser.GameObjects.Text;
  private zombieCountText?: Phaser.GameObjects.Text;
  private objectiveText?: Phaser.GameObjects.Text;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.healthText = this.add.text(16, 16, '', {
      color: '#f9fafb',
      fontSize: '18px'
    });

    this.zombieCountText = this.add.text(16, 44, '', {
      color: '#f9fafb',
      fontSize: '18px'
    });

    this.objectiveText = this.add.text(16, 72, '', {
      color: '#facc15',
      fontSize: '18px'
    });

    this.registry.events.on('changedata-playerHealth', this.handleHealthChanged, this);
    this.registry.events.on('changedata-zombiesRemaining', this.handleZombiesChanged, this);
    this.registry.events.on('changedata-currentObjective', this.handleObjectiveChanged, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-playerHealth', this.handleHealthChanged, this);
      this.registry.events.off('changedata-zombiesRemaining', this.handleZombiesChanged, this);
      this.registry.events.off('changedata-currentObjective', this.handleObjectiveChanged, this);
    });

    this.refreshFromRegistry();
  }

  private refreshFromRegistry(): void {
    this.handleHealthChanged(this.registry, this.registry.get('playerHealth') ?? 0);
    this.handleZombiesChanged(this.registry, this.registry.get('zombiesRemaining') ?? 0);
    this.handleObjectiveChanged(this.registry, this.registry.get('currentObjective') ?? '');
  }

  private handleHealthChanged(_parent: Phaser.Data.DataManager, value: number): void {
    this.healthText?.setText(`Vida: ${value}`);
  }

  private handleZombiesChanged(_parent: Phaser.Data.DataManager, value: number): void {
    this.zombieCountText?.setText(`Zombies restantes: ${value}`);
  }

  private handleObjectiveChanged(_parent: Phaser.Data.DataManager, value: string): void {
    this.objectiveText?.setText(`Objetivo: ${value}`);
  }

}
