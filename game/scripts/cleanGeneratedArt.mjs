import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const game=resolve(import.meta.dirname,'..');
const root=resolve(game,'public/assets/production-art');
for(const folder of ['characters','zombies','weapons','ui']){
 const dir=resolve(root,folder); if(!existsSync(dir))continue;
 for(const entry of readdirSync(dir,{withFileTypes:true})) if(entry.isFile()&&entry.name.endsWith('.png'))rmSync(resolve(dir,entry.name));
}
rmSync(resolve(game,'.generated-art'),{recursive:true,force:true});
console.log('Generated runtime PNG files and temporary workspace cleaned.');
