import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative} from 'node:path';
const game=resolve(import.meta.dirname,'..'),src=resolve(game,'src');
const forbidden=[
 'physics/CollisionCategories.ts','physics/GroundContactTracker.ts','physics/MatterBodyFactory.ts','physics/MatterCollisionRouter.ts','physics/MatterPlayer.ts','physics/MatterSensorRegistry.ts','physics/MatterStairSystem.ts','physics/MatterWorldLifecycle.ts',
 'runtime/LevelRuntime.ts','tiled/TiledWorldBuilder.ts','scenes/LevelLoadingScene.ts','scenes/LoadingScene.ts','scenes/CampaignFlow.ts',
 'config/environmentVisualsV2.ts','config/hudVisualsV2.ts','config/weaponVisualsV2.ts'
];
const failures=forbidden.filter(p=>existsSync(resolve(src,p))).map(p=>`obsolete runtime module remains: ${p}`);
const walk=d=>{for(const name of readdirSync(d)){const p=resolve(d,name);if(statSync(p).isDirectory())walk(p);else if(/\.ts$/.test(name)){const text=readFileSync(p,'utf8');if(/from\s+['"][^'"]*(?:MatterBodyFactory|MatterPlayer|MatterCollisionRouter|TiledWorldBuilder)['"]/.test(text))failures.push(`obsolete import: ${relative(src,p)}`)}}};walk(src);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Dead runtime code audit passed: obsolete Matter/loading and unused V2 configuration are absent.');
