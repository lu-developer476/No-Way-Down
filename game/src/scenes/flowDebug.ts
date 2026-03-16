import Phaser from 'phaser';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';

export const FLOW_DEBUG = true;

interface FlowDebugState {
  flowNode?: CampaignFlowNode;
  enterDown: boolean;
  hasStarted: boolean;
  isTransitioning: boolean;
}

export class FlowDebugOverlay {
  private text?: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly flowManager: SceneFlowManager,
    private readonly getState: () => FlowDebugState
  ) {}

  create(): void {
    if (!FLOW_DEBUG) {
      return;
    }

    this.text = this.scene.add.text(8, 8, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#a7f3d0',
      backgroundColor: 'rgba(2, 6, 23, 0.55)',
      padding: { x: 6, y: 4 }
    });
    this.text.setDepth(10000);
    this.text.setScrollFactor(0);
  }

  update(): void {
    if (!FLOW_DEBUG || !this.text) {
      return;
    }

    const state = this.getState();
    const flowNodeId = state.flowNode?.id ?? '-';
    const cursor = this.flowManager.getCursor();
    const nextNode = this.flowManager.peekNextFromNodeId(state.flowNode?.id)?.id ?? '-';

    this.text.setText([
      `scene: ${this.scene.scene.key}`,
      `flowNode.id: ${flowNodeId}`,
      `cursor: ${cursor}`,
      `next: ${nextNode}`,
      `ENTER: ${state.enterDown ? 'down' : 'up'}`,
      `hasStarted: ${state.hasStarted ? 'true' : 'false'}`,
      `isTransitioning: ${state.isTransitioning ? 'true' : 'false'}`
    ]);
  }
}
