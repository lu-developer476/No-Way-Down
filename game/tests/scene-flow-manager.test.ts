import assert from 'node:assert/strict';
import test from 'node:test';
import manifestJson from '../public/assets/campaign/canonical_campaign_manifest.json' with { type: 'json' };
import registryJson from '../public/assets/campaign/campaign_implementation_registry.json' with { type: 'json' };
import { definitionFromManifest, isNodeImplemented, resolveNodeNeighbours, type CanonicalManifest, type ImplementationRegistry } from '../src/campaign/campaignCore.ts';

const manifest = manifestJson as unknown as CanonicalManifest;
const registry = registryJson as ImplementationRegistry;
const flow = definitionFromManifest(manifest);

test('SceneFlowManager usa los 35 nodos del manifiesto sin copiarlos', () => {
  assert.equal(flow.nodes, manifest.nodes);
  assert.equal(flow.nodes.length, 35);
});

test('SceneFlowManager resuelve anterior, actual y siguiente por orden canónico', () => {
  const resolved = resolveNodeNeighbours(flow.nodes, 'lvl02-esc01-hall-planta-baja');
  assert.equal(resolved.previous?.id, 'lvl01-cin01-cierre-contextual');
  assert.equal(resolved.current?.id, 'lvl02-esc01-hall-planta-baja');
  assert.equal(resolved.next?.id, 'lvl02-cin01-ascenso-al-segundo-piso');
  assert.deepEqual(resolveNodeNeighbours(flow.nodes, 'legacy-inexistente'), {});
});

test('SceneFlowManager bloquea un nodo cuyo asset no está implementado', () => {
  assert.equal(isNodeImplemented(registry, 'lvl01-esc01-comedor-resistencia'), false);
  assert.equal(isNodeImplemented(registry, 'lvl10-esc01-garage-busqueda-vehiculo'), true);
  assert.equal(isNodeImplemented(registry, 'id-desconocido'), false);
});
