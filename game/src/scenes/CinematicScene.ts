import Phaser from 'phaser';
import { controlManager } from '../input/ControlManager';
import { FlowDebugOverlay } from './flowDebug';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';

interface CinematicBeat {
  beat: string;
}

interface CinematicSceneData {
  flowNode?: CampaignFlowNode;
}

export class CinematicScene extends Phaser.Scene {
  private enterKey?: Phaser.Input.Keyboard.Key;

  private hasStarted = false;

  private isTransitioning = false;

  private flowManager?: SceneFlowManager;

  private flowDebug?: FlowDebugOverlay;

  constructor() {
    super('CinematicScene');
  }

  create(data: CinematicSceneData = {}): void {
    if (data.flowNode) {
      this.registry.set('activeCampaignNode', data.flowNode);
      this.registry.set('flowNodeId', data.flowNode.id);
    }

    const cinematicPath = data.flowNode?.cinematicPath;
    console.info('[CinematicScene] create() con nodo canónico:', data.flowNode?.id ?? 'sin-flowNode');
    this.renderCinematic(cinematicPath);

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
      console.error('[CinematicScene] Keyboard input no está disponible.');
    }

    this.input.once('pointerdown', () => {
      console.log('[CinematicScene] Click detectado.');
      this.advanceToNextNode('click');
    });
  }

  private renderCinematic(cinematicPath?: string): void {
    const { width, height } = this.scale;
    const cacheKey = this.toFlowAssetCacheKey(cinematicPath);
    const renderFromCache = () => {
      const cinematic = (cacheKey ? this.cache.json.get(cacheKey) : undefined) as { beats: CinematicBeat[] } | undefined;
      const beats = cinematic?.beats ?? [];

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
    };

    if (!cinematicPath || !cacheKey) {
      console.warn('[CinematicScene] cinematicPath ausente; se renderiza fallback.');
      renderFromCache();
      return;
    }

    if (this.cache.json.exists(cacheKey)) {
      console.info('[CinematicScene] Cinemática obtenida desde cache:', cinematicPath);
      renderFromCache();
      return;
    }

    this.load.json(cacheKey, cinematicPath);
    this.load.once(`filecomplete-json-${cacheKey}`, renderFromCache);
    this.load.once('loaderror', () => {
      console.error('[CinematicScene] Error cargando cinemática. Se usa fallback.', { cinematicPath });
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
      console.log('[CinematicScene] ENTER detectado.');
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
      console.log('[CinematicScene] activeCampaignNode detectado en registry:', currentNode.id);
    }

    const currentNodeId = currentNode?.id ?? (this.registry.get('flowNodeId') as string | undefined);
    const next = manager.advanceFromNodeId(currentNodeId);
    console.log('[CinematicScene] Nodo siguiente obtenido:', next ?? null);

    if (!next) {
      console.error('[CinematicScene] Error: no existe nodo siguiente para avanzar desde CinematicScene.');
      return;
    }

    console.info('[CinematicScene] Avance de flujo validado.', {
      currentNodeId,
      nextNodeId: next.id
    });

    this.isTransitioning = true;
    console.log(`[CinematicScene] Transición ejecutada por ${source}.`);
    manager.transitionToNode(next);
  }
}
