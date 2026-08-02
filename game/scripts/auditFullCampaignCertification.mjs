import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'../..'), read=(p)=>readFileSync(resolve(root,p),'utf8');
const manifest=JSON.parse(read('game/public/assets/campaign/canonical_campaign_manifest.json')); const failures=[];
const production=read('game/e2e/production_e2e.py'), full=read('game/e2e/full_campaign_e2e.py'), bridge=read('game/src/qa/ProductionE2eBridge.ts'), main=read('game/src/main.ts'), inventory=read('docs/qa/full-campaign-production-inventory.md'), workflow=read('.github/workflows/full-campaign-e2e.yml');
const forbiddenPhysics=['scene.'+'matter','matter'+'BodyCount']; for(const token of forbiddenPhysics)for(const [name,text] of [['production E2E',production],['QA bridge',bridge]])if(text.includes(token))failures.push(`${name} contains obsolete physics token ${token}`);
if(!/default:\s*'arcade'/.test(main))failures.push('main.ts does not configure Arcade');
if(manifest.flowId!=='main_campaign'||manifest.nodes.length!==35||manifest.canonicalNodeCount!==35)failures.push('canonical manifest is not the 35-node campaign');
for(const node of manifest.nodes){if(!inventory.includes(`| ${node.id} |`))failures.push(`${node.id} missing inventory strategy`);if(!full.includes("MANIFEST['nodes']"))failures.push('campaign E2E is not manifest-derived');if(node.levelConfigPath&&!existsSync(resolve(root,'game/public',node.levelConfigPath)))failures.push(`${node.id} missing level config`);if(node.cinematicPath&&!existsSync(resolve(root,'game/public',node.cinematicPath)))failures.push(`${node.id} missing cinematic`);}
if(!production.includes('continue')&&!production.includes('Continue'))failures.push('Continue has no production coverage');
if(!read('game/src/run/ActiveRunSnapshot.ts').includes('ACTIVE_RUN_SCHEMA_VERSION'))failures.push('active save schema is not versioned');
if(!bridge.includes("get('e2e') !== '1'"))failures.push('bridge is not query gated');
if(!workflow.includes('E2E_CAMPAIGN_SHARD')||!workflow.includes('npm run typecheck --prefix game'))failures.push('full campaign workflow lacks shards or correct typecheck');
const changed=execFileSync('git',['diff','--name-only','HEAD'],{cwd:root,encoding:'utf8'}).trim().split('\n');if(changed.some(p=>p.toLowerCase().endsWith('.png')))failures.push('PNG changed by certification');
if(existsSync(resolve(root,'.gitattributes'))&&read('.gitattributes').toLowerCase().includes('lfs'))failures.push('Git LFS configuration found');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('Full campaign certification audit passed: 35 canonical nodes, Arcade diagnostics, gated bridge, sharded workflow.');
