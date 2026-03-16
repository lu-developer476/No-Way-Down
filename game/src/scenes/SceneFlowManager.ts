import Phaser from 'phaser';

export type CampaignFlowNodeType = 'campaignIntro' | 'level' | 'cinematic' | 'dialogue';

export interface CampaignFlowNode {
  id: string;
  type: CampaignFlowNodeType;
  sceneKey: 'CampaignIntroScene' | 'LevelScene' | 'CinematicScene' | 'DialogueScene';
  levelConfigPath?: string;
  cinematicPath?: string;
  dialoguePath?: string;
  systems?: {
    campaign?: string[];
    spawn?: string[];
    combat?: string[];
    mission?: string[];
    environment?: string[];
  };
}

export interface CampaignFlowDefinition {
  flowId: string;
  nodes: CampaignFlowNode[];
}

const FLOW_REGISTRY_KEY = 'campaignFlowDefinition';
const FLOW_CURSOR_KEY = 'campaignFlowCursor';
const CAMPAIGN_FLOW_CACHE_KEY = 'campaign_flow';

const VALID_SCENE_KEYS: CampaignFlowNode['sceneKey'][] = [
  'CampaignIntroScene',
  'LevelScene',
  'CinematicScene',
  'DialogueScene'
];

export class SceneFlowManager {
  constructor(private readonly scene: Phaser.Scene) {}

  validateCampaignFlow(): boolean {
    if (!this.scene.cache.json.exists(CAMPAIGN_FLOW_CACHE_KEY)) {
      console.error('campaign_flow.json no existe en cache');
      return false;
    }

    const definition = this.scene.cache.json.get(CAMPAIGN_FLOW_CACHE_KEY) as CampaignFlowDefinition;

    if (!definition || !Array.isArray(definition.nodes) || definition.nodes.length === 0) {
      console.error('campaign_flow.json no contiene nodos válidos');
      return false;
    }

    const availableScenes = this.scene.scene.manager.keys as Record<string, Phaser.Scene | undefined>;

    for (const node of definition.nodes) {
      if (!VALID_SCENE_KEYS.includes(node.sceneKey)) {
        console.error(`Nodo ${node.id} tiene sceneKey inválido: ${node.sceneKey}`);
        return false;
      }

      if (!availableScenes[node.sceneKey]) {
        console.error(`La escena ${node.sceneKey} no existe en Phaser`);
        return false;
      }
    }

    return true;
  }

  loadDefinition(definition: CampaignFlowDefinition): void {
    this.scene.registry.set(FLOW_REGISTRY_KEY, definition);
    this.scene.registry.set(FLOW_CURSOR_KEY, 0);
  }

  getCurrentNode(): CampaignFlowNode | undefined {
    const definition = this.getDefinition();
    const cursor = this.getCursor();
    return definition?.nodes[cursor];
  }

  advance(): CampaignFlowNode | undefined {
    const definition = this.getDefinition();
    if (!definition) {
      return undefined;
    }

    const nextCursor = this.getCursor() + 1;
    if (nextCursor >= definition.nodes.length) {
      return undefined;
    }

    this.scene.registry.set(FLOW_CURSOR_KEY, nextCursor);
    return definition.nodes[nextCursor];
  }

  startFromBeginning(): CampaignFlowNode | undefined {
    const definition = this.getDefinition();
    if (!definition || definition.nodes.length === 0) {
      return undefined;
    }

    this.scene.registry.set(FLOW_CURSOR_KEY, 0);
    return definition.nodes[0];
  }

  transitionToNode(node: CampaignFlowNode): void {
    this.scene.scene.start(node.sceneKey, { flowNode: node });
  }

  private getDefinition(): CampaignFlowDefinition | undefined {
    return this.scene.registry.get(FLOW_REGISTRY_KEY) as CampaignFlowDefinition | undefined;
  }

  private getCursor(): number {
    return (this.scene.registry.get(FLOW_CURSOR_KEY) as number | undefined) ?? 0;
  }
}
