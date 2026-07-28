import Phaser from 'phaser';
import { SceneFlowManager, type CampaignFlowNode } from './SceneFlowManager';

export type CampaignTransitionReason = 'interactable' | 'level-exit' | 'manual' | string;

export interface CampaignTransitionFailure {
  stage: string;
  fromNodeId: string;
  toNodeId: string | null;
  error: string;
  snapshot: Record<string, unknown>;
}

const WATCHDOG_MS = 5_000;
const WATCHDOG_KEY = '__nwdCampaignTransitionWatchdog';

/**
 * The sole campaign-level exit coordinator.  It deliberately does not use a
 * Phaser TimerEvent: a scene restart/shutdown must not be able to cancel the
 * campaign commit or its watchdog.
 */
export class CampaignTransitionCoordinator {
  constructor(private readonly scene: Phaser.Scene) {}

  requestCanonicalTransition(
    currentNodeId: string,
    reason: CampaignTransitionReason,
    spawnPoint?: { x: number; y: number }
  ): boolean {
    const manager = new SceneFlowManager(this.scene);
    const nextNode = manager.advanceFromNodeId(currentNodeId);
    this.trace('resolve-next:after', currentNodeId, nextNode, { reason });
    if (!nextNode) return this.fail('resolve-next', currentNodeId, null, new Error('No existe un nodo canónico siguiente.'));

    const existing = this.scene.registry.get('pendingCampaignTransition');
    if (existing) {
      console.warn('[CampaignTransitionCoordinator] duplicate request rejected', this.snapshot());
      return false;
    }

    this.trace('commit:before', currentNodeId, nextNode, { reason, spawnPoint });
    this.scene.registry.set('campaignTransitionReason', reason);
    if (spawnPoint) this.scene.registry.set('checkpoint', spawnPoint);

    let accepted = false;
    try {
      accepted = manager.transitionToNode(nextNode, { respawnPoint: spawnPoint });
    } catch (error) {
      return this.fail('scene-change', currentNodeId, nextNode.id, error);
    }
    this.trace('commit:after', currentNodeId, nextNode, { transitionToNodeResult: accepted });
    if (!accepted) return this.fail('transition-to-node', currentNodeId, nextNode.id, new Error('transitionToNode devolvió false.'));

    const oldWatchdog = this.scene.registry.get(WATCHDOG_KEY) as number | undefined;
    if (oldWatchdog !== undefined) window.clearTimeout(oldWatchdog);
    const watchdog = window.setTimeout(() => {
      if (!this.scene.registry.get('pendingCampaignTransition')) return;
      this.fail('destination-confirmation-watchdog', currentNodeId, nextNode.id, new Error(`La escena destino no confirmó la transición en ${WATCHDOG_MS} ms.`));
    }, WATCHDOG_MS);
    this.scene.registry.set(WATCHDOG_KEY, watchdog);
    return true;
  }

  confirmDestination(node: CampaignFlowNode): boolean {
    const manager = new SceneFlowManager(this.scene);
    this.trace('destination-confirm:before', this.pendingFromNodeId() ?? node.id, node);
    if (!manager.confirmPendingTransition(node)) {
      return this.fail('destination-confirmation', this.pendingFromNodeId() ?? 'unknown', node.id, new Error('El pending no coincide con la escena destino.'));
    }
    const watchdog = this.scene.registry.get(WATCHDOG_KEY) as number | undefined;
    if (watchdog !== undefined) window.clearTimeout(watchdog);
    this.scene.registry.remove(WATCHDOG_KEY);
    this.scene.registry.remove('campaignTransitionReason');
    this.scene.registry.set('transitionView', { visible: false, message: '', tone: 'normal' });
    this.trace('destination-confirm:after', node.id, node);
    return true;
  }

  private pendingFromNodeId(): string | null {
    return (this.scene.registry.get('pendingCampaignTransition') as { fromNodeId?: string | null } | undefined)?.fromNodeId ?? null;
  }

  private fail(stage: string, fromNodeId: string, toNodeId: string | null, original: unknown): false {
    const error = original instanceof Error ? `${original.name}: ${original.message}` : String(original);
    const failure: CampaignTransitionFailure = { stage, fromNodeId, toNodeId, error, snapshot: this.snapshot() };
    console.error('[CampaignTransitionCoordinator] FATAL', failure, original);
    this.scene.registry.set('campaignTransitionFatal', failure);
    this.scene.registry.remove('pendingCampaignTransition');
    this.scene.registry.remove('pendingCampaignNodeId');
    this.scene.registry.set('transitionView', { visible: false, message: '', tone: 'normal' });
    this.showFatal(failure);
    return false;
  }

  private showFatal(failure: CampaignTransitionFailure): void {
    const { width, height } = this.scene.scale;
    this.scene.add.rectangle(width / 2, height / 2, width, height, 0x09070b, .98).setDepth(20000);
    this.scene.add.text(width / 2, height / 2, [
      'ERROR FATAL DE TRANSICIÓN', `Etapa: ${failure.stage}`,
      `Origen: ${failure.fromNodeId}`, `Destino: ${failure.toNodeId ?? 'sin resolver'}`,
      `Error: ${failure.error}`, '', JSON.stringify(failure.snapshot, null, 2)
    ].join('\n'), { color: '#f87171', fontFamily: 'monospace', fontSize: '14px', align: 'left', wordWrap: { width: Math.min(width - 60, 920) } }).setOrigin(.5).setDepth(20001);
  }

  private trace(stage: string, fromNodeId: string, toNode?: CampaignFlowNode, extra: Record<string, unknown> = {}): void {
    console.info('[CampaignTransitionCoordinator]', stage, { fromNodeId, toNodeId: toNode?.id ?? null, ...extra, ...this.snapshot() });
  }

  private snapshot(): Record<string, unknown> {
    const level = this.scene.scene.manager.getScene('LevelScene') as Phaser.Scene | undefined;
    const systems = level?.sys;
    const world = (level as Phaser.Scene & { physics?: Phaser.Physics.Arcade.ArcadePhysics })?.physics?.world;
    return {
      sceneKey: this.scene.scene.key,
      flowNodeId: this.scene.registry.get('flowNodeId') ?? null,
      campaignFlowCursor: this.scene.registry.get('campaignFlowCursor') ?? null,
      activeCampaignNode: this.scene.registry.get('activeCampaignNode') ?? null,
      pendingCampaignTransition: this.scene.registry.get('pendingCampaignTransition') ?? null,
      pendingCampaignNodeId: this.scene.registry.get('pendingCampaignNodeId') ?? null,
      levelScene: { active: systems?.isActive() ?? false, paused: systems?.isPaused() ?? false, sleeping: systems?.isSleeping() ?? false },
      physicsWorldIsPaused: world?.isPaused ?? null,
      transitionView: this.scene.registry.get('transitionView') ?? null
    };
  }
}
