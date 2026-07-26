import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCharacterAttachmentPosition,
  getFacingOffsetPosition,
  getPhysicsProfile,
  getWeaponAlignment,
  VISUAL_ALIGNMENT
} from '../src/config/visualAlignment.ts';

const WEAPONS = ['pistol', 'revolver', 'smg', 'shotgun', 'carbine', 'sniper_rifle', 'light_machine_gun', 'knife', 'machete', 'sword', 'tray_shield'];

test('all silhouette bodies end at the authored foot line and remain inside the 32x48 frame', () => {
  for (const silhouette of ['slim', 'standard', 'broad'] as const) {
    const physics = getPhysicsProfile(silhouette);
    assert.equal(physics.offsetY + physics.bodyHeight, VISUAL_ALIGNMENT.visualOrigin.y);
    assert.ok(physics.offsetX >= 0);
    assert.ok(physics.offsetX + physics.bodyWidth <= 32);
  }
});

test('weapon scale, carry and muzzle alignment use whole pixels without accumulated multipliers', () => {
  for (const key of WEAPONS) {
    const weapon = getWeaponAlignment(key);
    assert.equal(weapon.heldScale, 1);
    assert.equal(weapon.hudScale, 1);
    assert.ok(Number.isInteger(weapon.carryOffset.x));
    assert.ok(Number.isInteger(weapon.carryOffset.y));
    assert.ok(Number.isInteger(weapon.muzzleOffset.x));
    assert.ok(Number.isInteger(weapon.muzzleOffset.y));
    assert.ok(weapon.muzzleOffset.x > weapon.carryOffset.x);
    assert.ok(weapon.muzzleOffset.y <= -25);
  }
});

test('carry and muzzle mirror exactly around the shared actor foot origin', () => {
  const origin = { x: 101.4, y: 220.4 };
  for (const key of WEAPONS) {
    const weapon = getWeaponAlignment(key);
    const right = getFacingOffsetPosition(origin, weapon.muzzleOffset, 1);
    const left = getFacingOffsetPosition(origin, weapon.muzzleOffset, -1);
    assert.equal(right.y, left.y);
    assert.equal(right.x + left.x, 2 * Math.round(origin.x));
    assert.ok(Number.isInteger(right.x) && Number.isInteger(right.y));
  }
});

test('shadow and label share whole-pixel player/ally anchors', () => {
  for (const role of ['player', 'ally'] as const) {
    const shadow = getCharacterAttachmentPosition(role, 'shadow', 50.2, 90.7);
    const label = getCharacterAttachmentPosition(role, 'label', 50.2, 90.7);
    assert.deepEqual(shadow, { x: 50, y: 93 });
    assert.deepEqual(label, { x: 50, y: 23 });
  }
});
