import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHARACTERS_PANEL_PATH, MENU_BACKGROUND_PATH } from '../src/config/menuAssetPaths.ts';

test('AssetPreloadScene uses the original menu PNG paths exactly', () => {
  assert.equal(MENU_BACKGROUND_PATH, 'assets/images/NWD-menu.png');
  assert.equal(CHARACTERS_PANEL_PATH, 'assets/images/NWD-characters.png');

  const source = fs.readFileSync(new URL('../src/scenes/AssetPreloadScene.ts', import.meta.url), 'utf8');
  assert.match(source, /path: MENU_BACKGROUND_PATH/);
  assert.match(source, /path: CHARACTERS_PANEL_PATH/);
  assert.doesNotMatch(source, /NWD-(?:menu|characters)\.svg/);
});
