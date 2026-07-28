import { campaignWorldDefinitions } from '../config/campaignWorldDefinitions.ts';
import type { LevelWorldDefinition } from './LevelWorldDefinition.ts';

export class MissingCampaignWorldError extends Error {
  readonly nodeId:string; constructor(nodeId:string){super(`WORLD_DEFINITION_MISSING:${nodeId}`);this.nodeId=nodeId;this.name='MissingCampaignWorldError';}
}
const definitions=new Map(campaignWorldDefinitions.map(definition=>[definition.nodeId,definition]));
export const CampaignWorldRegistry={
  all:():readonly LevelWorldDefinition[]=>campaignWorldDefinitions,
  resolve(nodeId:string):LevelWorldDefinition { const value=definitions.get(nodeId); if(!value){console.error('[CampaignWorldRegistry]',{code:'WORLD_DEFINITION_MISSING',nodeId});throw new MissingCampaignWorldError(nodeId);} return value; },
  findByRuntimeLevelId(runtimeLevelId:string):LevelWorldDefinition|undefined { return campaignWorldDefinitions.find(value=>value.runtimeLevelId===runtimeLevelId); }
} as const;
