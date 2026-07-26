import assert from 'node:assert/strict';
import test from 'node:test';
import manifestJson from '../public/assets/campaign/canonical_campaign_manifest.json' with { type: 'json' };
import { LEGACY_NODE_MIGRATIONS, migrateLegacyNodeId } from '../src/campaign/campaignCore.ts';

const canonicalIds = new Set((manifestJson as { nodes: Array<{ id: string }> }).nodes.map((node) => node.id));

test('migra todos los IDs del flujo legacy a IDs canónicos', () => {
  for (const [legacy, canonical] of Object.entries(LEGACY_NODE_MIGRATIONS)) {
    assert.equal(migrateLegacyNodeId(legacy, canonicalIds), canonical);
    assert.equal(canonicalIds.has(canonical), true);
  }
});

test('conserva IDs canónicos y rechaza IDs desconocidos en vez de ejecutar fallback', () => {
  assert.equal(migrateLegacyNodeId('lvl08-cin02-sacrificio-hernan-yamil', canonicalIds), 'lvl08-cin02-sacrificio-hernan-yamil');
  assert.equal(migrateLegacyNodeId('scene_key_legacy', canonicalIds), undefined);
});
