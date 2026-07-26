import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

const canonicalManifestPath = path.join(
  projectRoot,
  'dist',
  'assets',
  'campaign',
  'canonical_campaign_manifest.json'
);
const implementationRegistryPath = path.join(projectRoot, 'dist', 'assets', 'campaign', 'campaign_implementation_registry.json');

if (!fs.existsSync(canonicalManifestPath)) {
  console.error('Error: no se encontró dist/assets/campaign/canonical_campaign_manifest.json después del build.');
  process.exit(1);
}

let canonicalManifest;
try {
  canonicalManifest = JSON.parse(fs.readFileSync(canonicalManifestPath, 'utf8'));
} catch (error) {
  console.error('Error: canonical_campaign_manifest.json generado no es JSON válido.', error);
  process.exit(1);
}

const canonicalIds = Array.isArray(canonicalManifest.nodes)
  ? canonicalManifest.nodes.map((node) => node?.id)
  : [];
if (
  canonicalIds.length !== 35
  || !canonicalIds.includes('lvl08-cin01-damian-infectado-y-suicidio')
  || !canonicalIds.includes('lvl10-cin02-cierre-duo-final-en-san-telmo')
) {
  console.error('Error: el manifiesto canónico generado está incompleto.', {
    nodeCount: canonicalIds.length
  });
  process.exit(1);
}

console.log('Verificación OK: manifiesto canónico generado con 35 nodos.');

if (!fs.existsSync(implementationRegistryPath)) {
  console.error('Error: no se encontró el registro de implementación en dist.');
  process.exit(1);
}
if (fs.existsSync(path.join(projectRoot, 'dist', 'assets', 'campaign', 'campaign_flow.json'))) {
  console.error('Error: el build contiene el flujo legacy independiente.');
  process.exit(1);
}
console.log('Verificación OK: registro de implementación presente y flujo legacy ausente.');
const registry = JSON.parse(fs.readFileSync(implementationRegistryPath, 'utf8'));
if (Object.keys(registry.nodes ?? {}).length !== 35 || canonicalIds.some((id) => registry.nodes[id]?.implemented !== true)) {
  console.error('Error: el build de producción exige implementación 35/35.');
  process.exit(1);
}
for (const node of canonicalManifest.nodes) {
  const asset = node.levelConfigPath ?? node.cinematicPath;
  if (node.type === 'campaignIntro') continue;
  if (!asset || !fs.existsSync(path.join(projectRoot, 'dist', asset))) {
    console.error(`Error: asset canónico no resoluble en producción: ${node.id}`);
    process.exit(1);
  }
}
console.log('Verificación OK: build de producción cerrado en 35/35, sin assets pendientes.');
