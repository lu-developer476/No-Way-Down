import Phaser from 'phaser';
import { GameScene } from './GameScene';
import {
  CampaignFlowNode,
  SceneFlowManager,
  type PendingCampaignTransition
} from './SceneFlowManager';
import { CampaignSystem } from '../systems/CampaignSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { MissionRuntimeSystem } from '../systems/MissionRuntimeSystem';
import { controlManager } from '../input/ControlManager';
import { Checkpoint } from './sceneShared';
import { LevelExitTarget } from '../systems/LevelExitSystem';
import { FlowDebugOverlay } from './flowDebug';

type LevelSceneCreateData = {
  flowNode?: CampaignFlowNode;
  skipLoad?: boolean;
  respawnPoint?: Checkpoint;
};

export class LevelScene extends GameScene {
  private campaignSystem?: CampaignSystem;
  private spawnSystem?: SpawnSystem;
  private combatSystem?: CombatSystem;
  private environmentSystem?: EnvironmentSystem;
  private missionRuntimeSystem?: MissionRuntimeSystem;
  private flowManager?: SceneFlowManager;
  private flowDebug?: FlowDebugOverlay;
  private enterKey?: Phaser.Input.Keyboard.Key;
  private hasStarted = false;
  private isTransitioning = false;
  private gameplayReady = false;
  private flowNode?: CampaignFlowNode;

  constructor() {
    super('LevelScene');
  }

  create(data: LevelSceneCreateData = {}): void {
    this.hasStarted = false;
    this.isTransitioning = false;
    this.gameplayReady = false;
    this.registry.set(
      'transitionView',
      {
        visible: false,
        message: '',
        tone: 'normal'
      }
    );

    const pendingTransition = this.registry.get(
      'pendingCampaignTransition'
    ) as PendingCampaignTransition | undefined;
    let flowNodeSource: 'scene-data' | 'pending-transition' | 'active-registry' | 'missing';
    let flowNode: CampaignFlowNode | undefined;

    if (data.flowNode) {
      flowNode = data.flowNode;
      flowNodeSource = 'scene-data';
    } else if (pendingTransition?.toNode) {
      flowNode = pendingTransition.toNode;
      flowNodeSource = 'pending-transition';
    } else {
      flowNode = this.registry.get('activeCampaignNode') as CampaignFlowNode | undefined;
      flowNodeSource = flowNode ? 'active-registry' : 'missing';
    }

    if (!flowNode) {
      this.showCampaignLoadError(undefined, 'No se recibió un nodo de campaña.');
      return;
    }

    if (pendingTransition && pendingTransition.toNode.id !== flowNode.id) {
      this.showCampaignLoadError(
        flowNode,
        `Nodo esperado:\n${pendingTransition.toNode.id}\n\nNodo recibido:\n${flowNode.id}`
      );
      return;
    }

    console.info('[LevelScene] nodo seleccionado', {
      source: flowNodeSource,
      nodeId: flowNode.id,
      levelConfigPath: flowNode.levelConfigPath ?? null,
      pendingNodeId: pendingTransition?.toNode.id ?? null
    });

    this.flowNode = flowNode;

    if (!flowNode.levelConfigPath) {
      this.showCampaignLoadError(flowNode, 'El nodo no define levelConfigPath.');
      return;
    }

    this.registry.set('activeCampaignNode', flowNode);
    this.registry.set('flowNodeId', flowNode.id);

    this.flowManager = new SceneFlowManager(this);
    this.flowDebug = new FlowDebugOverlay(this, this.flowManager, () => ({
      flowNode: this.flowNode,
      enterDown: this.enterKey?.isDown ?? false,
      hasStarted: this.hasStarted,
      isTransitioning: this.isTransitioning
    }));
    this.flowDebug.create();

    if (this.input.keyboard) {
      this.enterKey = this.input.keyboard.addKey(controlManager.getKeyCode('next_level'));
    }

    this.ensureCampaignLevelConfigLoaded(flowNode, (campaignLevelConfig) => {
      const config = campaignLevelConfig as Record<string, unknown>;
      const runtimeLevelId = config.runtimeLevelId as string;
      this.registry.set('activeCampaignLevelConfigPath', flowNode.levelConfigPath);
      this.registry.set('activeRuntimeLevelId', runtimeLevelId);
      this.registry.remove('campaignLoadError');
      this.registry.remove('pendingCampaignTransition');
      this.registry.remove('pendingCampaignNodeId');
      console.info('[LevelScene] configuración confirmada', {
        nodeId: flowNode.id,
        levelConfigPath: flowNode.levelConfigPath,
        runtimeLevelId
      });

      const shouldResumeProgress = this.registry.get('resumeProgressOnNextLevel') === true;
      this.registry.remove('resumeProgressOnNextLevel');

      super.create({
        skipLoad: !shouldResumeProgress,
        respawnPoint: data.respawnPoint,
        flowNodeId: flowNode.id,
        campaignLevelConfigPath: flowNode.levelConfigPath,
        campaignLevelConfig
      });

      this.campaignSystem = new CampaignSystem(this);
      this.spawnSystem = new SpawnSystem(this);
      this.combatSystem = new CombatSystem(this);
      this.environmentSystem = new EnvironmentSystem(this);
      this.missionRuntimeSystem = new MissionRuntimeSystem(this);

      this.campaignSystem.configureFlowNode(flowNode);
      this.campaignSystem.instantiate(flowNode.systems?.campaign ?? []);
      this.spawnSystem.instantiate(flowNode.systems?.spawn ?? []);
      this.combatSystem.instantiate(flowNode.systems?.combat ?? []);
      this.environmentSystem.instantiate(flowNode.systems?.environment ?? []);
      this.missionRuntimeSystem.instantiate(flowNode.systems?.mission ?? []);

      this.gameplayReady = true;
    });
  }

  update(): void {
    if (!this.gameplayReady) {
      return;
    }

    if (
      this.enterKey
      && Phaser.Input.Keyboard.JustDown(
        this.enterKey
      )
      && this.hasPendingExitTransition()
    ) {
      this.confirmPendingExitTransition(
        'manual'
      );

      this.flowDebug?.update();
      return;
    }

    super.update();
    this.flowDebug?.update();
  }

  protected completeExitTransition(
    target: LevelExitTarget
  ): void {
    const flowNode = this.flowNode;

    if (!flowNode) {
      throw new Error(
        'LevelScene no tiene un flowNode activo para completar la transición.'
      );
    }

    this.transitionToNextFlowNode(
      flowNode,
      target
    );
  }

  private transitionToNextFlowNode(flowNode: CampaignFlowNode, target: LevelExitTarget): void {
    if (this.hasStarted || this.isTransitioning) {
      return;
    }

    this.hasStarted = true;
    this.isTransitioning = true;
    this.registry.set('checkpoint', target.spawnPoint);
    const manager = this.flowManager ?? new SceneFlowManager(this);
    const nextNode = manager.advanceFromNodeId(flowNode.id);
    if (!nextNode) {
      this.hasStarted = false;
      this.isTransitioning = false;
      this.showCampaignLoadError(
        flowNode,
        `No se pudo resolver el nodo posterior a ${flowNode.id}.`
      );
      return;
    }

    const transitionAccepted =
      manager.transitionToNode(
        nextNode,
        {
          respawnPoint:
            target.spawnPoint
        }
      );

    if (!transitionAccepted) {
      this.hasStarted = false;
      this.isTransitioning = false;

      throw new Error(
        `SceneFlowManager rechazó la transición hacia ${nextNode.id}.`
      );
    }
  }

  private ensureCampaignLevelConfigLoaded(
    flowNode: CampaignFlowNode,
    onReady: (campaignLevelConfig: unknown) => void
  ): void {
    const configPath = flowNode.levelConfigPath;
    if (!configPath) {
      this.showCampaignLoadError(flowNode, 'El nodo no tiene levelConfigPath.');
      return;
    }

    const cacheKey = this.getCampaignLevelCacheKey(configPath);

    if (this.cache.json.exists(cacheKey)) {
      const config = this.cache.json.get(cacheKey);
      if (!this.validateCampaignLevelConfig(flowNode, config)) {
        this.showCampaignLoadError(flowNode, 'La configuración cacheada es inválida.');
        return;
      }
      onReady(config);
      return;
    }

    const assetUrl = configPath.startsWith('/') ? configPath : `/${configPath}`;
    const completeEvent = 'filecomplete-json-' + cacheKey;
    const onComplete = () => {
      this.load.off('loaderror', onError);
      const config = this.cache.json.get(cacheKey);
      if (!this.validateCampaignLevelConfig(flowNode, config)) {
        this.showCampaignLoadError(flowNode, 'La configuración cargada es inválida.');
        return;
      }
      onReady(config);
    };
    const onError = (file: Phaser.Loader.File) => {
      if (file.key !== cacheKey) {
        return;
      }
      this.load.off(completeEvent, onComplete);
      this.load.off('loaderror', onError);
      this.showCampaignLoadError(flowNode, `No se pudo cargar ${configPath}.`);
    };

    this.load.once(completeEvent, onComplete);
    this.load.on('loaderror', onError);
    this.load.json(cacheKey, assetUrl);

    this.load.start();
  }

  private validateCampaignLevelConfig(
    flowNode: CampaignFlowNode,
    value: unknown
  ): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    if (flowNode.type !== 'level') {
      return true;
    }
    const runtimeLevelId = (value as Record<string, unknown>).runtimeLevelId;
    if (typeof runtimeLevelId !== 'string' || runtimeLevelId.trim() === '') {
      return false;
    }
    const requiredRuntimeIds: Record<string, string> = {
      'lvl01-esc01-subsuelo-inicial': 'level_1_subsuelo_comedor',
      'lvl02-esc01-hall-planta-baja': 'level_2_escaleras_espiral'
    };
    return !requiredRuntimeIds[flowNode.id] || runtimeLevelId === requiredRuntimeIds[flowNode.id];
  }

  private showCampaignLoadError(flowNode: CampaignFlowNode | undefined, reason: string): void {
    this.gameplayReady = false;
    this.isTransitioning = false;
    this.registry.remove('activeRuntimeLevelId');
    this.registry.set('campaignLoadError', {
      nodeId: flowNode?.id ?? null,
      levelConfigPath: flowNode?.levelConfigPath ?? null,
      reason
    });
    this.registry.set('transitionView', {
      visible: true,
      tone: 'danger',
      message: [
        'No se pudo cargar el siguiente tramo de campaña.', '',
        `Nodo: ${flowNode?.id ?? 'desconocido'}`,
        `Config: ${flowNode?.levelConfigPath ?? 'sin ruta'}`, '', reason
      ].join('\n')
    });
    console.error('[LevelScene] ERROR DE CAMPAÑA', {
      nodeId: flowNode?.id ?? null,
      levelConfigPath: flowNode?.levelConfigPath ?? null,
      reason
    });

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.92).setDepth(10000);
    this.add.rectangle(width / 2, height / 2, Math.min(width - 48, 720), 390, 0x180b0b, 1)
      .setStrokeStyle(2, 0xf87171).setDepth(10001);
    this.add.text(width / 2, height / 2, [
      'ERROR DE CAMPAÑA', '',
      `Nodo: ${flowNode?.id ?? 'desconocido'}`,
      `Config: ${flowNode?.levelConfigPath ?? 'sin ruta'}`, '',
      reason, '',
      'La campaña fue detenida para evitar volver al nivel anterior.'
    ].join('\n'), {
      fontSize: '18px', color: '#f87171', align: 'center',
      fontFamily: 'monospace', wordWrap: { width: Math.min(width - 96, 660) }
    }).setOrigin(0.5).setDepth(10002);
  }

  private getCampaignLevelCacheKey(levelConfigPath: string): string {
    return `campaign_level::${levelConfigPath}`;
  }
}
