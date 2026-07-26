import assert from 'node:assert/strict';
import test from 'node:test';
import { MIN_E2E_RESISTANCE_MS, resolveResistanceDuration } from '../src/config/e2eResistance.ts';

test('the resistance fixture changes only duration and preserves campaign state', () => {
  const campaign = Object.freeze({ flowNodeId: 'lvl01-esc01-comedor-resistencia', cursor: 1, objective: 'resistir' });
  assert.equal(resolveResistanceDuration(45_000, ''), 45_000);
  assert.equal(resolveResistanceDuration(45_000, '?e2eResistanceMs=250'), 250);
  assert.equal(resolveResistanceDuration(45_000, '?e2eResistanceMs=1'), MIN_E2E_RESISTANCE_MS);
  assert.deepEqual(campaign, { flowNodeId: 'lvl01-esc01-comedor-resistencia', cursor: 1, objective: 'resistir' });
});
