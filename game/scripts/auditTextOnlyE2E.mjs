import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const targets=['game/e2e','game/scripts/runProductionE2E.sh','.github/workflows/production-gate.yml'];
const denied=['screenshot','save_screenshot','get_screenshot','page.screenshot','takescreenshot','pil','pillow','imagechops','imagedraw','visual-baselines','baseline candidates','compare_visual','capture_state','base64','data:image'];
const unsafeReturns=[
  {pattern:/return\s+window\.__NWD_GAME__\s*(?:;|[)'"\n]|$)/,message:'raw Phaser.Game returned to WebDriver'},
  {pattern:/return\s+window\.__NWD_RUNTIME_DIAGNOSTICS__\s*(?:;|[)'"\n]|$)/,message:'raw runtime diagnostics returned to WebDriver'},
  {pattern:/return\s+window\.__NWD_GAME__\.scene\.getScene\s*\(/,message:'raw Phaser.Scene returned to WebDriver'},
  {pattern:/return\s+.*\.body\b/,message:'raw physics body returned to WebDriver'},
  {pattern:/JSON\.stringify\s*\(\s*window\.__NWD_GAME__/,message:'circular game graph serialization attempted'},
];
export function unsafeReturnFailures(content){return unsafeReturns.filter(({pattern})=>pattern.test(content)).map(({message})=>message)}
const files=[];
function visit(path){const absolute=resolve(root,path);if(statSync(absolute).isDirectory())for(const name of readdirSync(absolute))visit(`${path}/${name}`);else files.push(path)}
for(const target of targets)visit(target);
const failures=[];
for(const file of files){const raw=readFileSync(resolve(root,file),'utf8');const content=raw.toLowerCase();for(const term of denied)if(content.includes(term))failures.push(`${file}: forbidden text-only E2E token: ${term}`);for(const message of unsafeReturnFailures(raw))failures.push(`${file}: ${message}`)}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Text-only E2E audit passed (${files.length} textual files).`);
