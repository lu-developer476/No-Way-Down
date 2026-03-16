import Phaser from 'phaser';
import { controlManager } from '../input/ControlManager';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';

interface CampaignIntroSceneData {
  flowNode?: CampaignFlowNode;
}

export class CampaignIntroScene extends Phaser.Scene {
  private enterKey?: Phaser.Input.Keyboard.Key;

  private hasStarted = false;

  private flowManager?: SceneFlowManager;

  constructor() {
    super('CampaignIntroScene');
  }

  create(_data: CampaignIntroSceneData = {}): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 1);
    this.add.text(width / 2, height / 2, 'ENTER para iniciar', {
      color: '#93c5fd',
      fontFamily: 'monospace',
      fontSize: '24px'
    }).setOrigin(0.5);

    this.flowManager = new SceneFlowManager(this);

    if (this.input.keyboard) {
      this.enterKey = this.input.keyboard.addKey(controlManager.getKeyCode('next_level'));
    } else {
      console.error('[CampaignIntroScene] Keyboard input no está disponible.');
    }

    this.input.on('pointerdown', () => {
      console.log('[CampaignIntroScene] Click detectado.');
      this.startCampaign('click');
    });
  }

  update(): void {
    if (!this.enterKey || this.hasStarted) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      console.log('[CampaignIntroScene] ENTER detectado.');
      this.startCampaign('enter');
    }
  }

  private startCampaign(source: 'enter' | 'click'): void {
    if (this.hasStarted) {
      return;
    }

    this.hasStarted = true;
    const manager = this.flowManager ?? new SceneFlowManager(this);

    console.log(`[CampaignIntroScene] Iniciando transición por ${source}.`);
    console.log('[CampaignIntroScene] Llamando a advance().');
    const next = manager.advance();
    console.log('[CampaignIntroScene] advance() devolvió:', next ?? null);

    if (!next) {
      console.error('[CampaignIntroScene] No hay siguiente nodo de campaña para avanzar desde CampaignIntroScene.');
      return;
    }

    console.log('[CampaignIntroScene] Llamando a transitionToNode() con nodo:', next);
    manager.transitionToNode(next);
  }
}
