import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';
import { CampaignSystem } from '../systems/CampaignSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { MissionRuntimeSystem } from '../systems/MissionRuntimeSystem';
import { controlManager } from '../input/ControlManager';
import { Checkpoint } from './sceneShared';
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
  private flowNode?: CampaignFlowNode;

  constructor() {
    super('LevelScene');
  }

  create(data: LevelSceneCreateData = {}): void {
    if (!data.flowNode) {
      console.error('[LevelScene] No se recibió flowNode. No se puede resolver levelConfigPath.');
      return;
    }

    const { flowNode } = data;
    this.flowNode = flowNode;
    console.log(`[LevelScene] flowNode.id recibido: ${flowNode.id}`);

    if (!flowNode.levelConfigPath) {
      console.error(`[LevelScene] flowNode ${flowNode.id} no define levelConfigPath. Se aborta la creación del nivel.`);
      return;
    }

    console.log(`[LevelScene] levelConfigPath a cargar: ${flowNode.levelConfigPath}`);
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

    this.ensureCampaignLevelConfigLoaded(flowNode, (campaignLevelConfig, usedFallback) => {
      super.create({
        skipLoad: true,
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

      if (usedFallback) {
        console.warn(`[LevelScene] fallback activado para ${flowNode.id}.`);
      }

      this.input.keyboard?.once(controlManager.getPhaserEventName('next_level'), () => {
        console.info('[LevelScene] Evento de avance manual recibido (next_level).', {
          currentNodeId: flowNode.id
        });
        if (this.hasStarted) {
          return;
        }

        this.hasStarted = true;
        const manager = this.flowManager ?? new SceneFlowManager(this);
        const nextNode = manager.advanceFromNodeId(flowNode.id);
        console.info('[LevelScene] Resultado de advanceFromNodeId().', {
          currentNodeId: flowNode.id,
          nextNodeId: nextNode?.id
        });
        if (!nextNode) {
          return;
        }

        this.isTransitioning = true;
        manager.transitionToNode(nextNode);
      });
    });
  }

  update(): void {
    super.update();
    this.flowDebug?.update();
  }

  private ensureCampaignLevelConfigLoaded(
    flowNode: CampaignFlowNode,
    onReady: (campaignLevelConfig: unknown, usedFallback: boolean) => void
  ): void {
    const configPath = flowNode.levelConfigPath;
    if (!configPath) {
      console.error(`[LevelScene] flowNode ${flowNode.id} no tiene levelConfigPath.`);
      return;
    }

    const cacheKey = this.getCampaignLevelCacheKey(configPath);

    if (this.cache.json.exists(cacheKey)) {
      const config = this.cache.json.get(cacheKey);
      console.log(`[LevelScene] carga exitosa desde cache para ${configPath}.`);
      onReady(config, false);
      return;
    }

    this.load.json(cacheKey, configPath);

    this.load.once('filecomplete-json-' + cacheKey, () => {
      const config = this.cache.json.get(cacheKey);
      console.log(`[LevelScene] carga exitosa de ${configPath}.`);
      onReady(config, false);
    });

    this.load.once('loaderror', (file: Phaser.Loader.File) => {
      if (file.key !== cacheKey) {
        return;
      }

      console.error(`[LevelScene] Error cargando ${configPath} para flowNode ${flowNode.id}. Se usará fallback.`);
      onReady({}, true);
    });

    this.load.start();
  }

  private getCampaignLevelCacheKey(levelConfigPath: string): string {
    return `campaign_level::${levelConfigPath}`;
  }
}
