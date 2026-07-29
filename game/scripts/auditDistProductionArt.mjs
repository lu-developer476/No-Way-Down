import { existsSync,readFileSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const game=resolve(import.meta.dirname,'..'),dist=resolve(game,'dist');
const config=JSON.parse(readFileSync(resolve(game,'config/generated-production-art.json'),'utf8'));
const failures=[]; const signature=Buffer.from([137,80,78,71,13,10,26,10]);
for(const asset of config.assets){
 const publicPath=asset.path.replace(/^game\/public\//,''); const file=resolve(dist,publicPath);
 if(!file.startsWith(dist))failures.push(`unsafe path: ${publicPath}`);
 if(!existsSync(file)){failures.push(`missing dist asset: ${publicPath}`);continue}
 const bytes=readFileSync(file);if(bytes.length<=100)failures.push(`undersized dist asset: ${publicPath}`);
 if(!bytes.subarray(0,8).equals(signature))failures.push(`not a PNG: ${publicPath}`);
 if(bytes.subarray(0,42).toString().startsWith('version https://git-lfs.github.com/spec/v1'))failures.push(`LFS pointer in dist: ${publicPath}`);
}
if(!existsSync(resolve(dist,'index.html')))failures.push('missing dist/index.html');
const searchable=existsSync(dist)?readdirSync(resolve(dist,'assets'),{withFileTypes:true}).filter(e=>e.isFile()&&/\.(js|css)$/.test(e.name)).map(e=>readFileSync(resolve(dist,'assets',e.name),'utf8')).join('\n'):'';
const manifest=JSON.parse(readFileSync(resolve(game,'public/assets/production-art/characters/character_art_manifest.json'),'utf8'));
for(const entry of manifest.characters) if(!config.assets.some(a=>a.path.endsWith(entry.sheetPath)))failures.push(`runtime sheet absent from expected outputs: ${entry.sheetPath}`);
if(!searchable.includes('production-art'))failures.push('built chunks do not reference production-art');
if(failures.length){console.error(failures.map(f=>`- ${f}`).join('\n'));process.exit(1)}
console.log(`Production dist art audit passed (${config.assets.length} real PNG files).`);
