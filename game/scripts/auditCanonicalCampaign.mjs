import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = {
  manifest: 'public/assets/campaign/canonical_campaign_manifest.json',
  flow: 'public/assets/campaign/campaign_flow.json',
  firstConfig: 'public/assets/levels/level2_subsuelo.json',
  secondConfig: 'public/assets/levels/level3_hall_planta_baja.json',
  firstRuntime: 'public/assets/levels/runtime/level_1_subsuelo_comedor.runtime.json',
  secondRuntime: 'public/assets/levels/runtime/level_2_escaleras_espiral.runtime.json'
};
const criticalIds = [
  'campaign-intro', 'lvl01-esc01-comedor-resistencia',
  'lvl01-esc02-pasillos-hacia-escaleras-pb', 'lvl01-cin01-cierre-contextual',
  'lvl03-cin01-llamado-lorena-rescate', 'lvl04-cin01-rescate-lorena-en-oficina-422',
  'lvl04-cin02-llamada-selene-y-descenso', 'lvl06-cin02-muerte-lorena-y-guardia-en-salida-e',
  'lvl08-cin01-damian-infectado-y-suicidio', 'lvl08-cin02-sacrificio-hernan-yamil',
  'lvl08-cin03-caida-final-del-duo', 'lvl09-cin01-hallazgo-salida-y-mordida-selene',
  'lvl09-cin02-traicion-de-selene-y-huida', 'lvl10-cin01-traslado-silencioso-plaza-de-mayo',
  'lvl10-esc01-combate-50-bajas-en-via-publica', 'lvl10-cin02-cierre-duo-final-en-san-telmo'
];
function fail(file, expected, found) {
  console.error(`[CampaignAudit] ${file}: esperado ${expected}; encontrado ${JSON.stringify(found)}`);
  process.exit(1);
}
function readJson(relativePath) {
  try { return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')); }
  catch (error) { fail(relativePath, 'JSON válido', error instanceof Error ? error.message : error); }
}
const manifest = readJson(files.manifest);
if (manifest.manifestVersion !== 1) fail(files.manifest, 'manifestVersion === 1', manifest.manifestVersion);
if (manifest.flowId !== 'main_campaign') fail(files.manifest, 'flowId === "main_campaign"', manifest.flowId);
if (manifest.canonicalNodeCount !== 35) fail(files.manifest, 'canonicalNodeCount === 35', manifest.canonicalNodeCount);
if (!Array.isArray(manifest.nodes) || manifest.nodes.length !== 35) fail(files.manifest, 'nodes.length === 35', manifest.nodes?.length);
const ids = manifest.nodes.map((node) => node?.id);
if (new Set(ids).size !== ids.length) fail(files.manifest, 'IDs únicos', ids);
for (const node of manifest.nodes) {
  if (typeof node.id !== 'string' || typeof node.sceneKey !== 'string' || !node.sceneKey) fail(files.manifest, `sceneKey para ${node.id}`, node.sceneKey);
  if (node.type === 'level' && !node.levelConfigPath) fail(files.manifest, `levelConfigPath para ${node.id}`, node.levelConfigPath);
  if (node.type === 'cinematic' && !node.cinematicPath) fail(files.manifest, `cinematicPath para ${node.id}`, node.cinematicPath);
}
const positions = criticalIds.map((id) => ids.indexOf(id));
if (positions.some((position) => position < 0)) fail(files.manifest, 'todos los nodos críticos', criticalIds.filter((_, index) => positions[index] < 0));
if (positions.some((position, index) => index > 0 && position <= positions[index - 1])) fail(files.manifest, 'orden histórico de nodos críticos', positions);
let implemented = 0;
let missing = 0;
for (const node of manifest.nodes) {
  const assetPath = node.levelConfigPath ?? node.cinematicPath;
  if (!assetPath || fs.existsSync(path.join(projectRoot, 'public', assetPath.replace(/^\/?assets\//, 'assets/')))) implemented += 1;
  else { missing += 1; console.warn(`[CampaignAudit] asset pendiente: ${node.id} -> ${assetPath}`); }
}
const flow = readJson(files.flow);
const levels = flow.nodes?.filter((node) => node.type === 'level');
const expectedLevels = [
  ['lvl01-esc01-subsuelo-inicial', 'assets/levels/level2_subsuelo.json'],
  ['lvl02-esc01-hall-planta-baja', 'assets/levels/level3_hall_planta_baja.json']
];
expectedLevels.forEach(([id, assetPath], index) => {
  if (levels?.[index]?.id !== id || levels[index].levelConfigPath !== assetPath) fail(files.flow, `${id} -> ${assetPath}`, levels?.[index]);
});
const firstConfig = readJson(files.firstConfig); const secondConfig = readJson(files.secondConfig);
const firstRuntime = readJson(files.firstRuntime); const secondRuntime = readJson(files.secondRuntime);
if (firstConfig.runtimeLevelId !== 'level_1_subsuelo_comedor') fail(files.firstConfig, 'runtimeLevelId === "level_1_subsuelo_comedor"', firstConfig.runtimeLevelId);
if (secondConfig.runtimeLevelId !== 'level_2_escaleras_espiral') fail(files.secondConfig, 'runtimeLevelId === "level_2_escaleras_espiral"', secondConfig.runtimeLevelId);
if (firstRuntime.level_id !== 'level_1_subsuelo_comedor') fail(files.firstRuntime, 'level_id === "level_1_subsuelo_comedor"', firstRuntime.level_id);
if (secondRuntime.level_id !== 'level_2_escaleras_espiral') fail(files.secondRuntime, 'level_id === "level_2_escaleras_espiral"', secondRuntime.level_id);
for (const field of ['objectives', 'interactables', 'exits']) if (!Array.isArray(secondRuntime[field]) || secondRuntime[field].length === 0) fail(files.secondRuntime, `${field} no vacío`, secondRuntime[field]);
if (!secondRuntime.exits.some((exit) => exit.id === 'level2-upper-stairs')) fail(files.secondRuntime, 'salida level2-upper-stairs', secondRuntime.exits);
console.log(`[CampaignAudit] nodos canónicos: ${manifest.nodes.length}`);
console.log(`[CampaignAudit] assets implementados: ${implemented}`);
console.log(`[CampaignAudit] assets pendientes: ${missing}`);
