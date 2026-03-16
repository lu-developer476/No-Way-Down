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

  constructor() {
    super('LevelScene');
  }

  create(data: LevelSceneCreateData = {}): void {
    if (!data.flowNode) {
      console.error('[LevelScene] No se recibió flowNode. No se puede resolver levelConfigPath.');
      return;
    }

    const { flowNode } = data;
    console.log(`[LevelScene] flowNode.id recibido: ${flowNode.id}`);

    if (!flowNode.levelConfigPath) {
      console.error(`[LevelScene] flowNode ${flowNode.id} no define levelConfigPath. Se aborta la creación del nivel.`);
      return;
    }

    console.log(`[LevelScene] levelConfigPath a cargar: ${flowNode.levelConfigPath}`);
    this.registry.set('activeCampaignNode', flowNode);
    this.registry.set('flowNodeId', flowNode.id);

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
      this.spawnSystem.instantiate(flowNode.systems?.spawn ?? []);
      this.combatSystem.instantiate(flowNode.systems?.combat ?? []);
      this.environmentSystem.instantiate(flowNode.systems?.environment ?? []);
      this.missionRuntimeSystem.instantiate(flowNode.systems?.mission ?? []);

      if (usedFallback) {
        console.warn(`[LevelScene] fallback activado para ${flowNode.id}.`);
      }

      this.input.keyboard?.once(controlManager.getPhaserEventName('next_level'), () => {
        const manager = new SceneFlowManager(this);
        const nextNode = manager.advanceFromNodeId(flowNode.id);
        if (nextNode) {
          manager.transitionToNode(nextNode);
        }
      });
    });
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
