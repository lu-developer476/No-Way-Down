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

    this.input.on('pointerdown', () => {
      console.log('[CinematicScene] Click detectado.');
      this.advanceToNextNode('click');
    });
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

    const next = manager.advanceFromNodeId(currentNode?.id ?? this.registry.get('flowNodeId'));
    console.log('[CinematicScene] Nodo siguiente obtenido:', next ?? null);

    if (!next) {
      console.error('[CinematicScene] Error: no existe nodo siguiente para avanzar desde CinematicScene.');
      return;
    }

    this.isTransitioning = true;
    console.log(`[CinematicScene] Transición ejecutada por ${source}.`);
    manager.transitionToNode(next);
  }
}
