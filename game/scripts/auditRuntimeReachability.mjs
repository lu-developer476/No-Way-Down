import{readFileSync,existsSync}from'node:fs';import{resolve}from'node:path';
const root=resolve(import.meta.dirname,'../src');const main=readFileSync(resolve(root,'main.ts'),'utf8');const failures=[];
for(const scene of ['BootScene','AssetPreloadScene','MainMenuScene','CampaignIntroScene','LevelScene','CinematicScene','DialogueScene','UpperFloorScene','UIScene'])if(!main.includes(scene))failures.push(`registered production scene missing: ${scene}`);
if(!/default:\s*['"]arcade['"]/.test(main))failures.push('production physics is not Arcade');
for(const p of ['visual/ProductionCharacterArt.ts','visual/GroundAnchorSystem.ts','scenes/LevelScene.ts','scenes/UIScene.ts'])if(!existsSync(resolve(root,p)))failures.push(`required runtime module missing: ${p}`);
for(const p of ['physics/MatterPlayer.ts','runtime/LevelRuntime.ts','tiled/TiledWorldBuilder.ts','scenes/LevelLoadingScene.ts'])if(existsSync(resolve(root,p)))failures.push(`unreachable obsolete module remains: ${p}`);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Runtime reachability passed: registered Arcade graph is complete; authoring, type, test, script, configuration and URL-manifest exclusions are documented in the inventory.');
