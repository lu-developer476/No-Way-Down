import assert from 'node:assert/strict';
import test from 'node:test';
import dining from '../public/assets/levels/runtime/level_1_comedor_resistencia.runtime.json' with { type:'json' };
import corridors from '../public/assets/levels/runtime/level_1_pasillos_escaleras_pb.runtime.json' with { type:'json' };
import hall from '../public/assets/levels/runtime/level_2_hall_planta_baja.runtime.json' with { type:'json' };
import manifest from '../public/assets/campaign/canonical_campaign_manifest.json' with { type:'json' };
import { campaignWorldDefinitions } from '../src/config/campaignWorldDefinitions.ts';
import { mapExitConnectors, ResistanceClock, resolveRuntimeGeometry } from '../src/campaign/campaignProgression.ts';
import { InteractableSystem } from '../src/systems/core/InteractableSystem.ts';
import { WorldConnectorSystem } from '../src/world/WorldConnectorSystem.ts';

const asLevel=(value:unknown)=>value as Parameters<typeof resolveRuntimeGeometry>[0];
const inside=(point:{x:number;y:number},level:{layout:{width:number;height:number}})=>point.x>=0&&point.x<=level.layout.width&&point.y>=0&&point.y<=level.layout.height;
const exitInteraction=(level:typeof dining)=>level.interactables.find(i=>level.exits.some(e=>e.id===i.interactionEffect.targetId))!;

test('runtime geometry remains authoritative over the smaller visual definition',()=>{
  const visual=campaignWorldDefinitions.find(w=>w.nodeId==='lvl01-esc01-comedor-resistencia')!;
  const geometry=resolveRuntimeGeometry(asLevel(dining),{...visual,worldWidth:2240,worldHeight:900});
  assert.deepEqual([geometry.width,geometry.height],[5200,864]);
  assert.equal(geometry.floorY,832);
  assert.equal(geometry.worldWidthMismatch,true);
  assert.equal(geometry.worldHeightMismatch,true);
  const configured=resolveRuntimeGeometry(asLevel(dining),visual);
  assert.equal(configured.worldWidthMismatch,false);assert.equal(configured.worldHeightMismatch,false);
});

test('dining gameplay coordinates, resistance and canonical exit are valid',()=>{
  assert.ok(inside(dining.layout.default_spawn,dining));
  dining.spawn_zones.areas.forEach(a=>assert.ok(inside(a.trigger,dining)));
  dining.spawn_zones.points.forEach(p=>assert.ok(inside(p,dining)));
  const interaction=exitInteraction(dining);
  assert.deepEqual([interaction.x,interaction.y],[4900,724]);
  assert.ok(inside(interaction,dining));
  assert.equal(interaction.interactionEffect.targetId,'salida-comedor');
  const clock=new ResistanceClock(1000,250);
  assert.deepEqual(clock.tick(1000),{active:true,completed:false,remainingMs:250});
  assert.equal(clock.tick(1125).remainingMs,125);
  let completions=0;assert.equal(clock.tick(1250,()=>completions++).completed,true);
  clock.tick(1500,()=>completions++);assert.equal(completions,1);assert.equal(clock.completions,1);
  assert.match(dining.layout.level_flow.resistance.advanceObjectiveText,/salida/i);
  const system=new InteractableSystem(dining.interactables,'E');
  assert.equal(system.tryInteract(interaction.x,interaction.y,'E').effect?.targetId,'salida-comedor');
});

test('corridors and hall preserve the playable canonical route',()=>{
  assert.equal(corridors.layout.width,5600);
  assert.ok(inside(corridors.layout.default_spawn,corridors));
  const interaction=exitInteraction(corridors as unknown as typeof dining);
  assert.deepEqual([interaction.x,interaction.y],[5300,724]);assert.ok(inside(interaction,corridors));
  const nodes=manifest.nodes.map(n=>n.id);
  assert.deepEqual(nodes.slice(1,5),['lvl01-esc01-comedor-resistencia','lvl01-esc02-pasillos-hacia-escaleras-pb','lvl01-cin01-cierre-contextual','lvl02-esc01-hall-planta-baja']);
  assert.ok(inside(hall.layout.default_spawn,hall));assert.ok(hall.objectives[0].label.trim());
});

test('connectors resolve canonical interactions and honor distance/gating',()=>{
  const definition=campaignWorldDefinitions.find(w=>w.nodeId==='lvl01-esc01-comedor-resistencia')!;
  const mapped=mapExitConnectors(definition,asLevel(dining),false);
  assert.equal(mapped[0].existingInteractionId,'level_1_comedor_resistencia-exit');
  assert.equal(mapped[0].existingExitId,'salida-comedor');
  const connectors=new WorldConnectorSystem(mapped);
  assert.equal(connectors.nearest(4900,724),undefined);
  connectors.setObjectiveRequirementSatisfied(true);
  assert.equal(connectors.nearest(0,0),undefined);
  assert.equal(connectors.nearest(4900,724)?.connectorId,definition.exitConnectors[0].connectorId);
});
