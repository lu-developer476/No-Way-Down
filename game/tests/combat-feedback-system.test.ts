import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const sourceUrl = new URL('../src/systems/CombatFeedbackSystem.ts', import.meta.url);
const source = (await readFile(sourceUrl, 'utf8'))
  .replace("import Phaser from 'phaser';", 'const Phaser = globalThis.__PHASER_TEST__;')
  .replace(/import \{ getWeaponCatalogEntry \}[^;]+;/, "const getWeaponCatalogEntry = () => ({ key: 'pistol', isMelee: false, isDefensive: false });")
  .replace(/import \{ getWeaponVisualRuntimeConfig \}[^;]+;/, 'const getWeaponVisualRuntimeConfig = () => ({ muzzleOffsetX: 0, muzzleOffsetY: 0 });')
  .replace(/import \{ getFacingOffsetPosition \}[^;]+;/, 'const getFacingOffsetPosition = (position) => position;');

(globalThis as typeof globalThis & { __PHASER_TEST__: unknown }).__PHASER_TEST__ = {
  Scenes: { Events: { PAUSE: 'pause' } },
  Math: { Distance: { Between: () => 999 } }
};

const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { CombatFeedbackSystem } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

class Events {
  listeners = new Map<string, Array<{ callback: () => void; context: unknown }>>();
  on(event: string, callback: () => void, context: unknown) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), { callback, context }]);
  }
  off(event: string, callback: () => void, context: unknown) {
    this.listeners.set(event, (this.listeners.get(event) ?? []).filter((entry) => entry.callback !== callback || entry.context !== context));
  }
  emit(event: string) {
    for (const entry of this.listeners.get(event) ?? []) entry.callback.call(entry.context);
  }
}

function fixture(world: { timeScale: number } | null = { timeScale: 1 }) {
  const callbacks: Array<() => void> = [];
  const timers: Array<{ removed: boolean; remove: () => void }> = [];
  const events = new Events();
  const scene = {
    events,
    physics: { world },
    sys: { isActive: () => true },
    registry: { get: () => false },
    time: {
      delayedCall: (_delay: number, callback: () => void) => {
        callbacks.push(callback);
        const timer = { removed: false, remove() { this.removed = true; } };
        timers.push(timer);
        return timer;
      }
    },
    tweens: { killed: [] as unknown[], killTweensOf(object: unknown) { this.killed.push(object); } }
  };
  const system = new CombatFeedbackSystem(scene, { midPoint: { x: 0, y: 0 }, shake() {} });
  return { system, scene, events, callbacks, timers };
}

test('destroy restores a valid physics world', () => {
  const { system, scene } = fixture({ timeScale: 0.18 });
  assert.doesNotThrow(() => system.destroy());
  assert.equal(scene.physics.world?.timeScale, 1);
});

test('destroy tolerates a null physics world', () => {
  const { system } = fixture(null);
  assert.doesNotThrow(() => system.destroy());
});

test('destroy is idempotent', () => {
  const { system } = fixture();
  system.destroy();
  assert.doesNotThrow(() => system.destroy());
});

test('destroy during hit-stop restores time and cancels its timer', () => {
  const { system, scene, timers } = fixture();
  system.playHitStop(40);
  assert.equal(scene.physics.world?.timeScale, 0.18);
  system.destroy();
  assert.equal(scene.physics.world?.timeScale, 1);
  assert.equal(timers[0].removed, true);
});

test('a hit-stop callback fired after destroy is inert', () => {
  const { system, scene, callbacks } = fixture();
  system.playHitStop(40);
  system.destroy();
  scene.physics.world = null;
  assert.doesNotThrow(() => callbacks[0]());
});

test('a general timer callback fired after destroy is inert', () => {
  const { system, callbacks } = fixture();
  let calls = 0;
  system.delay(10, () => { calls += 1; });
  system.destroy();
  assert.doesNotThrow(() => callbacks[0]());
  assert.equal(calls, 0);
});

test('PAUSE emitted after destroy has no effect', () => {
  const { system, scene, events } = fixture();
  system.destroy();
  scene.physics.world = null;
  assert.doesNotThrow(() => events.emit('pause'));
});

test('SHUTDOWN without active combat effects is safe', () => {
  const { system } = fixture(null);
  assert.doesNotThrow(() => system.destroy());
});

test('SHUTDOWN cancels projectiles, blood, flashes, impacts, tweens and timers', () => {
  const { system, scene } = fixture({ timeScale: 0.18 });
  const objects = Array.from({ length: 4 }, () => ({ active: true, scene, destroyed: false, destroy() { this.destroyed = true; this.scene = null; } }));
  system.activeShells.add(objects[0]);
  system.activeBloodDrops.add(objects[1]);
  system.activeImpacts.add(objects[2]);
  system.activeMuzzleFlashes.add(objects[3]);
  system.delay(50, () => assert.fail('destroyed timer ran'));

  assert.doesNotThrow(() => system.destroy());
  assert.ok(objects.every((object) => object.destroyed));
  assert.equal(scene.tweens.killed.length, 4);
});
