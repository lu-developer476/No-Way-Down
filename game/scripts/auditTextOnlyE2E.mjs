import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const targets=['game/e2e','game/scripts/runProductionE2E.sh','.github/workflows/production-gate.yml'];
const denied=['screenshot','save_screenshot','get_screenshot','page.screenshot','takescreenshot','pil','pillow','imagechops','imagedraw','.png','.jpg','visual-baselines','baseline candidates','compare_visual','capture_state','base64','data:image'];
const files=[];
function visit(path){const absolute=resolve(root,path);if(statSync(absolute).isDirectory())for(const name of readdirSync(absolute))visit(`${path}/${name}`);else files.push(path)}
for(const target of targets)visit(target);
const failures=[];
for(const file of files){const content=readFileSync(resolve(root,file),'utf8').toLowerCase();for(const term of denied)if(content.includes(term))failures.push(`${file}: forbidden text-only E2E token: ${term}`)}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Text-only E2E audit passed (${files.length} textual files).`);
