import Phaser from 'phaser';
import { controlManager } from '../input/ControlManager';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';

interface CampaignIntroSceneData {
  flowNode?: CampaignFlowNode;
}

export class CampaignIntroScene extends Phaser.Scene {
  constructor() {
    super('CampaignIntroScene');
  }

  create(_data: CampaignIntroSceneData = {}): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 1);
    this.add.text(width / 2, height / 2 - 24, 'CAMPAÑA: NO WAY DOWN', {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '30px'
    }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 + 24, 'ENTER para desplegar el primer nivel', {
      color: '#93c5fd',
      fontFamily: 'monospace',
      fontSize: '18px'
    }).setOrigin(0.5);

    this.input.keyboard?.once(controlManager.getPhaserEventName('next_level'), () => {
      const manager = new SceneFlowManager(this);
      const next = manager.advance();
      if (next) {
        manager.transitionToNode(next);
      }
    });
  }
}
