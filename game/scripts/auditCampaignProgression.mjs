import { readFileSync } from 'node:fs';
const read=(path)=>JSON.parse(readFileSync(new URL(`../public/${path}`,import.meta.url),'utf8'));
const manifest=read('assets/campaign/canonical_campaign_manifest.json');
const failures=[];const ids=new Set(manifest.nodes.map(n=>n.id));const runtimeIds=new Set();
const inside=(p,l)=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&p.x>=0&&p.x<=l.width&&p.y>=0&&p.y<=l.height;
for(const [index,node] of manifest.nodes.entries()){
  if(node.type!=='level')continue;
  const wrapper=read(node.levelConfigPath);
  const runtime=read(wrapper.runtimePath);
  const layout=runtime.layout??{};
  if(wrapper.runtimeLevelId!==runtime.level_id)failures.push(`${node.id}: runtime is not resolvable`);
  if(!(layout.width>0&&layout.height>0))failures.push(`${node.id}: invalid layout`);
  if(!inside(layout.default_spawn,layout))failures.push(`${node.id}: player spawn outside bounds`);
  const points=runtime.spawn_zones?.points??[];
  for(const point of points)if(!inside(point,layout))failures.push(`${node.id}: enemy spawn ${point.id} outside bounds`);
  for(const pickup of runtime.pickups??[])if(!inside(pickup,layout))failures.push(`${node.id}: pickup ${pickup.id} outside bounds`);
  for(const area of runtime.spawn_zones?.areas??[]){const b=area.trigger??area;const centered=Boolean(area.trigger);const invalid=centered?(!inside(b,layout)||b.x-b.width/2<0||b.x+b.width/2>layout.width||b.y-b.height/2<0||b.y+b.height/2>layout.height):(!inside(b,layout)||b.x+b.width>layout.width||b.y+b.height>layout.height);if(invalid)failures.push(`${node.id}: hold area ${area.id} outside bounds`);}
  const exits=runtime.exits??[];
  const exitInteractions=(runtime.interactables??[]).filter(i=>exits.some(e=>e.id===i.interactionEffect?.targetId));
  const objectiveDriven=wrapper.completion?.type==='objective_kills';
  if(!objectiveDriven&&(exits.length!==1||exitInteractions.length!==1))failures.push(`${node.id}: canonical exit is not mapped one-to-one to an interaction`);
  for(const interaction of runtime.interactables??[])if(!inside(interaction,layout))failures.push(`${node.id}: interaction ${interaction.id} outside bounds`);
  if(!objectiveDriven&&!(runtime.objectives??[]).length)failures.push(`${node.id}: empty objectives`);
  if(!objectiveDriven){
    const exit=exitInteractions[0];
    if(exit&&Math.abs(exit.y-layout.default_spawn.y)>Math.max(180,exit.interactionRadius??100)) failures.push(`${node.id}: spawn and exit are not on the same floor interval`);
    const next=manifest.nodes[index+1];if(!next||!ids.has(next.id))failures.push(`${node.id}: invalid canonical destination`);
  }
  if(runtimeIds.has(node.id))failures.push(`${node.id}: duplicate node id`);runtimeIds.add(node.id);
}
if(manifest.nodes.length!==35||manifest.canonicalNodeCount!==35)failures.push('canonical manifest must contain exactly 35 nodes');
if(failures.length){console.error(failures.map(v=>`- ${v}`).join('\n'));process.exit(1);}
console.log(`Campaign progression audit passed: ${runtimeIds.size} level nodes resolved from real JSON; bounds, exits and horizontal floor reachability validated.`);
