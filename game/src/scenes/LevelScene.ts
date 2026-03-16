import { GameScene } from './GameScene';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';
import { CampaignSystem } from '../systems/CampaignSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';

export class LevelScene extends GameScene {
  private campaignSystem?: CampaignSystem;
  private spawnSystem?: SpawnSystem;
  private combatSystem?: CombatSystem;
  private environmentSystem?: EnvironmentSystem;

  constructor() {
    super('LevelScene');
  }

  create(data: { flowNode?: CampaignFlowNode; skipLoad?: boolean; respawnPoint?: unknown } = {}): void {
    super.create({ skipLoad: true });

    if (!data.flowNode) {
      return;
    }

    this.campaignSystem = new CampaignSystem(this);
    this.spawnSystem = new SpawnSystem(this);
    this.combatSystem = new CombatSystem(this);
    this.environmentSystem = new EnvironmentSystem(this);

    this.campaignSystem.configureFlowNode(data.flowNode);
    this.spawnSystem.instantiate(data.flowNode.systems?.spawn ?? []);
    this.combatSystem.instantiate(data.flowNode.systems?.combat ?? []);
    this.environmentSystem.instantiate(data.flowNode.systems?.environment ?? []);

    this.input.keyboard?.once('keydown-ENTER', () => {
      const manager = new SceneFlowManager(this);
      const nextNode = manager.advance();
      if (nextNode) {
        manager.transitionToNode(nextNode);
      }
    });
  }
}
