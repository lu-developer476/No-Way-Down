import type { CharacterSilhouette } from './characterVisuals';

export type CharacterVisualRole = 'player' | 'ally' | 'zombie';

export interface PixelPoint { x: number; y: number }

export interface PhysicsSilhouetteProfile {
  bodyWidth: number;
  bodyHeight: number;
  offsetX: number;
  offsetY: number;
  bounce: number;
  dragX: number;
}

export interface WeaponAlignmentProfile {
  heldScale: number;
  hudScale: number;
  carryOffset: PixelPoint;
  muzzleOffset: PixelPoint;
}

/**
 * The single source of truth for character/weapon presentation. Character x/y is
 * the point where the authored feet touch the floor; every attached visual is
 * positioned from that same point in whole world pixels.
 */
export const VISUAL_ALIGNMENT = {
  characterScale: { player: 1.5, ally: 1.5, zombie: 1.5 },
  visualOrigin: { x: 16, y: 42 },
  shadow: { player: { x: 0, y: 2 }, ally: { x: 0, y: 2 }, zombie: { x: 0, y: 2 } },
  label: { player: { x: 0, y: -68 }, ally: { x: 0, y: -68 }, zombie: { x: 0, y: -68 } },
  physics: {
    slim: { bodyWidth: 12, bodyHeight: 34, offsetX: 10, offsetY: 8, bounce: 0.04, dragX: 850 },
    standard: { bodyWidth: 16, bodyHeight: 34, offsetX: 8, offsetY: 8, bounce: 0.035, dragX: 900 },
    broad: { bodyWidth: 20, bodyHeight: 34, offsetX: 6, offsetY: 8, bounce: 0.025, dragX: 980 }
  } satisfies Record<CharacterSilhouette, PhysicsSilhouetteProfile>,
  weapons: {
    pistol: { heldScale: 1, hudScale: 1, carryOffset: { x: 8, y: -27 }, muzzleOffset: { x: 26, y: -28 } },
    revolver: { heldScale: 1, hudScale: 1, carryOffset: { x: 8, y: -27 }, muzzleOffset: { x: 27, y: -28 } },
    smg: { heldScale: 1, hudScale: 1, carryOffset: { x: 7, y: -27 }, muzzleOffset: { x: 29, y: -27 } },
    shotgun: { heldScale: 1, hudScale: 1, carryOffset: { x: 7, y: -27 }, muzzleOffset: { x: 37, y: -28 } },
    carbine: { heldScale: 1, hudScale: 1, carryOffset: { x: 7, y: -27 }, muzzleOffset: { x: 36, y: -28 } },
    sniper_rifle: { heldScale: 1, hudScale: 1, carryOffset: { x: 7, y: -27 }, muzzleOffset: { x: 42, y: -28 } },
    light_machine_gun: { heldScale: 1, hudScale: 1, carryOffset: { x: 7, y: -26 }, muzzleOffset: { x: 41, y: -27 } },
    knife: { heldScale: 1, hudScale: 1, carryOffset: { x: 7, y: -25 }, muzzleOffset: { x: 24, y: -25 } },
    machete: { heldScale: 1, hudScale: 1, carryOffset: { x: 7, y: -25 }, muzzleOffset: { x: 33, y: -26 } },
    sword: { heldScale: 1, hudScale: 1, carryOffset: { x: 7, y: -25 }, muzzleOffset: { x: 39, y: -26 } },
    tray_shield: { heldScale: 1, hudScale: 1, carryOffset: { x: 7, y: -25 }, muzzleOffset: { x: 25, y: -25 } }
  } satisfies Record<string, WeaponAlignmentProfile>
} as const;

export function wholePixel(value: number): number {
  return Math.round(value);
}

export function getPhysicsProfile(silhouette: CharacterSilhouette): PhysicsSilhouetteProfile {
  return VISUAL_ALIGNMENT.physics[silhouette];
}

export function getCharacterAttachmentPosition(
  role: CharacterVisualRole,
  attachment: 'shadow' | 'label',
  x: number,
  y: number
): PixelPoint {
  const offset = VISUAL_ALIGNMENT[attachment][role];
  return { x: wholePixel(x + offset.x), y: wholePixel(y + offset.y) };
}

export function getWeaponAlignment(weaponKey: string): WeaponAlignmentProfile {
  return VISUAL_ALIGNMENT.weapons[weaponKey as keyof typeof VISUAL_ALIGNMENT.weapons]
    ?? VISUAL_ALIGNMENT.weapons.pistol;
}

export function getFacingOffsetPosition(origin: PixelPoint, offset: PixelPoint, direction: 1 | -1): PixelPoint {
  return { x: wholePixel(origin.x + direction * offset.x), y: wholePixel(origin.y + offset.y) };
}
