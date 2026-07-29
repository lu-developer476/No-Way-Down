import test from 'node:test';import assert from 'node:assert/strict';import {existsSync,readFileSync} from 'node:fs';import {resolve} from 'node:path';import manifest from '../public/assets/production-art/characters/character_art_manifest.json' with {type:'json'};
import {GroundAnchorSystem} from '../src/visual/GroundAnchorSystem.ts';import {GAMEPLAY_HUD_LAYOUT,findHudIntersections,OBJECTIVE_TOAST_VISIBLE_MS,OBJECTIVE_TOAST_FADE_MS} from '../src/scenes/gameplayHudLayout.ts';
const game=resolve(import.meta.dirname,'..');
const byId=new Map(manifest.characters.map(c=>[c.characterId,c]));
test('nine named humans and three infected use distinct production sheets',()=>{const ids=['alan','giovanna','nahir','damian','celestino','hernan','yamil','lorena','selene','zombie-guard','zombie-civil','zombie-advanced'];assert.deepEqual(ids.map(id=>byId.get(id)?.sheetPath).filter(Boolean).length,12);assert.equal(new Set(ids.map(id=>byId.get(id)?.sheetPath)).size,12);assert.notEqual(byId.get('nahir')?.sheetPath,byId.get('giovanna')?.sheetPath);assert.notEqual(byId.get('damian')?.sheetPath,byId.get('alan')?.sheetPath)});
test('animation geometry has one normalized 64x96 foot line',()=>{for(const c of manifest.characters){assert.equal(c.frameWidth,64);assert.equal(c.frameHeight,96);assert.equal(c.footLine,88);for(const a of Object.values(c.animations))assert.ok(a.endFrame>a.startFrame)}});
test('ground snapshot aligns feet shadow body and nameplate',()=>{const alan=byId.get('alan')!;const snap=GroundAnchorSystem.snapshot({x:120,y:300},alan,300);assert.equal(snap.groundError,0);assert.equal(snap.bodyBottom,300);assert.deepEqual(snap.shadow,{x:120,y:301});assert.equal(snap.nameplate.y,206)});
test('ally recovery and spawn formation select grounded separated positions',()=>{const surfaces=[{left:0,right:500,top:300}];const recovery=GroundAnchorSystem.resolveRecovery({x:100,y:270},surfaces,{left:0,right:500},[100]);assert.equal(recovery.y,300);assert.ok(Math.abs(recovery.x-100)>=54);const formation=GroundAnchorSystem.spawnFormation({x:250,y:300},9,{left:0,right:500});assert.ok(formation.every(p=>p.y===300));assert.ok(new Set(formation.map(p=>p.x)).size>=8)});
test('HUD safe regions do not intersect and objective toast fades',()=>{assert.deepEqual(findHudIntersections(),[]);assert.ok(GAMEPLAY_HUD_LAYOUT.playerHudBounds.width<=252);assert.ok(GAMEPLAY_HUD_LAYOUT.partyHudBounds.height<=50);assert.ok(GAMEPLAY_HUD_LAYOUT.minimapBounds.width<=176);assert.equal(OBJECTIVE_TOAST_VISIBLE_MS,3500);assert.equal(OBJECTIVE_TOAST_FADE_MS,300)});
test('campaign manifest remains 35 nodes',async()=>{const campaign=await import('../public/assets/campaign/canonical_campaign_manifest.json',{with:{type:'json'}});assert.equal(campaign.default.nodes.length,35)});
test('runtime art outputs never use Git LFS',()=>{const attributes=resolve(game,'../.gitattributes');assert.equal(existsSync(attributes),false);const ignore=readFileSync(resolve(game,'../.gitignore'),'utf8');assert.match(ignore,/production-art\/\*\*\/\*\.png/)});
test('ally following leaves vertical motion to gravity and props use foot anchors',()=>{
 const ally=readFileSync(resolve(game,'src/entities/AllyAI.ts'),'utf8');
 const follow=ally.slice(ally.indexOf('private moveTowards'),ally.indexOf('private avoidBlockingPlayer'));
 assert.doesNotMatch(follow,/setVelocityY|setVelocity\([^)]*,/);
 const props=readFileSync(resolve(game,'src/systems/CorridorDecorationSystem.ts'),'utf8');
 assert.doesNotMatch(props,/prop-[^']+'\)\.setDisplaySize\([^\n]+setOrigin\(0\.5, 0\.5\)/);
 assert.match(props,/setOrigin\(0\.5, 1\)/);
});
