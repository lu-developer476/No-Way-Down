import { existsSync } from 'node:fs';
import { campaignWorldDefinitions } from '../src/config/campaignWorldDefinitions.ts';
import { worldAssetCatalog } from '../src/config/worldAssetCatalog.ts';

const failures=[];
const nodeIds=new Set();
const profiles=new Set();
for(const world of campaignWorldDefinitions){
  if(nodeIds.has(world.nodeId)) failures.push(`duplicate node: ${world.nodeId}`);
  if(profiles.has(world.worldProfileId)) failures.push(`duplicate profile: ${world.worldProfileId}`);
  nodeIds.add(world.nodeId);profiles.add(world.worldProfileId);
  if(!world.environmentInstances.length||!world.walkableSurfaces.length) failures.push(`${world.nodeId}: empty visual composition`);
  for(const item of [...world.environmentInstances,...world.foregroundInstances]){
    if(!worldAssetCatalog.some(asset=>asset.key===item.assetKey)) failures.push(`${world.nodeId}: unknown asset ${item.assetKey}`);
  }
}
for(const asset of worldAssetCatalog){
  const path=new URL(`../public/${asset.path.replace(/^assets\//,'assets/')}`,import.meta.url);
  if(!existsSync(path)) failures.push(`missing existing visual module: ${asset.path}`);
}
if(failures.length){console.error(failures.map(v=>`- ${v}`).join('\n'));process.exit(1);}
console.log(`Campaign world audit passed: ${campaignWorldDefinitions.length} data definitions and ${worldAssetCatalog.length} existing modules parsed.`);
