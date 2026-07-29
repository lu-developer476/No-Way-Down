import Phaser from 'phaser';
import { visualTheme } from './visualTheme';
import {
  CharacterVisualProfile,
  getCharacterVisualsByFaction
} from '../config/characterVisuals';
import { getAudioManager } from '../audio/AudioManager';
import {
  getAllWeaponCatalogEntries,
  type WeaponCatalogEntry
} from '../config/weaponCatalog';
import { CharacterAnimations } from '../systems/CharacterAnimations';
import type { PickupType } from '../systems/PickupSystem';

const CHARACTER_FRAME_WIDTH = 32;
const CHARACTER_FRAME_HEIGHT = 48;
const CHARACTER_FRAME_COUNT = 9;
const CHARACTER_SPRITE_SHEET_SUFFIX = '-sheet';

type HexColor = number;

const CHARACTER_OUTLINE = 0x090b10;
const CHARACTER_DEEP_SHADOW = 0x111318;
const CHARACTER_HIGHLIGHT = 0xf8fafc;
const ZOMBIE_WOUND = 0x7f1d1d;
const ZOMBIE_DRY_BLOOD = 0x450a0a;
const PICKUP_TYPES: readonly PickupType[] = [
  'food_small', 'food_medium', 'food_large',
  'medkit_small', 'medkit_medium', 'medkit_large',
  'ammo_pistol', 'ammo_revolver', 'ammo_smg', 'ammo_shotgun',
  'ammo_carbine', 'ammo_sniper_rifle', 'ammo_light_machine_gun'
];

function getPickupTextureKey(type: PickupType): string {
  return `pickup-${type.replace(/_/g, '-')}`;
}

interface CharacterFramePose {
  bodyOffsetX: number;
  bodyOffsetY: number;
  headOffsetX: number;
  headOffsetY: number;
  leftArmOffsetX: number;
  leftArmOffsetY: number;
  rightArmOffsetX: number;
  rightArmOffsetY: number;
  leftLegOffsetX: number;
  leftLegOffsetY: number;
  rightLegOffsetX: number;
  rightLegOffsetY: number;
  lean: -1 | 0 | 1;
  aiming: boolean;
  hurt: boolean;
}

interface ProjectileSpriteRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
}

interface ProjectileSpriteTemplate {
  width: number;
  height: number;
  rects: ProjectileSpriteRect[];
}

const PROJECTILE_SPRITE_TEMPLATES: Record<string, ProjectileSpriteTemplate> = {
  pistol: {
    width: 10,
    height: 12,
    rects: [
      { x: 0, y: 5, width: 7, height: 2, color: 0xf8fafc },
      { x: 7, y: 5, width: 2, height: 2, color: 0xd97706 }
    ]
  },
  revolver: {
    width: 12,
    height: 12,
    rects: [
      { x: 0, y: 4, width: 8, height: 3, color: 0xf59e0b },
      { x: 8, y: 4, width: 2, height: 3, color: 0x78350f }
    ]
  },
  smg: {
    width: 10,
    height: 12,
    rects: [
      { x: 1, y: 5, width: 6, height: 2, color: 0x93c5fd },
      { x: 7, y: 5, width: 1, height: 2, color: 0x1e3a8a }
    ]
  },
  shotgun: {
    width: 10,
    height: 12,
    rects: [
      { x: 0, y: 4, width: 4, height: 4, color: 0xfde68a },
      { x: 4, y: 5, width: 2, height: 2, color: 0x92400e }
    ]
  },
  carbine: {
    width: 14,
    height: 12,
    rects: [
      { x: 0, y: 4, width: 10, height: 3, color: 0x86efac },
      { x: 10, y: 4, width: 2, height: 3, color: 0x14532d }
    ]
  },
  sniper_rifle: {
    width: 16,
    height: 12,
    rects: [
      { x: 0, y: 4, width: 12, height: 3, color: 0xe2e8f0 },
      { x: 12, y: 4, width: 2, height: 3, color: 0x334155 }
    ]
  }
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    if (new URLSearchParams(window.location.search).get('artGallery') === '1') { this.scene.start('ProductionArtGalleryScene'); return; }
    const audioManager = getAudioManager(this);
    this.registry.set('audioMuted', audioManager.isMuted());
    this.registry.set('audioVolume', audioManager.getVolumePercent());

    const { protagonists, allies, zombies } = this.createCharacterSpriteSheets();

    const graphics = this.add.graphics();
    const { palette } = visualTheme;

    graphics.clear();
    graphics.fillStyle(0x4f433c, 1);
    graphics.fillRect(0, 0, 64, 52);
    graphics.fillStyle(0x754342, 1);
    graphics.fillRect(0, 0, 64, 34);
    graphics.fillStyle(0x8f5e55, 0.55);
    for (let x = 0; x < 64; x += 16) {
      graphics.fillRect(x, 2, 12, 30);
    }
    graphics.fillStyle(0x26211f, 1);
    graphics.fillRect(0, 34, 64, 18);
    graphics.fillStyle(0xcdbb9b, 1);
    graphics.fillRect(0, 34, 64, 6);
    graphics.fillStyle(0xb58b43, 0.9);
    for (let x = 6; x < 64; x += 13) {
      graphics.fillRect(x, 37, 4, 1);
    }
    graphics.fillStyle(0x1b1715, 0.35);
    for (let x = 0; x < 64; x += 8) {
      graphics.fillRect(x, 43, 6, 2);
      graphics.fillRect(x + 2, 48, 4, 1);
    }
    graphics.generateTexture('ground-placeholder', 64, 52);

    this.createWeaponProjectileTextures(graphics);
    this.createWeaponSilhouetteTextures(graphics);
    this.createPickupTextures(graphics);
    this.createCombatEffectTextures(graphics);
    this.createAmbientVisualTextures(graphics);

    graphics.clear();
    graphics.fillStyle(palette.bullet, 1);
    graphics.fillRect(0, 4, 12, 4);
    graphics.fillStyle(0xd97706, 1);
    graphics.fillRect(9, 4, 3, 4);
    graphics.generateTexture('bullet-placeholder', 12, 12);

    graphics.clear();
    graphics.fillStyle(0x82715c, 1);
    graphics.fillRect(0, 0, 32, 48);
    graphics.fillStyle(0xd7ccb8, 1);
    for (let y = 4; y < 48; y += 8) {
      graphics.fillRect(3, y, 26, 3);
      graphics.fillRect(3, y - 2, 26, 1);
    }
    graphics.fillStyle(0xa58d6c, 1);
    graphics.fillRect(0, 0, 4, 48);
    graphics.fillRect(28, 0, 4, 48);
    graphics.fillStyle(0xb58b43, 0.9);
    graphics.fillRect(2, 1, 28, 2);
    graphics.generateTexture('stair-placeholder', 32, 48);

    graphics.clear();
    graphics.fillStyle(0x95836f, 1);
    graphics.fillRect(0, 0, 40, 108);
    graphics.fillStyle(0xcdbca3, 1);
    graphics.fillRect(6, 12, 28, 82);
    graphics.fillStyle(0xddd0bd, 1);
    graphics.fillRect(10, 16, 4, 74);
    graphics.fillRect(18, 16, 3, 74);
    graphics.fillRect(25, 16, 4, 74);
    graphics.fillStyle(0x766554, 1);
    graphics.fillRect(0, 0, 40, 12);
    graphics.fillRect(2, 92, 36, 16);
    graphics.fillStyle(0xb58b43, 0.75);
    graphics.fillRect(4, 4, 32, 2);
    graphics.generateTexture('prop-stone-column', 40, 108);

    graphics.clear();
    this.drawShadedRect(graphics, 3, 8, 122, 52, 0x79583f); this.drawOutlinedRect(graphics, 1, 3, 126, 10, 0xc8b18c); this.fillPixelRect(graphics, 6, 4, 116, 2, 0xead8b8);
    for (let x = 10; x <= 82; x += 36) { this.drawOutlinedRect(graphics, x, 16, 30, 29, 0x18232c); this.fillPixelRect(graphics, x + 2, 18, 26, 18, 0x6096a3); this.fillPixelRect(graphics, x + 4, 19, 4, 14, 0xa8d4df); this.drawOutlinedRect(graphics, x + 7, 47, 16, 8, 0x5c3c2c); }
    this.fillPixelRect(graphics, 5, 57, 118, 5, 0x2b211d); this.fillPixelRect(graphics, 4, 62, 120, 2, CHARACTER_DEEP_SHADOW);
    graphics.generateTexture('prop-bank-counter', 128, 64);

    graphics.clear();
    graphics.fillStyle(0x82684d, 1);
    graphics.fillRect(0, 0, 84, 88);
    graphics.fillStyle(0xc7a45b, 1);
    graphics.fillRect(0, 0, 84, 8);
    graphics.fillStyle(0x1f2937, 0.95);
    graphics.fillRect(10, 12, 64, 58);
    graphics.fillStyle(0xa8d4df, 0.35);
    graphics.fillRect(14, 16, 56, 50);
    graphics.fillStyle(0xcbd5e1, 1);
    graphics.fillRect(28, 8, 2, 72);
    graphics.fillRect(54, 8, 2, 72);
    graphics.fillStyle(0xef4444, 1);
    graphics.fillRect(24, 32, 36, 3);
    graphics.fillStyle(0x38bdf8, 1);
    graphics.fillRect(24, 26, 10, 3);
    graphics.fillRect(50, 26, 10, 3);
    graphics.generateTexture('prop-turnstile-grille', 84, 88);

    graphics.clear();
    this.drawShadedRect(graphics, 5, 3, 44, 92, 0x51463f); this.drawOutlinedRect(graphics, 9, 9, 36, 29, 0x152433); this.fillPixelRect(graphics, 12, 12, 30, 20, 0x5596a8); this.fillPixelRect(graphics, 14, 13, 12, 3, 0xb9e5eb);
    this.drawOutlinedRect(graphics, 12, 44, 30, 13, 0xb58b43); this.fillPixelRect(graphics, 16, 47, 22, 2, 0xead59d); for(let y=61;y<73;y+=4) for(let x=15;x<38;x+=6)this.fillPixelRect(graphics,x,y,3,2,0xcbd5e1); this.drawOutlinedRect(graphics,12,77,30,7,0x202832); this.fillPixelRect(graphics,16,87,22,3,0x111827); this.fillPixelRect(graphics,7,95,40,3,CHARACTER_DEEP_SHADOW);
    graphics.generateTexture('prop-atm', 54, 98);

    graphics.clear();
    graphics.fillStyle(0x4d3528, 1);
    graphics.fillRect(0, 0, 100, 18);
    graphics.fillStyle(0x7a5a42, 1);
    graphics.fillRect(6, 3, 88, 10);
    graphics.fillStyle(0xb58b43, 0.85);
    graphics.fillRect(10, 1, 80, 2);
    graphics.fillStyle(0x2a221d, 1);
    graphics.fillRect(10, 18, 10, 14);
    graphics.fillRect(80, 18, 10, 14);
    graphics.generateTexture('prop-bench', 100, 32);

    graphics.clear();
    this.drawShadedRect(graphics, 4, 7, 32, 44, 0x397357); this.drawOutlinedRect(graphics, 2, 3, 36, 10, 0x6e8b59); this.fillPixelRect(graphics,10,6,20,3,0x17251e); this.drawOutlinedRect(graphics,8,19,24,27,0x2d654b); this.fillPixelRect(graphics,11,22,18,2,0x73a885); this.fillPixelRect(graphics,17,27,6,3,0xf0f4e8); this.fillPixelRect(graphics,13,31,4,8,0xf0f4e8); this.fillPixelRect(graphics,23,31,4,8,0xf0f4e8); this.fillPixelRect(graphics,5,50,30,4,0x183428);
    graphics.generateTexture('prop-recycling-box', 40, 54);

    graphics.clear();
    this.drawOutlinedRect(graphics, 3, 4, 36, 35, 0x2b2f36); this.drawShadedRect(graphics, 6, 7, 30, 27, 0x4d9aae); this.fillPixelRect(graphics,9,9,16,3,0xb7e6ec); this.fillPixelRect(graphics,27,11,5,18,0x83c7d4); this.drawOutlinedRect(graphics,17,38,8,34,0x4b5563); this.fillPixelRect(graphics,19,40,2,27,0xaeb8c4); this.drawOutlinedRect(graphics,8,70,26,9,0x303944); this.fillPixelRect(graphics,5,79,32,3,CHARACTER_DEEP_SHADOW);
    graphics.generateTexture('prop-info-screen', 42, 82);

    graphics.clear();
    this.fillPixelRect(graphics,4,35,52,3,CHARACTER_DEEP_SHADOW); this.drawOutlinedRect(graphics,4,5,50,8,0xbac3cc); this.fillPixelRect(graphics,7,6,44,2,0xf1f5f9); this.drawShadedRect(graphics,7,14,46,15,0x768391); this.fillPixelRect(graphics,10,17,40,3,0xb8c1c9); this.drawOutlinedRect(graphics,1,2,6,25,0x65717d); this.fillPixelRect(graphics,2,2,10,3,0xd4d9df); this.drawOutlinedRect(graphics,8,28,8,9,0x303944); this.drawOutlinedRect(graphics,44,28,8,9,0x303944);
    graphics.generateTexture('prop-utility-cart', 60, 40);




    graphics.clear();
    this.fillPixelRect(graphics,8,60,102,3,CHARACTER_DEEP_SHADOW); this.drawShadedRect(graphics,4,7,110,17,0xb7834f); this.fillPixelRect(graphics,7,5,104,4,0xe1b97e); this.drawOutlinedRect(graphics,8,25,102,25,0x704328); for(let x=12;x<108;x+=32)this.drawOutlinedRect(graphics,x,28,26,15,0x855b39); this.drawOutlinedRect(graphics,11,49,9,12,0x35231b); this.drawOutlinedRect(graphics,98,49,9,12,0x35231b); this.fillPixelRect(graphics,19,55,80,4,0x503522); this.fillPixelRect(graphics,14,10,18,5,0xf0dfbd); this.drawOutlinedRect(graphics,45,10,18,7,0x6b7782); this.drawOutlinedRect(graphics,79,9,23,8,0xd6c9aa);
    graphics.generateTexture('prop-dining-table', 118, 64);

    graphics.clear();
    this.fillPixelRect(graphics,5,61,134,3,CHARACTER_DEEP_SHADOW); this.drawOutlinedRect(graphics,2,5,140,13,0xd6b680); this.fillPixelRect(graphics,5,6,134,3,0xf3dfba); this.drawOutlinedRect(graphics,7,18,130,39,0x58402e); for(let x=10;x<134;x+=31)this.drawShadedRect(graphics,x,29,27,24,0x76543a); this.drawOutlinedRect(graphics,10,19,118,11,0xaab4bd); for(let x=14;x<122;x+=27)this.drawOutlinedRect(graphics,x,21,22,7,0x8b5936); this.fillPixelRect(graphics,5,55,134,7,0x292019);
    graphics.generateTexture('prop-cafeteria-counter', 144, 64);

    graphics.clear();
    this.drawShadedRect(graphics, 3, 2, 38, 81, 0x273342); this.drawOutlinedRect(graphics, 6, 7, 25, 49, 0x17212c); this.fillPixelRect(graphics,8,9,21,45,0x467e91); this.fillPixelRect(graphics,10,10,4,40,0x93d9e4); for(let y=16;y<48;y+=10){this.fillPixelRect(graphics,9,y,19,2,0xb9dbe1); for(let x=10;x<27;x+=5)this.fillPixelRect(graphics,x,y+3,3,5,[0xef5350,0xf5c451,0x70b96a][(x+y)%3]);} this.drawOutlinedRect(graphics,33,12,6,32,0x171b22); this.fillPixelRect(graphics,35,15,2,11,0x55d5e8); this.drawOutlinedRect(graphics,9,62,25,11,0x141a22); this.fillPixelRect(graphics,13,66,17,3,0x090b10); this.fillPixelRect(graphics,5,82,34,4,CHARACTER_DEEP_SHADOW);
    graphics.generateTexture('prop-vending-machine', 44, 86);

    graphics.clear();
    graphics.fillStyle(0x2b211c, 1);
    graphics.fillRoundedRect(0, 0, 86, 42, 4);
    graphics.fillStyle(0xfbbf24, 1);
    graphics.fillRect(8, 8, 52, 4);
    graphics.fillStyle(0xe5e7eb, 1);
    graphics.fillRect(8, 18, 68, 2);
    graphics.fillRect(8, 27, 58, 2);
    graphics.generateTexture('prop-menu-board', 86, 42);

    graphics.clear();
    this.fillPixelRect(graphics,3,53,38,3,CHARACTER_DEEP_SHADOW); this.drawOutlinedRect(graphics,7,32,31,18,0xe3a91b); this.fillPixelRect(graphics,10,34,25,3,0xffcf3d); this.drawOutlinedRect(graphics,12,23,23,13,0x707b83); this.fillPixelRect(graphics,15,25,17,4,0xc8d0d5); this.fillPixelRect(graphics,27,3,3,23,0x9ba6ae); this.fillPixelRect(graphics,29,2,2,22,0xe0e6e9); this.fillPixelRect(graphics,4,44,8,7,0x93a7ad); this.fillPixelRect(graphics,1,48,12,4,0xc9d2d5); this.drawOutlinedRect(graphics,9,48,6,7,0x303944); this.drawOutlinedRect(graphics,31,48,6,7,0x303944);
    graphics.generateTexture('prop-mop-bucket', 44, 58);

    graphics.clear();
    graphics.fillStyle(0x111827, 1);
    graphics.fillRect(0, 0, 92, 156);
    graphics.fillStyle(0x1d4d64, 0.28);
    graphics.fillRect(8, 10, 76, 136);
    graphics.fillStyle(0xd8c7ab, 1);
    graphics.fillRect(0, 0, 92, 10);
    graphics.fillRect(0, 146, 92, 10);
    graphics.fillStyle(0x6d5f52, 1);
    graphics.fillRect(28, 0, 4, 156);
    graphics.fillRect(60, 0, 4, 156);
    graphics.generateTexture('prop-tall-window', 92, 156);

    graphics.clear();
    graphics.fillStyle(0x957447, 1);
    graphics.fillRect(0, 0, 96, 132);
    graphics.fillStyle(0xd7b77f, 1);
    graphics.fillRect(6, 6, 84, 120);
    graphics.fillStyle(0x4f2d18, 1);
    graphics.fillRect(12, 16, 32, 96);
    graphics.fillRect(52, 16, 32, 96);
    graphics.fillStyle(0xb9894c, 1);
    graphics.fillRect(46, 8, 4, 112);
    graphics.generateTexture('prop-bronze-door', 96, 132);

    graphics.clear();
    this.fillPixelRect(graphics,5,49,102,3,CHARACTER_DEEP_SHADOW); this.drawOutlinedRect(graphics,3,5,106,12,0xaeb7be); this.fillPixelRect(graphics,6,6,100,3,0xe5e9ec); this.drawOutlinedRect(graphics,10,8,39,7,0x56616b); this.drawOutlinedRect(graphics,62,8,39,7,0x68737d); this.drawOutlinedRect(graphics,11,17,8,31,0x4a5660); this.drawOutlinedRect(graphics,93,17,8,31,0x4a5660); this.fillPixelRect(graphics,18,38,76,5,0x65717b); this.fillPixelRect(graphics,21,39,70,2,0xc1c8ce);
    graphics.generateTexture('prop-service-table', 112, 52);

    graphics.destroy();

    CharacterAnimations.create(this, [
      ...protagonists.map((profile) => profile.id),
      ...allies.map((profile) => profile.id),
      ...zombies.map((profile) => profile.id)
    ]);

    this.scene.start('AssetPreloadScene');
  }

  private createCharacterSpriteSheets(): {
    protagonists: CharacterVisualProfile[];
    allies: CharacterVisualProfile[];
    zombies: CharacterVisualProfile[];
  } {
    const protagonists = getCharacterVisualsByFaction('protagonist');
    const allies = getCharacterVisualsByFaction('ally');
    const zombies = getCharacterVisualsByFaction('zombie');

    protagonists.forEach((profile) => this.createCharacterSheet(profile));
    allies.forEach((profile) => this.createCharacterSheet(profile));
    zombies.forEach((profile) => this.createCharacterSheet(profile));

    return { protagonists, allies, zombies };
  }

  private createCharacterSheet(profile: CharacterVisualProfile): void {
    const spriteSheetWidth = CHARACTER_FRAME_WIDTH * CHARACTER_FRAME_COUNT;
    const frameGraphics = this.add.graphics();

    for (let frame = 0; frame < CHARACTER_FRAME_COUNT; frame += 1) {
      this.drawCharacterFrame(
        frameGraphics,
        frame,
        profile,
        frame * CHARACTER_FRAME_WIDTH
      );
    }

    const spriteSheetKey = `${profile.id}${CHARACTER_SPRITE_SHEET_SUFFIX}`;
    frameGraphics.generateTexture(
      spriteSheetKey,
      spriteSheetWidth,
      CHARACTER_FRAME_HEIGHT
    );
    frameGraphics.destroy();

    const spriteSheetTexture = this.textures.get(spriteSheetKey);
    for (let frame = 0; frame < CHARACTER_FRAME_COUNT; frame += 1) {
      spriteSheetTexture.add(
        frame,
        0,
        frame * CHARACTER_FRAME_WIDTH,
        0,
        CHARACTER_FRAME_WIDTH,
        CHARACTER_FRAME_HEIGHT
      );
    }

    this.validateCharacterSpriteSheet(
      spriteSheetKey,
      CHARACTER_FRAME_COUNT
    );
  }

  private validateCharacterSpriteSheet(
    textureKey: string,
    expectedFrames: number
  ): void {
    if (!this.textures.exists(textureKey)) {
      throw new Error(
        `[BootScene] No se generó la spritesheet "${textureKey}".`
      );
    }

    const texture = this.textures.get(textureKey);
    const missingFrames: number[] = [];

    for (let frame = 0; frame < expectedFrames; frame += 1) {
      if (!texture.has(String(frame))) {
        missingFrames.push(frame);
      }
    }

    if (missingFrames.length > 0) {
      throw new Error(
        `[BootScene] La spritesheet "${textureKey}" no contiene los frames: ${missingFrames.join(', ')}.`
      );
    }
  }

  private getCharacterFramePose(frame: number, isZombie: boolean): CharacterFramePose {
    const base: CharacterFramePose = { bodyOffsetX: 0, bodyOffsetY: 0, headOffsetX: 0, headOffsetY: 0, leftArmOffsetX: 0, leftArmOffsetY: 0, rightArmOffsetX: 0, rightArmOffsetY: 0, leftLegOffsetX: 0, leftLegOffsetY: 0, rightLegOffsetX: 0, rightLegOffsetY: 0, lean: 0, aiming: false, hurt: false };
    switch (frame) {
      case 1: return { ...base, bodyOffsetY: 1, headOffsetY: 1, leftArmOffsetY: 1, rightArmOffsetY: 1 };
      case 2: return { ...base, bodyOffsetY: 1, leftArmOffsetX: 1, leftArmOffsetY: -1, rightArmOffsetX: -1, rightArmOffsetY: 2, leftLegOffsetX: -2, rightLegOffsetX: 2, rightLegOffsetY: 2 };
      case 3: return { ...base, bodyOffsetX: 1, leftArmOffsetX: -1, leftArmOffsetY: 2, rightArmOffsetX: 1, rightArmOffsetY: -1, leftLegOffsetX: 1, leftLegOffsetY: 2, rightLegOffsetX: -1 };
      case 4: return { ...base, bodyOffsetY: 1, leftArmOffsetX: -1, leftArmOffsetY: -1, rightArmOffsetX: 1, rightArmOffsetY: 2, leftLegOffsetX: 2, leftLegOffsetY: 2, rightLegOffsetX: -2 };
      case 5: return { ...base, bodyOffsetX: -1, leftArmOffsetX: 1, leftArmOffsetY: 2, rightArmOffsetX: -1, rightArmOffsetY: -1, leftLegOffsetX: -1, rightLegOffsetX: 1, rightLegOffsetY: 2 };
      case 6: return { ...base, bodyOffsetX: -1, rightArmOffsetX: 3, rightArmOffsetY: -1, leftArmOffsetX: 2, aiming: true, lean: -1 };
      case 7: return { ...base, bodyOffsetX: 2, headOffsetX: 2, headOffsetY: 1, leftArmOffsetX: -2, leftArmOffsetY: 2, rightArmOffsetX: 2, rightArmOffsetY: -1, leftLegOffsetX: 1, rightLegOffsetX: -1, lean: 1, hurt: true };
      default: return isZombie ? { ...base, bodyOffsetX: 1, headOffsetX: 2, headOffsetY: 2, leftArmOffsetX: -1, leftArmOffsetY: 2, rightArmOffsetX: 2, rightArmOffsetY: 3, lean: 1 } : base;
    }
  }

  private drawCharacterFrame(graphics: Phaser.GameObjects.Graphics, frame: number, profile: CharacterVisualProfile, offsetX = 0): void {
    const isZombie = profile.faction === 'zombie';
    if (frame === 8) { this.drawDeathFrame(graphics, profile, offsetX); return; }
    const base = this.getCharacterFramePose(frame, isZombie);
    const pose = isZombie && frame >= 2 && frame <= 5 ? { ...base, headOffsetX: base.headOffsetX + frame % 2, headOffsetY: base.headOffsetY + (frame === 3 ? 1 : 0), rightArmOffsetY: base.rightArmOffsetY + frame % 2 } : base;
    this.drawCharacterLegs(graphics, profile, pose, offsetX);
    this.drawCharacterTorso(graphics, profile, pose, offsetX);
    this.drawCharacterArms(graphics, profile, pose, offsetX);
    this.drawCharacterHead(graphics, profile, pose, offsetX);
    this.drawCharacterFrameDetails(graphics, profile, pose, frame, offsetX);
  }

  private shadeColor(color: number, amount: number): number {
    const red = Phaser.Math.Clamp(((color >> 16) & 0xff) + amount, 0, 255);
    const green = Phaser.Math.Clamp(((color >> 8) & 0xff) + amount, 0, 255);
    const blue = Phaser.Math.Clamp((color & 0xff) + amount, 0, 255);
    return (red << 16) | (green << 8) | blue;
  }

  private drawOutlinedRect(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, fillColor: number, outlineColor = CHARACTER_OUTLINE): void {
    this.fillPixelRect(graphics, x, y, width, height, outlineColor);
    if (width <= 2 || height <= 2) return;
    this.fillPixelRect(graphics, x + 1, y + 1, width - 2, height - 2, fillColor);
  }

  private drawShadedRect(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, color: number): void {
    this.drawOutlinedRect(graphics, x, y, width, height, color);
    if (width >= 4 && height >= 4) {
      this.fillPixelRect(graphics, x + 1, y + 1, Math.max(1, width - 3), 1, this.shadeColor(color, 28));
      this.fillPixelRect(graphics, x + width - 2, y + 2, 1, Math.max(1, height - 3), this.shadeColor(color, -32));
    }
  }

  private drawCharacterLegs(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, pose: CharacterFramePose, offsetX: number): void {
    const legWidth = profile.silhouette === 'broad' ? 5 : 4;
    const leftBaseX = profile.silhouette === 'slim' ? 11 : 10;
    const rightBaseX = profile.silhouette === 'broad' ? 18 : 17;
    const legY = 28 + pose.bodyOffsetY;
    const shoe = profile.faction === 'zombie' ? CHARACTER_DEEP_SHADOW : this.shadeColor(profile.palette.pants, -48);
    const lx = offsetX + leftBaseX + pose.bodyOffsetX + pose.leftLegOffsetX;
    const rx = offsetX + rightBaseX + pose.bodyOffsetX + pose.rightLegOffsetX;
    this.drawShadedRect(graphics, lx, legY + pose.leftLegOffsetY, legWidth, 10, profile.palette.pants);
    this.drawShadedRect(graphics, rx, legY + pose.rightLegOffsetY, legWidth, 10, profile.palette.pants);
    this.drawOutlinedRect(graphics, lx + (pose.leftLegOffsetX < 0 ? -1 : 0), legY + 9 + pose.leftLegOffsetY, legWidth + 2, 3, shoe);
    this.drawOutlinedRect(graphics, rx + (pose.rightLegOffsetX > 0 ? 1 : 0), legY + 9 + pose.rightLegOffsetY, legWidth + 2, 3, shoe);
  }

  private torsoMetrics(profile: CharacterVisualProfile, pose: CharacterFramePose, offsetX: number): { x: number; y: number; width: number } {
    const x = profile.silhouette === 'broad' ? 8 : profile.silhouette === 'slim' ? 11 : 10;
    const width = profile.silhouette === 'broad' ? 16 : profile.silhouette === 'slim' ? 10 : 12;
    return { x: offsetX + x + pose.bodyOffsetX, y: 15 + pose.bodyOffsetY, width };
  }

  private drawCharacterTorso(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, pose: CharacterFramePose, offsetX: number): void {
    const { x, y, width } = this.torsoMetrics(profile, pose, offsetX);
    const shoulder = profile.silhouette === 'broad' ? 1 : 0;
    this.drawShadedRect(graphics, x - shoulder, y, width + shoulder * 2, 13, profile.palette.torso);
    this.drawOutlinedRect(graphics, offsetX + 14 + pose.bodyOffsetX, y - 2, 4, 3, profile.palette.skin);
    this.fillPixelRect(graphics, x + 1, y + 2, 1, 5, this.shadeColor(profile.palette.torso, 42));
    this.fillPixelRect(graphics, x + width - 2, y + 3, 1, 6, this.shadeColor(profile.palette.torso, -45));
    this.fillPixelRect(graphics, x, y + 9, width, 2, profile.palette.factionBand);
    this.fillPixelRect(graphics, x, y + 11, width, 2, this.shadeColor(profile.palette.pants, -24));
    if (profile.silhouette === 'slim') { this.fillPixelRect(graphics, x, y + 10, 1, 2, CHARACTER_OUTLINE); this.fillPixelRect(graphics, x + width - 1, y + 10, 1, 2, CHARACTER_OUTLINE); }
    this.drawOutfitDetails(graphics, profile, x, y, width);
    this.drawGearDetails(graphics, profile, x, y, width);
  }

  private drawCharacterArms(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, pose: CharacterFramePose, offsetX: number): void {
    const { x, y: torsoY, width } = this.torsoMetrics(profile, pose, offsetX); const y = torsoY + 2; const skin = profile.palette.skin;
    if (pose.aiming) {
      this.drawShadedRect(graphics, offsetX + 19, y + pose.rightArmOffsetY, 6, 4, profile.palette.torso);
      this.drawShadedRect(graphics, offsetX + 23, y + pose.rightArmOffsetY, 4, 3, profile.palette.torso);
      this.drawOutlinedRect(graphics, offsetX + 26, y + pose.rightArmOffsetY, 3, 3, skin);
      this.drawShadedRect(graphics, x + 4, y + 3, 7, 3, profile.palette.torso); this.drawOutlinedRect(graphics, x + 10, y + 3, 3, 3, skin); return;
    }
    if (pose.hurt) {
      this.drawShadedRect(graphics, x - 5 + pose.leftArmOffsetX, y + pose.leftArmOffsetY, 5, 3, profile.palette.torso); this.drawOutlinedRect(graphics, x - 7 + pose.leftArmOffsetX, y + pose.leftArmOffsetY, 3, 3, skin);
      this.drawShadedRect(graphics, offsetX + 24, y + pose.rightArmOffsetY, 5, 3, profile.palette.torso); this.drawOutlinedRect(graphics, offsetX + 28, y + pose.rightArmOffsetY, 3, 3, skin); return;
    }
    const close = profile.silhouette === 'slim' ? 1 : 0; const drop = profile.faction === 'zombie' ? 2 : 0;
    const lx = x - 3 + close + pose.leftArmOffsetX; const rx = x + width - close + pose.rightArmOffsetX;
    this.drawShadedRect(graphics, lx, y + pose.leftArmOffsetY + drop, 4, 6, profile.palette.torso); this.drawShadedRect(graphics, lx - 1, y + 5 + pose.leftArmOffsetY + drop, 3, 5, profile.palette.torso); this.drawOutlinedRect(graphics, lx - 1, y + 9 + pose.leftArmOffsetY + drop, 3, 3, profile.faction === 'zombie' ? ZOMBIE_DRY_BLOOD : skin);
    this.drawShadedRect(graphics, rx, y + 1 + pose.rightArmOffsetY + drop, 4, 5, profile.palette.torso); this.drawShadedRect(graphics, rx + 2, y + 5 + pose.rightArmOffsetY + drop, 3, 5, profile.palette.torso); this.drawOutlinedRect(graphics, rx + 2, y + 9 + pose.rightArmOffsetY + drop, 3, 3, skin);
  }

  private drawCharacterHead(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, pose: CharacterFramePose, offsetX: number): void {
    const x = offsetX + 11 + pose.bodyOffsetX + pose.headOffsetX + pose.lean; const y = 4 + pose.headOffsetY; const zombie = profile.faction === 'zombie';
    this.drawOutlinedRect(graphics, x, y, 10, 11, profile.palette.skin); this.fillPixelRect(graphics, x + 1, y + 2, 1, 5, this.shadeColor(profile.palette.skin, 30)); this.fillPixelRect(graphics, x + 8, y + 2, 1, 7, this.shadeColor(profile.palette.skin, zombie ? -55 : -32));
    this.fillPixelRect(graphics, x - 1, y + 5, 2, 3, profile.palette.skin); this.fillPixelRect(graphics, x + 2, y + 5, 1, 1, zombie ? 0xfef3c7 : profile.palette.eye); this.fillPixelRect(graphics, x + 6, y + 5, 1, 1, zombie ? CHARACTER_HIGHLIGHT : profile.palette.eye);
    this.fillPixelRect(graphics, x + 5, y + 7, 1, 1, this.shadeColor(profile.palette.skin, -38)); this.fillPixelRect(graphics, x + 3, y + 9, 4, 1, zombie ? CHARACTER_DEEP_SHADOW : this.shadeColor(profile.palette.skin, -55)); this.fillPixelRect(graphics, x + 2, y + 2, 2, 1, CHARACTER_HIGHLIGHT); this.fillPixelRect(graphics, x + 1, y + 10, 8, 1, this.shadeColor(profile.palette.skin, -52));
    if (zombie) this.fillPixelRect(graphics, x + 7, y + 3, 2, 2, ZOMBIE_WOUND); this.drawHair(graphics, profile, x, y); this.drawFacialHair(graphics, profile, x, y);
  }

  private drawHair(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, x: number, y: number): void {
    const hair = profile.palette.hair;
    if (profile.hairStyle === 'afro') { this.fillPixelRect(graphics, x - 2, y - 2, 14, 3, CHARACTER_OUTLINE); this.fillPixelRect(graphics, x - 1, y - 3, 12, 4, hair); this.fillPixelRect(graphics, x - 2, y, 3, 4, hair); this.fillPixelRect(graphics, x + 9, y - 1, 3, 4, hair); }
    else if (profile.hairStyle === 'long') { this.fillPixelRect(graphics, x, y - 1, 10, 3, hair); this.fillPixelRect(graphics, x - 1, y + 1, 3, 11, hair); this.fillPixelRect(graphics, x + 8, y + 2, 3, 9, hair); this.fillPixelRect(graphics, x + 1, y + 10, 2, 3, hair); }
    else { this.fillPixelRect(graphics, x, y - 1, 10, 3, hair); this.fillPixelRect(graphics, x, y + 1, 2, 4, hair); this.fillPixelRect(graphics, x + 7, y + 1, 3, 1, hair); }
  }

  private drawFacialHair(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, x: number, y: number): void {
    if (profile.facialHair === 'beard') { this.fillPixelRect(graphics, x + 1, y + 8, 8, 3, 0x3f3f46); this.fillPixelRect(graphics, x + 3, y + 11, 4, 1, 0x52525b); }
    else if (profile.facialHair === 'stubble') this.fillPixelRect(graphics, x + 2, y + 9, 6, 1, 0x57534e);
  }

  private drawOutfitDetails(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, x: number, y: number, width: number): void {
    const center = x + Math.floor(width / 2);
    if (profile.outfitStyle === 'shirt_tie') { this.fillPixelRect(graphics, x + 1, y + 1, width - 2, 3, 0xe5e7eb); this.fillPixelRect(graphics, center - 1, y + 2, 2, 7, CHARACTER_DEEP_SHADOW); this.fillPixelRect(graphics, x + 1, y + 10, width - 2, 1, CHARACTER_OUTLINE); }
    else if (profile.outfitStyle === 'dress') { this.fillPixelRect(graphics, x - 1, y + 9, width + 2, 3, profile.palette.torso); this.fillPixelRect(graphics, x, y + 11, width, 1, CHARACTER_HIGHLIGHT); }
    else if (profile.outfitStyle === 'uniform') { this.fillPixelRect(graphics, x + 1, y + 2, width - 2, 2, 0x1f2937); this.fillPixelRect(graphics, x + width - 3, y + 3, 2, 2, profile.palette.accent); this.fillPixelRect(graphics, center, y + 5, 1, 4, CHARACTER_HIGHLIGHT); }
    else if (profile.outfitStyle === 'tactical') { this.fillPixelRect(graphics, x + 1, y + 1, width - 2, 7, 0x1f2937); this.fillPixelRect(graphics, x + 2, y + 4, 3, 3, profile.palette.accent); this.fillPixelRect(graphics, x + width - 5, y + 4, 3, 3, profile.palette.accent); }
    else { this.fillPixelRect(graphics, x + 1, y + 2, 2, 8, CHARACTER_DEEP_SHADOW); this.fillPixelRect(graphics, x + width - 3, y + 2, 2, 8, CHARACTER_DEEP_SHADOW); this.fillPixelRect(graphics, x + 3, y + 2, width - 6, 2, profile.palette.accent); this.fillPixelRect(graphics, center, y + 4, 1, 6, CHARACTER_HIGHLIGHT); }
  }

  private drawGearDetails(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, x: number, y: number, width: number): void {
    if (profile.hasShoulderPads) { this.drawOutlinedRect(graphics, x - 1, y, 4, 3, 0x374151); this.drawOutlinedRect(graphics, x + width - 3, y, 4, 3, 0x374151); }
    if (profile.hasBackpack) { const gap = profile.silhouette === 'broad' ? 2 : 1; this.drawShadedRect(graphics, x + width + gap, y + 2, 4, 10, 0x374151); this.fillPixelRect(graphics, x + width, y + 4, gap + 1, 6, 0x9ca3af); }
  }

  private drawCharacterFrameDetails(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, pose: CharacterFramePose, frame: number, offsetX: number): void {
    this.fillPixelRect(graphics, offsetX + 8 + pose.bodyOffsetX, 42 + pose.bodyOffsetY, profile.silhouette === 'broad' ? 17 : 16, 1, CHARACTER_DEEP_SHADOW);
    if (frame === 7) { this.fillPixelRect(graphics, offsetX + 11 + pose.bodyOffsetX, 17 + pose.bodyOffsetY, 3, 2, ZOMBIE_WOUND); this.fillPixelRect(graphics, offsetX + 8, 20, 1, 1, ZOMBIE_WOUND); this.fillPixelRect(graphics, offsetX + 27, 16, 1, 1, ZOMBIE_WOUND); }
    if (frame === 6) this.fillPixelRect(graphics, offsetX + 26, 17 + pose.rightArmOffsetY, 2, 1, CHARACTER_HIGHLIGHT);
    if (profile.faction === 'zombie') { this.fillPixelRect(graphics, offsetX + 12 + pose.bodyOffsetX, 21 + pose.bodyOffsetY, 2, 1, CHARACTER_OUTLINE); this.fillPixelRect(graphics, offsetX + 19 + pose.bodyOffsetX, 24 + pose.bodyOffsetY, 1, 2, ZOMBIE_DRY_BLOOD); this.fillPixelRect(graphics, offsetX + 11 + pose.leftLegOffsetX, 33 + pose.bodyOffsetY, 2, 1, ZOMBIE_DRY_BLOOD); this.fillPixelRect(graphics, offsetX + 20 + pose.rightLegOffsetX, 30 + pose.bodyOffsetY, 1, 1, CHARACTER_OUTLINE); }
  }

  private drawDeathFrame(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, offsetX: number): void {
    const y = 35; this.fillPixelRect(graphics, offsetX + 2, 44, 29, 1, CHARACTER_DEEP_SHADOW); this.drawOutlinedRect(graphics, offsetX + 3, y, 9, 9, profile.palette.skin); this.fillPixelRect(graphics, offsetX + 3, y - 1, 8, 3, profile.palette.hair); this.fillPixelRect(graphics, offsetX + 4, y + 4, 1, 1, profile.palette.eye);
    this.drawShadedRect(graphics, offsetX + 10, y - 1, 13, 9, profile.palette.torso); this.fillPixelRect(graphics, offsetX + 11, y + 4, 12, 2, profile.palette.factionBand); this.drawOutlinedRect(graphics, offsetX + 8, y + 7, 10, 3, profile.palette.torso);
    this.drawOutlinedRect(graphics, offsetX + 21, y, 8, 4, profile.palette.pants); this.drawOutlinedRect(graphics, offsetX + 22, y + 5, 8, 4, profile.palette.pants); this.drawOutlinedRect(graphics, offsetX + 28, y - 1, 4, 4, this.shadeColor(profile.palette.pants, -48)); this.drawOutlinedRect(graphics, offsetX + 29, y + 5, 3, 4, this.shadeColor(profile.palette.pants, -48));
    if (profile.faction === 'zombie') this.fillPixelRect(graphics, offsetX + 13, y + 1, 3, 2, ZOMBIE_DRY_BLOOD);
  }

  private fillPixelRect(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    color: HexColor
  ): void {
    graphics.fillStyle(color, 1);
    graphics.fillRect(x, y, width, height);
  }

  private createWeaponSilhouetteTextures(graphics: Phaser.GameObjects.Graphics): void {
    const createdWeaponKeys = new Set<string>();
    getAllWeaponCatalogEntries().forEach((weapon) => {
      if (createdWeaponKeys.has(weapon.key)) return;
      this.createHeldWeaponTexture(graphics, weapon);
      this.createHudWeaponTexture(graphics, weapon);
      createdWeaponKeys.add(weapon.key);
    });
    this.createMissingWeaponTextures(graphics);
  }

  private getHeldWeaponTextureSize(weapon: WeaponCatalogEntry): { width: number; height: number } {
    return ({ pistol: { width: 22, height: 14 }, revolver: { width: 24, height: 14 }, smg: { width: 28, height: 16 }, shotgun: { width: 38, height: 16 }, carbine: { width: 36, height: 16 }, sniper_rifle: { width: 44, height: 16 }, light_machine_gun: { width: 42, height: 18 }, knife: { width: 22, height: 14 }, machete: { width: 32, height: 16 }, sword: { width: 40, height: 16 }, tray_shield: { width: 24, height: 28 } } as Record<string, { width: number; height: number }>)[weapon.key] ?? { width: 28, height: 16 };
  }

  private createHeldWeaponTexture(g: Phaser.GameObjects.Graphics, weapon: WeaponCatalogEntry): void {
    const size = this.getHeldWeaponTextureSize(weapon); g.clear(); this.drawWeaponPixelArt(g, weapon, 0, 0); g.generateTexture(`weapon-${weapon.key}`, size.width, size.height);
  }

  private createHudWeaponTexture(g: Phaser.GameObjects.Graphics, weapon: WeaponCatalogEntry): void {
    const size = this.getHeldWeaponTextureSize(weapon); g.clear(); g.fillStyle(0x0b1018, 0.94); g.fillRoundedRect(0, 0, size.width + 8, size.height + 8, 4); g.lineStyle(1, 0x64748b, 0.65); g.strokeRoundedRect(1, 1, size.width + 6, size.height + 6, 3); this.drawWeaponPixelArt(g, weapon, 4, 4); g.generateTexture(`weapon-hud-${weapon.key}`, size.width + 8, size.height + 8);
  }

  private drawWeaponPixelArt(g: Phaser.GameObjects.Graphics, weapon: WeaponCatalogEntry, x: number, y: number): void {
    const tint = weapon.projectileTint ?? 0xaeb8c4, metal = this.shadeColor(tint, -35), light = this.shadeColor(tint, 48), wood = 0x7a4728;
    const r = (a:number,b:number,w:number,h:number,c:number) => this.drawOutlinedRect(g,x+a,y+b,w,h,c,CHARACTER_OUTLINE);
    const q = (a:number,b:number,w:number,h:number,c:number) => this.drawShadedRect(g,x+a,y+b,w,h,c);
    const p = (a:number,b:number,w:number,h:number,c:number) => this.fillPixelRect(g,x+a,y+b,w,h,c);
    switch (weapon.key) {
      case 'pistol': q(4,4,14,5,metal); r(16,5,5,3,tint); r(7,8,5,5,0x59483c); p(3,3,3,2,light); p(12,9,4,2,CHARACTER_OUTLINE); break;
      case 'revolver': r(3,5,8,4,metal); r(10,4,6,7,0xb77935); q(15,5,8,4,tint); r(7,9,5,5,wood); p(3,3,4,2,CHARACTER_OUTLINE); break;
      case 'smg': r(2,6,5,4,CHARACTER_OUTLINE); q(6,4,14,7,metal); r(19,6,8,3,tint); r(9,10,5,6,0x303943); r(15,10,4,4,0x4b5563); break;
      case 'shotgun': r(1,7,10,6,wood); q(10,6,9,6,metal); r(18,8,8,5,wood); r(25,6,13,3,tint); p(35,4,2,2,light); break;
      case 'carbine': r(1,7,8,5,0x4b5563); q(8,5,14,7,metal); r(21,6,9,5,0x556b46); r(29,6,7,3,tint); r(15,11,6,5,0x263527); p(23,3,3,2,light); break;
      case 'sniper_rifle': r(1,7,11,5,wood); q(11,6,11,6,metal); r(21,7,23,3,tint); r(12,2,13,4,CHARACTER_OUTLINE); p(14,3,9,1,light); p(19,12,2,4,CHARACTER_OUTLINE); p(28,10,2,5,CHARACTER_OUTLINE); break;
      case 'light_machine_gun': r(1,8,9,6,0x4b5563); q(9,6,16,8,metal); r(24,8,18,3,tint); r(13,13,9,5,0x7a5b2e); r(8,3,13,4,CHARACTER_OUTLINE); p(18,14,7,2,0xb77935); break;
      case 'knife': r(2,9,7,4,wood); r(8,7,3,6,0xb77935); p(10,7,9,4,metal); p(13,5,6,2,light); p(19,7,2,2,light); break;
      case 'machete': r(2,10,8,5,0x3f332d); r(9,8,3,7,0xb77935); p(11,5,17,7,metal); p(27,7,4,4,metal); p(13,10,15,2,light); break;
      case 'sword': r(1,11,7,4,wood); r(7,8,3,8,0xb77935); p(10,8,26,5,metal); p(15,6,20,2,light); p(35,8,4,3,light); p(2,9,3,2,0xb77935); break;
      case 'tray_shield': r(3,2,18,24,metal); r(5,4,14,20,tint); p(7,5,3,14,light); p(15,17,3,3,this.shadeColor(metal,-45)); r(9,10,7,4,CHARACTER_OUTLINE); break;
      default: q(3,5,19,7,tint); r(20,7,7,3,metal); r(6,11,5,5,CHARACTER_OUTLINE);
    }
  }

  private createMissingWeaponTextures(g: Phaser.GameObjects.Graphics): void {
    g.clear(); this.drawOutlinedRect(g,1,1,20,10,0x7f1d1d); this.fillPixelRect(g,5,5,12,2,0xfde68a); this.fillPixelRect(g,10,2,2,8,0xfde68a); g.generateTexture('weapon-missing',22,12);
    g.clear(); g.fillStyle(0x0b1018,0.96); g.fillRoundedRect(0,0,30,20,4); this.drawOutlinedRect(g,4,4,22,12,0x7f1d1d,0x94a3b8); this.fillPixelRect(g,8,9,14,2,0xfef3c7); this.fillPixelRect(g,14,6,2,8,0xfef3c7); g.generateTexture('weapon-hud-missing',30,20);
  }

  private createPickupTextures(g: Phaser.GameObjects.Graphics): void {
    const sizes: Record<PickupType,[number,number]> = { food_small:[18,14], food_medium:[24,18], food_large:[30,22], medkit_small:[20,16], medkit_medium:[26,20], medkit_large:[32,24], ammo_pistol:[22,16], ammo_revolver:[22,16], ammo_smg:[28,18], ammo_shotgun:[28,18], ammo_carbine:[28,18], ammo_sniper_rifle:[28,18], ammo_light_machine_gun:[32,20] };
    PICKUP_TYPES.forEach(type => { const [w,h]=sizes[type]; g.clear();
      if (type.startsWith('food_')) { const c=type==='food_small'?0xe3c980:type==='food_medium'?0xb96b3b:0x667f47; this.drawShadedRect(g,2,type==='food_small'?4:5,w-4,h-7,c);
        if(type==='food_small'){this.fillPixelRect(g,1,6,3,4,0xf8e7ba);this.fillPixelRect(g,w-4,6,3,4,0xf8e7ba);this.fillPixelRect(g,7,5,4,7,0xd34f3f);} else if(type==='food_medium'){this.fillPixelRect(g,5,7,14,3,0xf0d08b);this.fillPixelRect(g,6,11,6,3,0x6c8b45);this.fillPixelRect(g,13,11,5,3,0xa94732);} else {this.drawOutlinedRect(g,10,1,10,5,c);this.fillPixelRect(g,5,9,9,8,0xd6b765);this.fillPixelRect(g,16,9,9,8,0x8ba759);this.fillPixelRect(g,13,10,4,5,0xf3e6bc);}
      } else if(type.startsWith('medkit_')) { const i=type==='medkit_small'?2:1; this.drawShadedRect(g,i,4,w-i*2,h-6,0xe7dfd0); this.drawOutlinedRect(g,Math.floor(w/2)-4,0,8,5,0x6b7280);this.fillPixelRect(g,Math.floor(w/2)-2,6,4,h-6,0xc53030);this.fillPixelRect(g,Math.floor(w/2)-5,9,10,4,0xc53030);this.fillPixelRect(g,3,h-2,w-6,2,CHARACTER_DEEP_SHADOW);
      } else { const cs:Record<string,number>={ammo_pistol:0x52769a,ammo_revolver:0x825d3d,ammo_smg:0x596574,ammo_shotgun:0x8f3030,ammo_carbine:0x526340,ammo_sniper_rifle:0x66717d,ammo_light_machine_gun:0x6b5b36}; const c=cs[type]; this.drawShadedRect(g,1,4,w-2,h-5,c);this.fillPixelRect(g,3,5,w-6,2,this.shadeColor(c,45));this.fillPixelRect(g,3,9,w-6,3,0xc7a64b);
        if(type==='ammo_smg'){this.drawOutlinedRect(g,9,2,4,15,0x303943);this.drawOutlinedRect(g,16,2,4,15,0x303943);} else if(type==='ammo_shotgun'){for(let i=4;i<23;i+=6)this.drawOutlinedRect(g,i,7,4,9,0xb83232);} else if(type==='ammo_light_machine_gun'){for(let i=4;i<28;i+=4)this.fillPixelRect(g,i,13,3,5,0xd5a83d);} else for(let i=5;i<w-4;i+=7)this.fillPixelRect(g,i,7,type==='ammo_sniper_rifle'?5:3,7,type==='ammo_revolver'?0xd6a84b:0xcbd5e1);
      } g.generateTexture(getPickupTextureKey(type),w,h); });
    g.clear();this.drawOutlinedRect(g,1,2,22,16,0x651f28,0xfca5a5);this.fillPixelRect(g,10,5,4,8,0xfacc15);this.fillPixelRect(g,10,15,4,2,0xfacc15);g.generateTexture('pickup-missing',24,20);
  }

  private createCombatEffectTextures(g: Phaser.GameObjects.Graphics): void {
    const rect = (x: number, y: number, width: number, height: number, color: number): void => {
      g.fillStyle(color, 1); g.fillRect(x, y, width, height);
    };
    const texture = (key: string, width: number, height: number, pixels: Array<[number, number, number, number, number]>): void => {
      g.clear(); pixels.forEach(([x, y, w, h, color]) => rect(x, y, w, h, color)); g.generateTexture(key, width, height);
    };

    texture('fx-muzzle-pistol', 14, 10, [[0,4,3,2,0xf97316],[3,2,6,6,0xf59e0b],[5,3,7,4,0xfacc15],[6,4,8,2,0xffffff]]);
    texture('fx-muzzle-rifle', 20, 10, [[0,4,4,2,0xf97316],[3,2,9,6,0xf59e0b],[8,1,7,3,0xfacc15],[8,6,7,3,0xfacc15],[5,4,15,2,0xffffff]]);
    texture('fx-muzzle-shotgun', 24, 16, [[0,6,5,4,0xea580c],[4,3,9,10,0xf59e0b],[10,1,12,4,0xfacc15],[9,6,15,4,0xfacc15],[10,11,11,4,0xfacc15],[5,7,14,2,0xffffff]]);
    texture('fx-muzzle-heavy', 28, 14, [[0,6,5,2,0x991b1b],[3,4,8,6,0xea580c],[8,2,13,10,0xf59e0b],[15,4,13,6,0xfacc15],[7,6,18,2,0xffffff]]);
    texture('fx-shell-small', 5, 3, [[0,0,5,3,0x78350f],[1,0,3,2,0xd6a84b],[2,0,2,1,0xfde68a]]);
    texture('fx-shell-large', 7, 4, [[0,0,7,4,0x5c3214],[1,0,5,3,0xb77935],[2,0,4,1,0xfde68a],[0,3,7,1,0x3f2716]]);
    texture('fx-hit-flesh', 10, 10, [[4,4,3,3,0x450a0a],[1,2,2,2,0x991b1b],[7,1,2,2,0xb91c1c],[1,7,2,2,0x7f1d1d],[7,7,2,2,0x991b1b],[4,0,1,2,0xdc2626]]);
    texture('fx-hit-metal', 10, 10, [[4,0,2,10,0x94a3b8],[0,4,10,2,0x64748b],[2,2,6,6,0xfacc15],[4,3,2,4,0xffffff],[3,4,4,2,0xffffff]]);
    texture('fx-blood-drop', 4, 6, [[1,0,2,4,0x991b1b],[0,2,4,2,0x7f1d1d],[1,4,2,1,0xb91c1c],[1,5,1,1,0x450a0a]]);
    texture('fx-blood-mist', 12, 10, [[1,1,2,2,0x7f1d1d],[5,0,1,2,0xb91c1c],[9,2,2,1,0x991b1b],[3,4,2,2,0x991b1b],[7,5,1,2,0x7f1d1d],[10,7,2,2,0xb91c1c],[1,8,1,1,0x450a0a]]);
    texture('fx-impact-spark', 8, 8, [[3,0,2,8,0xf97316],[0,3,8,2,0xf59e0b],[2,2,4,4,0xfacc15],[3,3,2,2,0xffffff]]);
    texture('fx-death-shadow', 34, 10, [[7,0,20,2,0x000000],[3,2,28,2,0x000000],[0,4,34,3,0x000000],[4,7,26,2,0x000000],[10,9,14,1,0x000000]]);
  }

  private createAmbientVisualTextures(graphics: Phaser.GameObjects.Graphics): void {
    const rect = (x: number, y: number, width: number, height: number, color: number, alpha = 1): void => {
      graphics.fillStyle(color, alpha);
      graphics.fillRect(x, y, width, height);
    };

    graphics.clear();
    rect(3, 5, 90, 11, 0x090b10); rect(4, 6, 88, 8, 0x697780);
    rect(4, 6, 88, 2, 0xaab5bb); rect(4, 12, 88, 2, 0x38434b);
    [19, 73].forEach((x) => { rect(x, 3, 5, 14, 0x090b10); rect(x + 1, 4, 3, 12, 0x697780); });
    [12, 80].forEach((x) => { rect(x, 0, 8, 3, 0x38434b); rect(x + 2, 3, 4, 3, 0x090b10); });
    rect(56, 10, 8, 2, 0x865333); rect(60, 12, 5, 1, 0x865333);
    graphics.generateTexture('ambient-ceiling-pipe', 96, 18);

    graphics.clear();
    rect(2, 3, 50, 25, 0x090b10); rect(4, 5, 46, 20, 0x38434b); rect(7, 8, 40, 15, 0x11151d);
    for (let y = 9; y <= 19; y += 2) { rect(8, y, 38, 1, 0x697780); }
    rect(5, 5, 44, 2, 0xaab5bb); rect(5, 24, 44, 2, 0x090b10);
    [[5, 7], [47, 7], [5, 23], [47, 23]].forEach(([x, y]) => rect(x, y, 2, 2, 0xaab5bb));
    graphics.generateTexture('ambient-wall-vent', 54, 30);

    graphics.clear();
    rect(5, 0, 4, 4, 0x38434b); rect(45, 0, 4, 4, 0x38434b); rect(2, 3, 50, 16, 0x090b10);
    rect(4, 5, 46, 12, 0x17633a); rect(5, 6, 44, 1, 0x9ee6b8); rect(5, 16, 44, 1, 0x0d3d25);
    const glyphs: number[][] = [
      [7,8,5,1],[7,8,1,7],[7,11,4,1],[7,14,5,1],
      [14,9,1,6],[19,8,1,7],[15,8,4,1],[15,11,4,1],[15,14,4,1],
      [22,8,5,1],[22,8,1,7],[22,14,5,1],[29,8,1,7],[34,8,1,7],
      [37,8,5,1],[37,8,1,7],[37,11,5,1],[41,8,1,4],
      [44,10,4,1],[47,8,1,5],[47,12,3,1]
    ];
    glyphs.forEach(([x, y, w, h]) => rect(x, y, w, h, 0xd8ffe5));
    graphics.generateTexture('ambient-exit-sign', 54, 20);

    graphics.clear();
    rect(1, 8, 5, 4, 0x38434b); rect(5, 3, 17, 10, 0x090b10); rect(7, 4, 13, 7, 0x7f1d1d);
    rect(9, 5, 9, 4, 0xd85b32); rect(11, 5, 5, 2, 0xffb65c); rect(7, 11, 13, 2, 0x38434b);
    graphics.generateTexture('ambient-emergency-lamp', 24, 14);

    graphics.clear();
    const cableSegments = [[8,0,3,12],[9,10,3,13],[8,21,3,13],[6,32,3,14],[7,44,3,12],[9,54,3,10]];
    cableSegments.forEach(([x, y, w, h]) => { rect(x, y, w, h, 0x090b10); rect(x + 1, y, 1, h, 0x697780); });
    rect(7, 63, 6, 6, 0x090b10); rect(8, 64, 4, 4, 0x38434b); rect(9, 69, 1, 3, 0xaab5bb); rect(11, 69, 1, 2, 0x865333);
    graphics.generateTexture('ambient-hanging-cable', 18, 72);

    graphics.clear();
    rect(1, 2, 15, 9, 0x34373c); rect(2, 1, 13, 9, 0xd8d0b9); rect(13, 1, 3, 3, 0xeee8d8);
    rect(4, 5, 8, 1, 0x7f8587); rect(4, 8, 6, 1, 0x7f8587);
    graphics.generateTexture('ambient-paper-a', 18, 12);

    graphics.clear();
    rect(2, 1, 18, 8, 0x34373c); rect(1, 2, 17, 6, 0xc8c9c2); rect(17, 2, 3, 3, 0xe8e4d6);
    rect(5, 4, 9, 1, 0x747b80); rect(7, 6, 8, 1, 0x747b80);
    graphics.generateTexture('ambient-paper-b', 22, 10);

    graphics.clear(); rect(1, 1, 3, 3, 0xd8cda9, 0.16); rect(2, 2, 2, 2, 0xfff1c4, 0.9);
    graphics.generateTexture('ambient-dust-mote', 5, 5);

    graphics.clear();
    rect(3, 8, 5, 3, 0xcbd1d3, 0.45); rect(6, 5, 4, 4, 0xe2e6e6, 0.55);
    rect(9, 2, 3, 5, 0xcbd1d3, 0.4); rect(11, 7, 5, 3, 0xe2e6e6, 0.48); rect(7, 11, 5, 2, 0xbac2c5, 0.32);
    graphics.generateTexture('ambient-steam-puff', 18, 14);

    graphics.clear(); rect(1, 0, 2, 4, 0x285b75); rect(0, 2, 3, 3, 0x285b75); rect(1, 1, 1, 4, 0x8ed7ec); rect(1, 5, 1, 1, 0x285b75);
    graphics.generateTexture('ambient-water-drop', 3, 6);

    graphics.clear(); rect(0, 1, 4, 1, 0x5b9ead, 0.35); rect(4, 1, 20, 1, 0xc6f4f7, 0.85); rect(24, 1, 4, 1, 0x5b9ead, 0.35); rect(3, 2, 22, 1, 0x397783, 0.55);
    graphics.generateTexture('ambient-screen-scanline', 28, 4);
  }

  private createWeaponProjectileTextures(graphics: Phaser.GameObjects.Graphics): void {
    const uniqueVisualKeys = new Set<string>();

    getAllWeaponCatalogEntries().forEach((weapon) => {
      if (!weapon.visualKey.startsWith('projectile-')) {
        return;
      }
      if (uniqueVisualKeys.has(weapon.visualKey)) {
        return;
      }

      const template = PROJECTILE_SPRITE_TEMPLATES[weapon.projectileStyle] ?? PROJECTILE_SPRITE_TEMPLATES.pistol;
      if (!PROJECTILE_SPRITE_TEMPLATES[weapon.projectileStyle]) {
        console.warn(
          `[BootScene] Unknown projectile style "${weapon.projectileStyle}" for "${weapon.key}". Using "pistol" style.`
        );
      }

      graphics.clear();
      template.rects.forEach((rect) => {
        graphics.fillStyle(rect.color, 1);
        graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
      });
      graphics.generateTexture(weapon.visualKey, template.width, template.height);
      uniqueVisualKeys.add(weapon.visualKey);
    });

    graphics.clear();
    graphics.fillStyle(0x7f1d1d, 1);
    graphics.fillRoundedRect(0, 0, 14, 14, 4);
    graphics.fillStyle(0xfde68a, 1);
    graphics.fillRect(2, 6, 10, 2);
    graphics.fillRect(6, 2, 2, 10);
    graphics.generateTexture('projectile-missing', 14, 14);

    graphics.clear();
    graphics.fillStyle(0x7f1d1d, 1);
    graphics.fillRoundedRect(0, 0, CHARACTER_FRAME_WIDTH, CHARACTER_FRAME_HEIGHT, 6);
    graphics.fillStyle(0xfde68a, 1);
    graphics.fillRect(14, 8, 4, 24);
    graphics.fillRect(8, 18, 16, 4);
    graphics.fillStyle(0xf8fafc, 1);
    graphics.fillRect(10, 34, 12, 4);
    graphics.generateTexture(
      'missing-character-sheet',
      CHARACTER_FRAME_WIDTH,
      CHARACTER_FRAME_HEIGHT
    );

    const missingCharacterTexture = this.textures.get(
      'missing-character-sheet'
    );
    missingCharacterTexture.add(
      0,
      0,
      0,
      0,
      CHARACTER_FRAME_WIDTH,
      CHARACTER_FRAME_HEIGHT
    );

    this.validateCharacterSpriteSheet(
      'missing-character-sheet',
      1
    );

    graphics.clear();
    graphics.fillStyle(0xffe08a, 1);
    graphics.fillTriangle(0, 8, 18, 4, 0, 0);
    graphics.fillStyle(0xfff7d1, 1);
    graphics.fillTriangle(2, 7, 12, 4, 2, 1);
    graphics.generateTexture('fx-muzzle-flash', 18, 9);
  }


}
