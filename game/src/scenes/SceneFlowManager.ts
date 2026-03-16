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

export class SceneFlowManager {
  constructor(private readonly scene: Phaser.Scene) {}

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
