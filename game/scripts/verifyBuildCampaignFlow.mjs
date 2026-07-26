import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

const nestedCampaignFlowPath = path.join(projectRoot, 'dist', 'assets', 'campaign', 'campaign_flow.json');
const flatCampaignFlowPath = path.join(projectRoot, 'dist', 'assets', 'campaign_flow.json');
const canonicalManifestPath = path.join(
  projectRoot,
  'dist',
  'assets',
  'campaign',
  'canonical_campaign_manifest.json'
);

if (!fs.existsSync(flatCampaignFlowPath) && fs.existsSync(nestedCampaignFlowPath)) {
  fs.copyFileSync(nestedCampaignFlowPath, flatCampaignFlowPath);
  console.log('campaign_flow.json copiado a dist/assets/campaign_flow.json');
}

if (!fs.existsSync(flatCampaignFlowPath)) {
  console.error('Error: no se encontró dist/assets/campaign_flow.json después del build.');
  process.exit(1);
}

console.log('Verificación OK: dist/assets/campaign_flow.json existe.');

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
