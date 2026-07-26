import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = 'public/assets/campaign/canonical_campaign_manifest.json';
const registryPath = 'public/assets/campaign/campaign_implementation_registry.json';
const expectedManifestSha256 = '732a07a5d72b83b611048565aea283300608ebb9f8398d8ea6811353a422a6cf';
const fail = (message) => { console.error(`[CampaignAudit] ERROR: ${message}`); process.exitCode = 1; };
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const manifestBytes = fs.readFileSync(path.join(root, manifestPath));
const manifest = JSON.parse(manifestBytes);
const registry = read(registryPath);
const ids = Array.isArray(manifest.nodes) ? manifest.nodes.map((node) => node.id) : [];

if (crypto.createHash('sha256').update(manifestBytes).digest('hex') !== expectedManifestSha256) fail('el manifiesto fue modificado; revisar el canon antes de actualizar su huella auditada');
if (manifest.flowId !== 'main_campaign' || manifest.canonicalNodeCount !== 35 || ids.length !== 35) fail('la campaña debe contener exactamente 35 nodos');
if (new Set(ids).size !== 35) fail('todos los IDs deben ser únicos');
manifest.nodes.forEach((node, index) => {
  const expectedScene = { campaignIntro: 'CampaignIntroScene', level: 'LevelScene', cinematic: 'CinematicScene', dialogue: 'DialogueScene' }[node.type];
  if (!node.id || node.sceneKey !== expectedScene) fail(`tipo/sceneKey inválido en índice ${index}`);
  if (node.type === 'level' && !node.levelConfigPath) fail(`falta levelConfigPath en ${node.id}`);
  if (node.type === 'cinematic' && !node.cinematicPath) fail(`falta cinematicPath en ${node.id}`);
  const previous = manifest.nodes[index - 1]; const next = manifest.nodes[index + 1];
  if (previous && previous.id !== ids[index - 1]) fail(`resolución anterior incorrecta para ${node.id}`);
  if (next && next.id !== ids[index + 1]) fail(`resolución siguiente incorrecta para ${node.id}`);
});
if (fs.existsSync(path.join(root, 'public/assets/campaign/campaign_flow.json'))) fail('campaign_flow.json no puede existir como fuente narrativa independiente');
const registeredIds = Object.keys(registry.nodes ?? {});
if (registry.registryVersion !== 1 || registeredIds.length !== 35 || registeredIds.some((id, i) => id !== ids[i])) fail('el registro de implementación debe cubrir los 35 nodos en orden canónico');
for (const node of manifest.nodes) {
  const asset = node.levelConfigPath ?? node.cinematicPath;
  const exists = !asset || fs.existsSync(path.join(root, 'public', asset));
  if (registry.nodes[node.id]?.implemented !== exists) fail(`estado de implementación desactualizado: ${node.id}`);
}
const forbiddenLegacy = ['lvl01-esc01-subsuelo-inicial', 'lvl10-esc03-combate-final-en-via-publica', 'lvl10-esc04-epilogo-final'];
if (ids.some((id) => forbiddenLegacy.includes(id))) fail('el flujo ejecutable contiene IDs legacy');
if (!manifest.nodes.some((node) => registry.nodes[node.id]?.implemented === false)) fail('la auditoría de bloqueo necesita al menos un nodo pendiente');
if (!process.exitCode) {
  console.log('[CampaignAudit] OK: manifiesto íntegro y única fuente de verdad (35 nodos).');
  console.log(`[CampaignAudit] assets terminados: ${manifest.nodes.filter((n) => registry.nodes[n.id].implemented).length}; pendientes bloqueantes: ${manifest.nodes.filter((n) => !registry.nodes[n.id].implemented).length}.`);
}
