import Phaser from 'phaser';
import { controlManager } from '../input/ControlManager';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';

interface CinematicBeat {
  beat: string;
}

interface CinematicSceneData {
  flowNode?: CampaignFlowNode;
}

export class CinematicScene extends Phaser.Scene {
  constructor() {
    super('CinematicScene');
  }

  create(data: CinematicSceneData = {}): void {
    const cinematicPath = data.flowNode?.cinematicPath;
    const cinematic = (cinematicPath ? this.cache.json.get(cinematicPath) : undefined) as { beats: CinematicBeat[] } | undefined;
    const beats = cinematic?.beats ?? [];
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 1);
    this.add.text(width / 2, 64, 'CINEMÁTICA', { color: '#f8fafc', fontFamily: 'monospace', fontSize: '26px' }).setOrigin(0.5);
    this.add.text(width / 2, height / 2, beats.map((b) => `• ${b.beat}`).join('\n') || 'Sin cinemática cargada', {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '18px',
      align: 'center',
      wordWrap: { width: width - 120 }
    }).setOrigin(0.5);
    this.add.text(width / 2, height - 36, 'ENTER para continuar', { color: '#93c5fd', fontFamily: 'monospace', fontSize: '14px' }).setOrigin(0.5);

    this.input.keyboard?.once(controlManager.getPhaserEventName('next_level'), () => {
      const manager = new SceneFlowManager(this);
      const next = manager.advance();
      if (next) {
        manager.transitionToNode(next);
      }
    });
  }
}
