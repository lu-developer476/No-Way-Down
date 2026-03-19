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
    this.renderDialogue(dialoguePath);

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

    this.input.once('pointerdown', () => {
      this.advanceToNextNode('click');
    });
  }

  private renderDialogue(dialoguePath?: string): void {
    const { width, height } = this.scale;
    const cacheKey = this.toFlowAssetCacheKey(dialoguePath);
    const renderFromCache = () => {
      const dialogue = (cacheKey ? this.cache.json.get(cacheKey) : undefined) as { lines: DialogueLine[] } | undefined;
      const lines = dialogue?.lines ?? [];

      this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a, 1);
      this.add.text(width / 2, 58, 'Conversación', { color: '#e2e8f0', fontFamily: 'monospace', fontSize: '26px' }).setOrigin(0.5);

      const content = lines.map((line) => `${line.speaker}: ${line.text}`).join('\n\n') || 'Sin diálogo cargado';
      this.add.text(width / 2, height / 2, content, {
        color: '#cbd5e1',
        fontFamily: 'monospace',
        fontSize: '18px',
        align: 'center',
        wordWrap: { width: width - 120 }
      }).setOrigin(0.5);

      this.add.text(width / 2, height - 36, 'ENTER o clic para continuar', { color: '#93c5fd', fontFamily: 'monospace', fontSize: '14px' }).setOrigin(0.5);
    };

    if (!dialoguePath || !cacheKey) {
      console.warn('[DialogueScene] dialoguePath ausente; se renderiza fallback.');
      renderFromCache();
      return;
    }

    if (this.cache.json.exists(cacheKey)) {
      renderFromCache();
      return;
    }

    this.load.json(cacheKey, dialoguePath);
    this.load.once(`filecomplete-json-${cacheKey}`, renderFromCache);
    this.load.once('loaderror', () => {
      console.error('[DialogueScene] Error cargando diálogo. Se usa fallback.', { dialoguePath });
      renderFromCache();
    });
    this.load.start();
  }

  private toFlowAssetCacheKey(path?: string): string | undefined {
    if (!path) {
      return undefined;
    }

    return `campaign_asset::${path}`;
  }

  update(): void {
    this.flowDebug?.update();

    if (!this.enterKey || this.hasStarted) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
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
    const currentNodeId = currentNode?.id ?? (this.registry.get('flowNodeId') as string | undefined);
    const next = manager.advanceFromNodeId(currentNodeId);

    if (!next) {
      console.error('[DialogueScene] Error: no existe nodo siguiente para avanzar desde DialogueScene.');
      return;
    }

    console.info('[DialogueScene] Avance de flujo validado.', {
      currentNodeId,
      nextNodeId: next.id
    });

    this.isTransitioning = true;
    void source;
    manager.transitionToNode(next);
  }
}
