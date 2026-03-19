import Phaser from 'phaser';
import { controlManager } from '../input/ControlManager';
import { FlowDebugOverlay } from './flowDebug';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';

interface CampaignIntroSceneData {
  flowNode?: CampaignFlowNode;
}

export class CampaignIntroScene extends Phaser.Scene {
  private enterKey?: Phaser.Input.Keyboard.Key;

  private hasStarted = false;

  private isTransitioning = false;

  private flowManager?: SceneFlowManager;

  private flowDebug?: FlowDebugOverlay;

  constructor() {
    super('CampaignIntroScene');
  }

  create(_data: CampaignIntroSceneData = {}): void {
    this.registry.set('activeCampaignNode', { id: 'campaign-intro', type: 'campaignIntro', sceneKey: 'CampaignIntroScene' });
    this.registry.set('flowNodeId', 'campaign-intro');

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 1);
    this.add.text(width / 2, height / 2 - 44, 'NO WAY DOWN', {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '34px'
    }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 + 6, 'Comienza la incursión en el subsuelo.', {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '18px'
    }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 + 56, 'ENTER o clic para comenzar', {
      color: '#93c5fd',
      fontFamily: 'monospace',
      fontSize: '20px'
    }).setOrigin(0.5);

    this.flowManager = new SceneFlowManager(this);
    this.flowDebug = new FlowDebugOverlay(this, this.flowManager, () => ({
      flowNode: this.registry.get('activeCampaignNode') as CampaignFlowNode | undefined,
      enterDown: this.enterKey?.isDown ?? false,
      hasStarted: this.hasStarted,
      isTransitioning: this.isTransitioning
    }));
    this.flowDebug.create();

    if (this.input.keyboard) {
      this.enterKey = this.input.keyboard.addKey(controlManager.getKeyCode('next_level'));
    } else {
      console.error('[CampaignIntroScene] Keyboard input no está disponible.');
    }

    this.input.on('pointerdown', () => {
      this.startCampaign('click');
    });
  }

  update(): void {
    this.flowDebug?.update();

    if (!this.enterKey || this.hasStarted) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.startCampaign('enter');
    }
  }

  private startCampaign(source: 'enter' | 'click'): void {
    if (this.hasStarted) {
      return;
    }

    this.hasStarted = true;
    const manager = this.flowManager ?? new SceneFlowManager(this);

    const currentNode = this.registry.get('activeCampaignNode') as CampaignFlowNode | undefined;
    const next = manager.advanceFromNodeId(currentNode?.id ?? 'campaign-intro');

    if (next?.id && !next.id.startsWith('lvl01-')) {
      console.error('[CampaignIntroScene] Desvío narrativo detectado: el nodo posterior al intro no es lvl01.', {
        nextNodeId: next.id
      });
      return;
    }

    if (!next) {
      console.error('[CampaignIntroScene] No hay siguiente nodo de campaña para avanzar desde CampaignIntroScene.');
      return;
    }

    this.isTransitioning = true;
    void source;
    manager.transitionToNode(next);
  }
}
