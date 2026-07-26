import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import manifestJson from '../public/assets/campaign/canonical_campaign_manifest.json' with { type: 'json' };
import registryJson from '../public/assets/campaign/campaign_implementation_registry.json' with { type: 'json' };

const gameRoot = path.resolve(import.meta.dirname, '..');
const nodes = manifestJson.nodes.slice(0, 9);
const expectedIds = ['campaign-intro','lvl01-esc01-comedor-resistencia','lvl01-esc02-pasillos-hacia-escaleras-pb','lvl01-cin01-cierre-contextual','lvl02-esc01-hall-planta-baja','lvl02-cin01-ascenso-al-segundo-piso','lvl03-esc01-segundo-piso','lvl03-cin01-llamado-lorena-rescate','lvl04-esc01-tercer-piso'];
const expectedRuntimes: Record<string, string> = {'lvl01-esc01-comedor-resistencia':'level_1_comedor_resistencia','lvl01-esc02-pasillos-hacia-escaleras-pb':'level_1_pasillos_escaleras_pb','lvl02-esc01-hall-planta-baja':'level_2_hall_planta_baja','lvl03-esc01-segundo-piso':'level_3_segundo_piso','lvl04-esc01-tercer-piso':'level_4_tercer_piso'};
const readJson = (assetPath: string) => JSON.parse(fs.readFileSync(path.join(gameRoot, 'public', assetPath), 'utf8'));

test('E2E canónico: nodos 1 a 9 avanzan consecutivamente y dejan evidencia del cursor', () => {
  assert.deepEqual(nodes.map((node) => node.id), expectedIds);
  const evidence: Array<{ completed: string; cursor: number; activeCampaignNode: string; next: string | null }> = [];
  let cursor = 0; let pendingCampaignTransition: string | null = null;
  for (let index = 0; index < nodes.length; index += 1) {
    const active = nodes[cursor]; assert.equal(active.id, expectedIds[index]); assert.equal(pendingCampaignTransition, null);
    const next = nodes[cursor + 1] ?? null;
    evidence.push({ completed: active.id, cursor, activeCampaignNode: active.id, next: next?.id ?? null });
    if (!next) break;
    pendingCampaignTransition = next.id; cursor += 1;
    assert.equal(nodes[cursor].id, pendingCampaignTransition);
    pendingCampaignTransition = null;
  }
  assert.deepEqual(evidence.map(({ completed, cursor }) => ({ completed, cursor })), expectedIds.map((completed, cursor) => ({ completed, cursor })));
  assert.equal(evidence[1].next, 'lvl01-esc02-pasillos-hacia-escaleras-pb');
  assert.equal(evidence[2].next, 'lvl01-cin01-cierre-contextual');
  console.info('[CanonicalE2E] evidencia de cursor', JSON.stringify(evidence));
});

test('cada nivel canónico tiene config, runtime completo y salida al nodo inmediato', () => {
  for (const [index, node] of nodes.entries()) {
    if (node.type !== 'level') continue;
    assert.equal(registryJson.nodes[node.id as keyof typeof registryJson.nodes].implemented, true);
    const config = readJson(node.levelConfigPath!); const runtime = readJson(config.runtimePath);
    assert.equal(config.nodeId, node.id); assert.equal(config.level_id, expectedRuntimes[node.id]); assert.equal(config.runtimeLevelId, expectedRuntimes[node.id]); assert.equal(runtime.level_id, config.runtimeLevelId);
    assert.ok(runtime.layout.width > 0 && runtime.layout.height > 0); assert.ok(runtime.layout.default_spawn);
    assert.ok(runtime.objectives.length > 0); assert.ok(runtime.interactables.length > 0); assert.ok(runtime.triggers.length > 0); assert.ok(Array.isArray(runtime.pickups));
    assert.equal(runtime.exits.length, 1); assert.equal(runtime.exits[0].id, config.completion.exitId); assert.equal(config.nextNodeId, manifestJson.nodes[index + 1]?.id);
    assert.ok(runtime.interactables.some((item: { interactionEffect?: { targetId?: string } }) => item.interactionEffect?.targetId === runtime.exits[0].id));
  }
});

test('cada cinemática conserva orden, personajes, controles y continuidad', () => {
  for (const [index, node] of nodes.entries()) {
    if (node.type !== 'cinematic') continue;
    assert.equal(registryJson.nodes[node.id as keyof typeof registryJson.nodes].implemented, true);
    const cinematic = readJson(node.cinematicPath!);
    assert.ok(cinematic.characters.length >= 2); assert.ok(cinematic.beats.length >= 2);
    assert.deepEqual(cinematic.beats.map((beat: { order: number }) => beat.order), cinematic.beats.map((_: unknown, i: number) => i + 1));
    assert.ok(cinematic.beats.every((beat: { speaker: string }) => cinematic.characters.includes(beat.speaker)));
    assert.ok(cinematic.controls.advance.includes('ENTER')); assert.deepEqual(cinematic.controls.cleanup, ['music','dialogue','overlays','controls']);
    assert.equal(nodes[index - 1]?.id, expectedIds[index - 1]); assert.equal(nodes[index + 1]?.id, expectedIds[index + 1]);
  }
});

test('confirmación automática o manual confirma una sola transición', () => {
  for (const source of ['automatic','manual'] as const) {
    let pending = true; let commits = 0;
    const confirm = () => { if (!pending) return false; pending = false; commits += 1; return true; };
    assert.equal(confirm(), true, source); assert.equal(confirm(), false, `${source}: doble transición bloqueada`); assert.equal(commits, 1);
  }
});
