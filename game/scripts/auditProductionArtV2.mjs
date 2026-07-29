import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const game=resolve(import.meta.dirname,'..'), fail=[];
const read=p=>JSON.parse(readFileSync(resolve(game,p),'utf8'));
const manifest=read('public/assets/production-art/characters/character_art_manifest.json');
if(manifest.frameWidth!==80||manifest.frameHeight!==112||manifest.footLine!==104)fail.push('manifest must use 80x112 and footLine 104');
const humans=['alan','giovanna','nahir','damian','celestino','hernan','yamil','lorena','selene'];
const zombies=['zombie-guard','zombie-civil','zombie-advanced'];
const signatures=new Set(),palettes=new Set();
for(const id of [...humans,...zombies]){const kind=id.startsWith('zombie-')?'zombies':'characters',path=`art-source/${kind}/${id}.json`;if(!existsSync(resolve(game,path))){fail.push(`missing ${path}`);continue}const source=read(path);signatures.add(source.silhouette);palettes.add(JSON.stringify(source.identityColors??source.layers));const expected=kind==='characters'?{idle:6,walk:8,aim:3,shoot:5,reload:8,melee:8,hurt:4,death:10,climb:8,interact:4}:{idle:6,walk:8,attack:8,hurt:4,death:10};for(const [state,count] of Object.entries(expected))if(source.animationFrames[state]!==count)fail.push(`${id} ${state}`)}
if(signatures.size!==12||palettes.size!==12)fail.push('silhouettes and palettes must be distinct');
for(const entry of manifest.characters){if(entry.frameWidth!==80||entry.frameHeight!==112||entry.footLine!==104)fail.push(`${entry.characterId} grounding metadata`);for(const animation of Object.values(entry.animations))if(animation.endFrame-animation.startFrame<1)fail.push(`${entry.characterId} duplicated animation`)}
const weapon=read('art-source/ui/weapon-anchor-profiles.json');if(Object.keys(weapon.profiles).length!==11)fail.push('eleven weapon profiles required');
const required=['Background','RearArchitecture','Architecture','RearProps','GameplayDecor','FrontProps','Foreground','LightAnchors','ReflectionZones','AmbientZones'];for(const id of ['level_1_comedor_resistencia','level_1_pasillos_escaleras_pb','level_2_hall_planta_baja']){const map=read(`public/assets/levels/runtime/${id}.runtime.json`),names=map.visualLayers?.map(x=>x.name)??[];if(map.visualAtlas!=='assets/production-art/environments/bank-interior-kit.png'||required.some(x=>!names.includes(x)))fail.push(`${id} visual atlas/layers`);for(const layer of map.visualLayers??[])for(const o of layer.objects??[])for(const key of ['runtimeId','assetKey','frame','depth','anchor','alpha','tint','scrollFactor','visualRole'])if(!(key in o))fail.push(`${id} ${layer.name} missing ${key}`)}
const main=readFileSync(resolve(game,'src/main.ts'),'utf8'),boot=readFileSync(resolve(game,'src/scenes/BootScene.ts'),'utf8');if(!main.includes('ProductionArtGalleryScene')||!boot.includes("get('artGallery') === '1'"))fail.push('query-only gallery missing');
if(!existsSync(resolve(game,'public/assets/production-art/environments/bank-interior-kit.png')))fail.push('environment output missing');
if(existsSync(resolve(game,'../.gitattributes'))&&readFileSync(resolve(game,'../.gitattributes'),'utf8').includes('filter=lfs'))fail.push('Git LFS forbidden');
if(fail.length){console.error(fail.map(x=>`- ${x}`).join('\n'));process.exit(1)}console.log('Production art V2 audit passed: 9 humans, 3 infected, 11 weapon profiles, gallery and 3 authored environments.');
