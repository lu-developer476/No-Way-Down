import Phaser from 'phaser';
import { controlManager } from '../input/ControlManager';
import { FlowDebugOverlay } from './flowDebug';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';

interface DialogueLine {
  speaker: string;
  text: string;
}

interface DialogueSceneData {
  flowNode?: CampaignFlowNode;
}

export class DialogueScene extends Phaser.Scene {
  private enterKey?: Phaser.Input.Keyboard.Key;

  private hasStarted = false;

  private isTransitioning = false;

  private flowManager?: SceneFlowManager;

  private flowDebug?: FlowDebugOverlay;

  constructor() {
    super('DialogueScene');
  }

  create(data: DialogueSceneData = {}): void {
    if (data.flowNode) {
      this.registry.set('activeCampaignNode', data.flowNode);
      this.registry.set('flowNodeId', data.flowNode.id);
    }

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
      console.error('[DialogueScene] Keyboard input no está disponible.');
    }

    this.input.on('pointerdown', () => {
      console.log('[DialogueScene] Click detectado.');
      this.advanceToNextNode('click');
    });
  }

  update(): void {
    this.flowDebug?.update();

    if (!this.enterKey || this.hasStarted) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      console.log('[DialogueScene] ENTER detectado.');
      this.advanceToNextNode('enter');
    }
  }

  private advanceToNextNode(source: 'enter' | 'click'): void {
    if (this.hasStarted) {
      return;
    }

    this.hasStarted = true;
    const manager = this.flowManager ?? new SceneFlowManager(this);

    const currentNode = this.registry.get('activeCampaignNode') as CampaignFlowNode | undefined;
    if (currentNode) {
      console.log('[DialogueScene] activeCampaignNode detectado en registry:', currentNode.id);
    }

    const next = manager.advanceFromNodeId(currentNode?.id ?? this.registry.get('flowNodeId'));
    console.log('[DialogueScene] Nodo siguiente obtenido:', next ?? null);

    if (!next) {
      console.error('[DialogueScene] Error: no existe nodo siguiente para avanzar desde DialogueScene.');
      return;
    }

    this.isTransitioning = true;
    console.log(`[DialogueScene] Transición ejecutada por ${source}.`);
    manager.transitionToNode(next);
  }
}
