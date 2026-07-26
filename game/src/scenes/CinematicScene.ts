import Phaser from 'phaser';
import { controlManager } from '../input/ControlManager';
import { FlowDebugOverlay } from './flowDebug';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';
import { addRetroScreenOverlay, applyRetroRenderer, RETRO_PIXEL_FONT } from './retroPixelArt';
import { getAudioManager } from '../audio/AudioManager';

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
    this.hasStarted = false;
    this.isTransitioning = false;
    const flowNode = data.flowNode ?? this.registry.get('activeCampaignNode') as CampaignFlowNode | undefined;
    if (!flowNode) {
      this.showDevelopmentError(undefined, 'No se recibió el nodo cinematográfico activo.');
      return;
    }

    this.flowManager = new SceneFlowManager(this);
    if (!this.flowManager.confirmPendingTransition(flowNode)) {
      this.showDevelopmentError(flowNode.cinematicPath, 'La transición pendiente no coincide con esta cinemática.');
      return;
    }

    applyRetroRenderer(this);
    const cinematicPath = flowNode.cinematicPath;
    this.renderCinematic(cinematicPath);

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
      this.advanceToNextNode('click');
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      getAudioManager(this).stopCinematicMusic();
      this.registry.set('dialogueState', null);
      this.registry.set('interactionHint', '');
      this.registry.set('transitionView', { visible: false, message: '', tone: 'normal' });
      this.input.keyboard?.removeKey(this.enterKey!);
    });
  }

  private renderCinematic(cinematicPath?: string): void {
    const { width, height } = this.scale;
    const cacheKey = this.toFlowAssetCacheKey(cinematicPath);
    const renderFromCache = () => {
      const cinematic = (cacheKey ? this.cache.json.get(cacheKey) : undefined) as { beats: CinematicBeat[] } | undefined;
      if (!cinematic?.beats) {
        this.showDevelopmentError(cinematicPath, 'El contenido de la cinemática es inválido.');
        return;
      }
      const beats = cinematic.beats;

      this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 1);
      this.add.rectangle(width / 2, 80, width - 96, 82, 0x100913, 0.92).setStrokeStyle(3, 0xf6d365, 1);
      this.add.text(width / 2, 64, 'CINEMÁTICA // PIXEL CUTSCENE', { color: '#f8fafc', fontFamily: RETRO_PIXEL_FONT, fontSize: '26px', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(width / 2, height / 2, beats.map((b) => `• ${b.beat}`).join('\n'), {
        color: '#cbd5e1',
        fontFamily: RETRO_PIXEL_FONT,
        fontSize: '18px',
        align: 'center',
        wordWrap: { width: width - 120 }
      }).setOrigin(0.5);
      this.add.text(width / 2, height - 36, 'ENTER o clic para continuar', { color: '#f6d365', fontFamily: RETRO_PIXEL_FONT, fontSize: '14px' }).setOrigin(0.5);
      addRetroScreenOverlay(this, 3);
    };

    if (!cinematicPath || !cacheKey) {
      this.showDevelopmentError(cinematicPath, 'El nodo canónico no define cinematicPath.');
      return;
    }

    if (this.cache.json.exists(cacheKey)) {
      renderFromCache();
      return;
    }

    const assetUrl = cinematicPath.startsWith('/') ? cinematicPath : `/${cinematicPath}`;
    this.load.json(cacheKey, assetUrl);
    this.load.once(`filecomplete-json-${cacheKey}`, renderFromCache);
    this.load.once('loaderror', () => {
      this.showDevelopmentError(cinematicPath, 'No se pudo cargar el asset canónico.');
    });
    this.load.start();
  }

  private showDevelopmentError(cinematicPath: string | undefined, reason: string): void {
    this.hasStarted = true;
    console.error('[CinematicScene] ERROR DE DESARROLLO', { cinematicPath, reason });
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x09070b, 1);
    this.add.text(width / 2, height / 2, [
      'ERROR EXPLÍCITO DE DESARROLLO', '', `Asset: ${cinematicPath ?? 'sin ruta'}`, reason,
      '', 'La campaña fue detenida; no existe fallback.'
    ].join('\n'), { color: '#f87171', fontFamily: 'monospace', fontSize: '18px', align: 'center' }).setOrigin(0.5);
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
      console.error('[CinematicScene] Error: no existe nodo siguiente para avanzar desde CinematicScene.');
      return;
    }

    console.info('[CinematicScene] Avance de flujo validado.', {
      currentNodeId,
      nextNodeId: next.id
    });

    this.isTransitioning = true;
    void source;
    manager.transitionToNode(next);
  }
}
