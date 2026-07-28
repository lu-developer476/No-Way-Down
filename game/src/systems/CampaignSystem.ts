import Phaser from 'phaser';
import { CampaignFlowNode } from '../scenes/SceneFlowManager';

export class CampaignSystem {
  private readonly activeCampaignSystems: string[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  configureFlowNode(flowNode: CampaignFlowNode): void {
    this.scene.registry.set('activeCampaignNode', flowNode);
  }

  instantiate(systemNames: string[]): void {
    this.activeCampaignSystems.length = 0;
    systemNames.forEach((name) => {
      if (name === 'DriveToSanTelmoCinematicSystem') {
        this.activeCampaignSystems.push(name);
        return;
      }

      this.scene.registry.set(`campaignSystemMissing:${name}`, true);
    });

    this.scene.registry.set('activeCampaignSystems', [...this.activeCampaignSystems]);
  }
}
