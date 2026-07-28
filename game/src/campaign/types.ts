export type CampaignNodeType = 'campaignIntro' | 'level' | 'cinematic' | 'dialogue';
export interface CampaignNode { id: string; type: CampaignNodeType; sceneKey: string; levelConfigPath?: string; cinematicPath?: string; dialoguePath?: string }
export interface CanonicalManifest { flowId: string; canonicalNodeCount: number; nodes: CampaignNode[] }
export interface LevelWrapper { nodeId: string; runtimeLevelId: string; runtimePath: string; nextNodeId?: string; completion?: { type: string; exitId?: string } }
