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


const CANONICAL_SCENE_BY_TYPE: Record<CampaignFlowNodeType, CampaignFlowNode['sceneKey']> = {
  campaignIntro: 'CampaignIntroScene',
  level: 'LevelScene',
  cinematic: 'CinematicScene',
  dialogue: 'DialogueScene'
};


export class SceneFlowManager {
  constructor(private readonly scene: Phaser.Scene) {}

  ensureDefinitionLoadedFromCache(): CampaignFlowDefinition | undefined {
    const existing = this.getDefinition();
    if (existing) {
      console.info('[SceneFlowManager] Definición de campaña reutilizada desde registry.');
      return existing;
    }

    if (!this.scene.cache.json.exists(CAMPAIGN_FLOW_CACHE_KEY)) {
      return undefined;
    }

    const cached = this.scene.cache.json.get(CAMPAIGN_FLOW_CACHE_KEY) as CampaignFlowDefinition | undefined;
    if (!this.isValidDefinition(cached, { checkSceneAvailability: false, source: 'cache' })) {
      return undefined;
    }

    console.info('[SceneFlowManager] Definición de campaña recuperada de cache JSON.');
    this.loadDefinition(cached);
    return cached;
  }

  validateCampaignFlow(): boolean {
    if (!this.scene.cache.json.exists(CAMPAIGN_FLOW_CACHE_KEY)) {
      console.error('[SceneFlowManager] campaign_flow.json no existe en cache');
      return false;
    }

    const definition = this.scene.cache.json.get(CAMPAIGN_FLOW_CACHE_KEY) as CampaignFlowDefinition;
    return this.isValidDefinition(definition, { checkSceneAvailability: true, source: 'campaign_flow.json' });
  }

  loadDefinition(definition: CampaignFlowDefinition): void {
    if (!this.isValidDefinition(definition, { checkSceneAvailability: false, source: 'loadDefinition' })) {
      console.error('[SceneFlowManager] No se cargó la definición por ser vacía o inválida.');
      return;
    }

    this.scene.registry.set(FLOW_REGISTRY_KEY, definition);
    this.scene.registry.set(FLOW_CURSOR_KEY, 0);
    console.info('[SceneFlowManager] Definición de campaña cargada y cursor reiniciado.', {
      flowId: definition.flowId,
      totalNodes: definition.nodes.length
    });
  }

  getCurrentNode(): CampaignFlowNode | undefined {
    const definition = this.ensureDefinitionLoadedFromCache();
    const cursor = this.getCursor();
    return definition?.nodes[cursor];
  }

  advance(): CampaignFlowNode | undefined {
    const definition = this.ensureDefinitionLoadedFromCache();
    if (!definition) {
      console.error('[SceneFlowManager] No se pudo avanzar: no hay definición de flujo cargada.');
      return undefined;
    }

    const currentCursor = this.getCursor();
    const nextCursor = currentCursor + 1;
    const currentNode = definition.nodes[currentCursor];
    const nextNode = definition.nodes[nextCursor];

    console.info('[SceneFlowManager] advance()', {
      currentCursor,
      nextCursor,
      currentNode,
      nextNode
    });

    if (!nextNode) {
      console.error('[SceneFlowManager] No hay siguiente nodo para advance().', {
        currentCursor,
        nextCursor,
        currentNode,
        totalNodes: definition.nodes.length,
        flowId: definition.flowId
      });
      return undefined;
    }

    this.scene.registry.set(FLOW_CURSOR_KEY, nextCursor);
    return nextNode;
  }

  advanceFromNodeId(nodeId?: string): CampaignFlowNode | undefined {
    const definition = this.ensureDefinitionLoadedFromCache();
    if (!definition) {
      console.error('[SceneFlowManager] No se pudo avanzar desde nodeId: no hay definición de flujo cargada.');
      return undefined;
    }

    if (!nodeId) {
      return this.advance();
    }

    const currentIndex = definition.nodes.findIndex((node) => node.id === nodeId);
    if (currentIndex < 0) {
      console.warn(`[SceneFlowManager] nodeId no encontrado en flow: ${nodeId}. Se usará cursor actual.`);
      return this.advance();
    }

    const nextCursor = currentIndex + 1;
    const currentNode = definition.nodes[currentIndex];
    const nextNode = definition.nodes[nextCursor];

    console.info('[SceneFlowManager] advanceFromNodeId()', {
      currentCursor: currentIndex,
      nextCursor,
      currentNode,
      nextNode
    });

    if (!nextNode) {
      console.error('[SceneFlowManager] No hay siguiente nodo para advanceFromNodeId().', {
        requestedNodeId: nodeId,
        currentCursor: currentIndex,
        nextCursor,
        currentNode,
        totalNodes: definition.nodes.length,
        flowId: definition.flowId
      });
      return undefined;
    }

    this.scene.registry.set(FLOW_CURSOR_KEY, nextCursor);
    return nextNode;
  }

  peekNextFromNodeId(nodeId?: string): CampaignFlowNode | undefined {
    const definition = this.ensureDefinitionLoadedFromCache();
    if (!definition) {
      return undefined;
    }

    if (!nodeId) {
      return definition.nodes[this.getCursor() + 1];
    }

    const currentIndex = definition.nodes.findIndex((node) => node.id === nodeId);
    if (currentIndex < 0) {
      return definition.nodes[this.getCursor() + 1];
    }

    return definition.nodes[currentIndex + 1];
  }

  getCursor(): number {
    return this.readCursor();
  }

  startFromBeginning(): CampaignFlowNode | undefined {
    const definition = this.ensureDefinitionLoadedFromCache();
    if (!definition || definition.nodes.length === 0) {
      return undefined;
    }

    this.scene.registry.set(FLOW_CURSOR_KEY, 0);
    return definition.nodes[0];
  }

  transitionToNode(node: CampaignFlowNode): void {
    if (!node || typeof node !== 'object') {
      console.error('[SceneFlowManager] transitionToNode() recibió un nodo inválido.', { node });
      return;
    }

    if (!VALID_SCENE_KEYS.includes(node.sceneKey)) {
      console.error('[SceneFlowManager] transitionToNode() recibió sceneKey inválido.', {
        nodeId: node.id,
        sceneKey: node.sceneKey
      });
      return;
    }

    const availableScenes = this.scene.scene.manager.keys as Record<string, Phaser.Scene | undefined>;
    if (!availableScenes[node.sceneKey]) {
      console.error('[SceneFlowManager] transitionToNode() no puede iniciar una escena inexistente.', {
        nodeId: node.id,
        sceneKey: node.sceneKey
      });
      return;
    }

    this.scene.scene.start(node.sceneKey, { flowNode: node });
  }

  private getDefinition(): CampaignFlowDefinition | undefined {
    return this.scene.registry.get(FLOW_REGISTRY_KEY) as CampaignFlowDefinition | undefined;
  }

  private readCursor(): number {
    return (this.scene.registry.get(FLOW_CURSOR_KEY) as number | undefined) ?? 0;
  }

  private isValidDefinition(
    definition: CampaignFlowDefinition | undefined,
    options: { checkSceneAvailability: boolean; source: string }
  ): definition is CampaignFlowDefinition {
    if (!definition) {
      console.error(`[SceneFlowManager] Definición inválida (${options.source}): valor inexistente.`);
      return false;
    }

    if (typeof definition.flowId !== 'string' || definition.flowId.trim() === '') {
      console.error(`[SceneFlowManager] Definición inválida (${options.source}): flowId vacío o inválido.`);
      return false;
    }

    if (!Array.isArray(definition.nodes) || definition.nodes.length === 0) {
      console.error(`[SceneFlowManager] Definición inválida (${options.source}): no contiene nodos válidos.`);
      return false;
    }

    const availableScenes = options.checkSceneAvailability
      ? (this.scene.scene.manager.keys as Record<string, Phaser.Scene | undefined>)
      : undefined;

    for (let index = 0; index < definition.nodes.length; index += 1) {
      const node = definition.nodes[index];

      if (!node || typeof node !== 'object') {
        console.error(`[SceneFlowManager] Nodo inválido (${options.source}) en índice ${index}: nodo inexistente o no objeto.`);
        return false;
      }

      if (typeof node.id !== 'string' || node.id.trim() === '') {
        console.error(`[SceneFlowManager] Nodo inválido (${options.source}) en índice ${index}: id vacío o inválido.`);
        return false;
      }

      if (!VALID_SCENE_KEYS.includes(node.sceneKey)) {
        console.error(`[SceneFlowManager] Nodo inválido (${options.source}) en índice ${index}: sceneKey inválido.`, {
          nodeId: node.id,
          sceneKey: node.sceneKey
        });
        return false;
      }

      if (availableScenes && !availableScenes[node.sceneKey]) {
        console.error(`[SceneFlowManager] Nodo inválido (${options.source}) en índice ${index}: la escena no existe en Phaser.`, {
          nodeId: node.id,
          sceneKey: node.sceneKey
        });
        return false;
      }

      const expectedScene = CANONICAL_SCENE_BY_TYPE[node.type];
      if (node.sceneKey !== expectedScene) {
        console.error(`[SceneFlowManager] Nodo inválido (${options.source}) en índice ${index}: sceneKey no coincide con tipo canónico.`, {
          nodeId: node.id,
          nodeType: node.type,
          sceneKey: node.sceneKey,
          expectedScene
        });
        return false;
      }
    }

    const introIndex = definition.nodes.findIndex((node) => node.id === 'campaign-intro');
    if (introIndex !== 0) {
      console.error(`[SceneFlowManager] Definición inválida (${options.source}): campaign-intro debe ser el primer nodo.`, { introIndex });
      return false;
    }

    const firstPlayableNode = definition.nodes[1];
    if (!firstPlayableNode || !firstPlayableNode.id.startsWith('lvl01-')) {
      console.error(`[SceneFlowManager] Definición inválida (${options.source}): el nodo posterior al intro debe iniciar en lvl01-.`, {
        firstPlayableNodeId: firstPlayableNode?.id
      });
      return false;
    }

    return true;
  }
}
