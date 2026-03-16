import Phaser from 'phaser';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';

interface DialogueLine {
  speaker: string;
  text: string;
}

interface DialogueSceneData {
  flowNode?: CampaignFlowNode;
}

export class DialogueScene extends Phaser.Scene {
  constructor() {
    super('DialogueScene');
  }

  create(data: DialogueSceneData = {}): void {
    const dialoguePath = data.flowNode?.dialoguePath;
    const dialogue = (dialoguePath ? this.cache.json.get(dialoguePath) : undefined) as { lines: DialogueLine[] } | undefined;
    const lines = dialogue?.lines ?? [];
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a, 1);
    this.add.text(width / 2, 64, 'DIÁLOGO', { color: '#e2e8f0', fontFamily: 'monospace', fontSize: '26px' }).setOrigin(0.5);

    const content = lines.map((line) => `${line.speaker}: ${line.text}`).join('\n\n') || 'Sin diálogo cargado';
    this.add.text(width / 2, height / 2, content, {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '18px',
      align: 'center',
      wordWrap: { width: width - 120 }
    }).setOrigin(0.5);

    this.add.text(width / 2, height - 36, 'ENTER para continuar', { color: '#93c5fd', fontFamily: 'monospace', fontSize: '14px' }).setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', () => {
      const manager = new SceneFlowManager(this);
      const next = manager.advance();
      if (next) {
        manager.transitionToNode(next);
      }
    });
  }
}
