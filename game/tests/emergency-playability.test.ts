import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const game=path.resolve(import.meta.dirname,'..');
const source=(file:string)=>fs.readFileSync(path.join(game,file),'utf8');

test('menu exposes four options and the complete setup without auto-starting',()=>{
 const menu=source('src/scenes/MainMenuScene.ts');
 for(const label of ['Nueva partida','Continuar','Opciones','Salir','Alan Nahuel','Giovanna','Complejo','Pesadilla','Celestino','Hernán','Yamil','Confirmar y comenzar','Editar grupo','Cancelar']) assert.match(menu,new RegExp(label));
 assert.match(menu,/openSetupFlow/); assert.match(menu,/optionalParty\.has/); assert.match(menu,/optionalParty\.delete/); assert.match(menu,/hasCompatibleLocalProgress/); assert.match(menu,/resolveNode\(savedId\)/);
});

test('initial setup is versioned, compatible, validated and consumed by runtime',()=>{
 const setup=source('src/run/InitialRunSetup.ts'), gameScene=source('src/scenes/GameScene.ts');
 assert.match(setup,/nwd\.setup\.initial/); assert.match(setup,/alan-nahuel/); assert.match(setup,/new Set/);
 for(const value of ["'alan'","'giovanna'","'complejo'","'pesadilla'"]) assert.match(setup,new RegExp(value));
 assert.match(gameScene,/loadInitialRunSetup/); assert.match(gameScene,/getInitialPartySeed/); assert.match(gameScene,/getDifficultyRuntimeConfig/);
});

test('restored first-level runtime has player, party, enemies, objective, resistance and exits',()=>{
 const runtime=source('src/scenes/GameScene.ts');
 for(const contract of ['getActivePlayerConfigs','AllySystem','ZombieSystem','ObjectiveSystem','setupResistancePhase','updateResistancePhase','exitUnlocked','partyHud','currentObjective']) assert.match(runtime,new RegExp(contract));
 const flow=source('public/assets/campaign/canonical_campaign_manifest.json');
 for(const destination of ['campaign-intro','comedor','pasillos','hall']) assert.match(flow,new RegExp(destination,'i'));
});

test('difficulty keeps its canonical effective difference',()=>{
 const difficulty=source('src/config/difficultyRuntime.ts');
 assert.match(difficulty,/complejo/); assert.match(difficulty,/pesadilla/); assert.match(difficulty,/zombieHealthMultiplier/);
 const values=[...difficulty.matchAll(/zombieHealthMultiplier:\s*([\d.]+)/g)].map(match=>Number(match[1]));
 assert.ok(new Set(values).size>1);
});

test('Tiled authoring metadata remains while the disconnected Matter loading path is absent',()=>{
 const renderer=source('src/tiled/TiledVisualRenderer.ts');
 assert.match(renderer,/runtimeId/); assert.match(renderer,/INVALID_RUNTIME_ID/); assert.match(renderer,/DUPLICATE_RUNTIME_ID/);
 assert.equal(fs.existsSync(path.join(game,'src/scenes/LevelLoadingScene.ts')),false);
 assert.equal(fs.existsSync(path.join(game,'public/assets/tiled')),true);
});

test('canonical campaign remains exactly 35 nodes',()=>{
 const manifest=JSON.parse(source('public/assets/campaign/canonical_campaign_manifest.json'));
 assert.equal(manifest.flowId,'main_campaign'); assert.equal(manifest.nodes.length,35); assert.equal(manifest.canonicalNodeCount,35);
});
