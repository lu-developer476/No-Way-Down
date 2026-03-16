import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

const nestedCampaignFlowPath = path.join(projectRoot, 'dist', 'assets', 'campaign', 'campaign_flow.json');
const flatCampaignFlowPath = path.join(projectRoot, 'dist', 'assets', 'campaign_flow.json');

if (!fs.existsSync(flatCampaignFlowPath) && fs.existsSync(nestedCampaignFlowPath)) {
  fs.copyFileSync(nestedCampaignFlowPath, flatCampaignFlowPath);
  console.log('campaign_flow.json copiado a dist/assets/campaign_flow.json');
}

if (!fs.existsSync(flatCampaignFlowPath)) {
  console.error('Error: no se encontró dist/assets/campaign_flow.json después del build.');
  process.exit(1);
}

console.log('Verificación OK: dist/assets/campaign_flow.json existe.');
