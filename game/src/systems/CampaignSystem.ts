import Phaser from 'phaser';
import { CampaignFlowNode } from '../scenes/SceneFlowManager';

export class CampaignSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  configureFlowNode(flowNode: CampaignFlowNode): void {
    this.scene.registry.set('activeCampaignNode', flowNode);
  }
}
