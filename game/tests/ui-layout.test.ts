import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateUiLayout, resolveDominantUiLayer, UI_LAYOUT } from '../src/scenes/uiLayout.ts';

const desktopResolutions = [
  [960, 540], [1280, 720], [1366, 768], [1600, 900], [1920, 1080]
] as const;

test('HUD cards stay inside every required desktop resolution', () => {
  for (const [width, height] of desktopResolutions) {
    const layout = calculateUiLayout(width, height);
    assert.ok(layout.protagonist.x >= UI_LAYOUT.margin);
    assert.ok(layout.party.y + UI_LAYOUT.partyHeight < layout.objective.y);
    assert.ok(layout.threat.x + UI_LAYOUT.threatWidth <= width - UI_LAYOUT.margin);
    assert.ok(layout.controls.x + UI_LAYOUT.controlsWidth <= width - UI_LAYOUT.margin);
    assert.ok(layout.objective.x >= UI_LAYOUT.margin);
    assert.ok(layout.objective.x + layout.objective.width <= width - UI_LAYOUT.margin);
    assert.ok(layout.dialogue.x >= UI_LAYOUT.margin);
    assert.ok(layout.dialogue.x + layout.dialogue.width <= width - UI_LAYOUT.margin);
  }
});

test('objective and interaction use separate vertical bands', () => {
  for (const [width, height] of desktopResolutions) {
    const layout = calculateUiLayout(width, height);
    assert.ok(layout.interaction.y <= layout.objective.y - UI_LAYOUT.gap);
  }
});

test('modal hierarchy always chooses exactly one dominant layer', () => {
  assert.equal(resolveDominantUiLayer({ fatal: true, transition: true, pause: true, dialogue: true }), 'fatal');
  assert.equal(resolveDominantUiLayer({ fatal: false, transition: true, pause: true, dialogue: true }), 'transition');
  assert.equal(resolveDominantUiLayer({ fatal: false, transition: false, pause: true, dialogue: true }), 'pause');
  assert.equal(resolveDominantUiLayer({ fatal: false, transition: false, pause: false, dialogue: true }), 'dialogue');
  assert.equal(resolveDominantUiLayer({ fatal: false, transition: false, pause: false, dialogue: false }), 'gameplay');
});
