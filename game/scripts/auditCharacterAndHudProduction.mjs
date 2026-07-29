import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const game=resolve(import.meta.dirname,'..'),read=(p)=>readFileSync(resolve(game,p),'utf8'),fail=[];
const manifest=JSON.parse(read('public/assets/production-art/characters/character_art_manifest.json'));
const humans=['alan','giovanna','nahir','damian','celestino','hernan','yamil','lorena','selene'],zombies=['zombie-guard','zombie-civil','zombie-advanced'];
for(const id of [...humans,...zombies]){const e=manifest.characters.find(c=>c.characterId===id);if(!e)fail.push(`missing character ${id}`);else{if(e.frameWidth!==64||e.frameHeight!==96||e.footLine!==88)fail.push(`invalid geometry ${id}`);const required=humans.includes(id)?['idle','walk','aim','shoot','reload','melee','hurt','death','climb','interact']:['idle','walk','attack','hurt','death'];for(const a of required)if(!e.animations[a]||e.animations[a].endFrame-e.animations[a].startFrame<1)fail.push(`invalid animation ${id}:${a}`);}}
const sources=['src/scenes/AssetPreloadScene.ts','src/scenes/GameScene.ts','src/entities/AllyAI.ts','src/entities/Player.ts','src/scenes/UIScene.ts','src/systems/MinimapSystem.ts','src/scenes/environmentLayout.ts'].map(read).join('\n');
for(const token of ['v2-alan','v2-giovanna','v2-zombie-guard','v2-zombie-civil','v2-zombie-advanced','controlsCard','threatCard','corridorVisualV2','visualOrigin: { x: 16, y: 42 }','setScale(1.5)','desiredY = player.y +'])if(sources.includes(token))fail.push(`forbidden production token: ${token}`);
for(const token of ['heldWeaponSprite','holsteredWeaponSprite','primaryWeapon','secondaryWeapon','activeSlot','OBJECTIVE_TOAST_FADE_MS','anchor: EnvironmentPropAnchor'])if(!sources.includes(token))fail.push(`missing production contract: ${token}`);
const ui=read('src/scenes/UIScene.ts');for(const m of ui.matchAll(/fontSize:\s*['"](\d+)px/g))if(Number(m[1])<11)fail.push(`gameplay font below 11px: ${m[1]}`);
const campaign=JSON.parse(read('public/assets/campaign/canonical_campaign_manifest.json'));if(campaign.nodes.length!==35)fail.push('canonical campaign no longer has 35 nodes');
const protectedAssets=JSON.parse(read('config/protected-assets.json')).assets.slice(0,3);for(const a of protectedAssets){const hash=createHash('sha256').update(readFileSync(resolve(game,'..',a.path))).digest('hex');if(hash!==a.sha256)fail.push(`protected asset changed: ${a.path}`)}
if(fail.length){console.error(`Character/HUD production audit failed:\n${fail.map(x=>`- ${x}`).join('\n')}`);process.exit(1)}console.log('Character/HUD production audit passed: 9 humans, 3 infected variants, grounding, weapons, compact HUD, and 35-node campaign.');
