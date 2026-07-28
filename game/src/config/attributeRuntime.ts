import { CharacterAttributes } from './characterRuntime';

function clampMultiplier(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ratio(attributeValue: number): number {
  return clampMultiplier(attributeValue / 100, 0.01, 1);
}

export function getMovementSpeedMultiplier(attributes: CharacterAttributes): number {
  const mobility = ratio(attributes.agility) * 0.72 + ratio(attributes.stamina) * 0.28;
  return clampMultiplier(0.72 + mobility * 0.56, 0.72, 1.28);
}

export function getReloadTimeMultiplier(attributes: CharacterAttributes): number {
  const efficiency = ratio(attributes.reload_speed) * 0.7 + ratio(attributes.stamina) * 0.3;
  return clampMultiplier(1.3 - efficiency * 0.55, 0.75, 1.3);
}

export function getAccuracySpreadMultiplier(attributes: CharacterAttributes): number {
  const control = ratio(attributes.accuracy) * 0.62 + ratio(attributes.recoil_control) * 0.38;
  return clampMultiplier(1.45 - control * 0.8, 0.65, 1.45);
}

export function getMeleeDamageMultiplier(attributes: CharacterAttributes): number {
  const meleePower = ratio(attributes.melee_skill) * 0.74 + ratio(attributes.stamina) * 0.26;
  return clampMultiplier(0.68 + meleePower * 0.75, 0.68, 1.43);
}
