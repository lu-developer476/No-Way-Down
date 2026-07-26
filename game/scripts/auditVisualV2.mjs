import fs from 'node:fs'; import path from 'node:path';
const root=path.resolve('public/assets/visual-v2');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'visual_manifest.json'),'utf8'));
const errors=[]; const ids=new Set();
const assetFiles = fs.readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.parentPath, entry.name));
for (const file of assetFiles) {
  const contents = fs.readFileSync(file);
  if (contents.includes(0)) errors.push(`binary asset forbidden: ${path.relative(root, file)}`);
  if (!['.svg', '.json', '.md'].includes(path.extname(file))) errors.push(`non text-only asset forbidden: ${path.relative(root, file)}`);
}
for(const a of manifest.assets??[]){
  if(ids.has(a.id))errors.push(`duplicate id ${a.id}`); ids.add(a.id);
  const file=path.resolve('public',a.path.replace(/^assets\//,'assets/'));
  if(!fs.existsSync(file))errors.push(`missing ${a.path}`);
  if(a.dimensions.width!==a.frameWidth*a.frames)errors.push(`invalid frame grid ${a.id}`);
  for(const [name,anim] of Object.entries(a.animations??{})){if(anim.start<0||anim.end>=a.frames)errors.push(`invalid animation ${a.id}:${name}`);}
  for(const key of ['origin','recommendedScale','version','source','category'])if(a[key]===undefined)errors.push(`missing ${key} on ${a.id}`);
}
const runtime=JSON.parse(fs.readFileSync('public/assets/levels/runtime/level_1_pasillos_escaleras_pb.runtime.json','utf8'));
if(runtime.visualGeneration!=='v2')errors.push('corridor runtime is not v2');
const other=fs.readdirSync('public/assets/levels/runtime').filter(f=>f.endsWith('.runtime.json')&&!f.includes('level_1_pasillos_escaleras_pb'));
for(const f of other){const d=JSON.parse(fs.readFileSync(path.join('public/assets/levels/runtime',f),'utf8'));if(d.visualGeneration==='v2')errors.push(`v2 leaked to ${f}`);}
const style=fs.readFileSync('src/config/visualStyle.ts','utf8');
for(const budget of ['shells','impacts','stains','particles','temporaryLights','bodies','decals'])if(!style.includes(`${budget}:`))errors.push(`missing budget ${budget}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1);} console.log(`visual-v2 audit passed: ${manifest.assets.length} assets, ${other.length} legacy runtimes`);
