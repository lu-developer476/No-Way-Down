import Phaser from 'phaser';
import { visualTheme } from './visualTheme';
import {
  CharacterVisualProfile,
  getCharacterVisualsByFaction
} from '../config/characterVisuals';
import { getAudioManager } from '../audio/AudioManager';
import { getAllWeaponCatalogEntries } from '../config/weaponCatalog';
import { CharacterAnimations } from '../systems/CharacterAnimations';

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
    graphics.fillStyle(0x7f6250, 1);
    graphics.fillRect(0, 0, 128, 64);
    graphics.fillStyle(0xc8b18c, 1);
    graphics.fillRect(0, 0, 128, 10);
    graphics.fillStyle(0xdbc8a7, 0.85);
    graphics.fillRect(10, 14, 108, 34);
    graphics.fillStyle(0x111827, 0.95);
    graphics.fillRect(18, 18, 24, 24);
    graphics.fillRect(52, 18, 24, 24);
    graphics.fillRect(86, 18, 24, 24);
    graphics.fillStyle(0x67a7b7, 0.35);
    graphics.fillRect(20, 20, 20, 18);
    graphics.fillRect(54, 20, 20, 18);
    graphics.fillRect(88, 20, 20, 18);
    graphics.fillStyle(0x4a3428, 1);
    graphics.fillRect(8, 48, 112, 12);
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
    graphics.fillStyle(0x51463f, 1);
    graphics.fillRect(0, 0, 54, 98);
    graphics.fillStyle(0x152433, 1);
    graphics.fillRect(8, 8, 38, 28);
    graphics.fillStyle(0x8fd5e4, 0.6);
    graphics.fillRect(10, 10, 34, 24);
    graphics.fillStyle(0xb58b43, 1);
    graphics.fillRect(12, 46, 30, 10);
    graphics.fillStyle(0x1f2937, 1);
    graphics.fillRect(12, 58, 30, 28);
    graphics.fillStyle(0xe2e8f0, 1);
    graphics.fillRect(18, 64, 18, 4);
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
    graphics.fillStyle(0x8a6a43, 1);
    graphics.fillRect(0, 0, 40, 54);
    graphics.fillStyle(0x255f47, 1);
    graphics.fillRect(4, 6, 32, 16);
    graphics.fillStyle(0xf8fafc, 1);
    graphics.fillRect(10, 28, 20, 4);
    graphics.fillRect(8, 36, 24, 3);
    graphics.generateTexture('prop-recycling-box', 40, 54);

    graphics.clear();
    graphics.fillStyle(0x2b2f36, 1);
    graphics.fillRect(0, 0, 42, 82);
    graphics.fillStyle(0x86c8da, 1);
    graphics.fillRect(5, 8, 32, 24);
    graphics.fillStyle(0x0f172a, 1);
    graphics.fillRect(8, 36, 26, 8);
    graphics.fillStyle(0xc8b18c, 1);
    graphics.fillRect(18, 32, 4, 46);
    graphics.generateTexture('prop-info-screen', 42, 82);

    graphics.clear();
    graphics.fillStyle(0x7c6a5b, 1);
    graphics.fillRect(0, 0, 60, 40);
    graphics.fillStyle(0xc8d0d9, 1);
    graphics.fillRect(6, 4, 48, 16);
    graphics.fillStyle(0x4b5563, 1);
    graphics.fillRect(8, 24, 44, 6);
    graphics.fillStyle(0x1f2937, 1);
    graphics.fillRect(6, 32, 10, 6);
    graphics.fillRect(44, 32, 10, 6);
    graphics.generateTexture('prop-utility-cart', 60, 40);




    graphics.clear();
    graphics.fillStyle(0x5f3b25, 1);
    graphics.fillRoundedRect(0, 12, 118, 34, 5);
    graphics.fillStyle(0xc79b5f, 1);
    graphics.fillRoundedRect(4, 4, 110, 18, 4);
    graphics.fillStyle(0xf3d7a4, 0.85);
    graphics.fillRect(12, 8, 22, 5);
    graphics.fillRect(46, 8, 20, 5);
    graphics.fillRect(80, 8, 24, 5);
    graphics.fillStyle(0x2b1a12, 1);
    graphics.fillRect(12, 42, 8, 18);
    graphics.fillRect(96, 42, 8, 18);
    graphics.fillStyle(0x334155, 1);
    graphics.fillRect(24, 28, 18, 12);
    graphics.fillRect(76, 28, 18, 12);
    graphics.generateTexture('prop-dining-table', 118, 64);

    graphics.clear();
    graphics.fillStyle(0x3f2f25, 1);
    graphics.fillRect(0, 16, 144, 42);
    graphics.fillStyle(0xd6b680, 1);
    graphics.fillRect(0, 0, 144, 18);
    graphics.fillStyle(0x7c2d12, 1);
    graphics.fillRect(10, 22, 22, 28);
    graphics.fillStyle(0xe5e7eb, 1);
    graphics.fillRect(42, 24, 48, 5);
    graphics.fillRect(98, 24, 34, 5);
    graphics.fillStyle(0x111827, 0.9);
    graphics.fillRect(10, 52, 124, 8);
    graphics.generateTexture('prop-cafeteria-counter', 144, 64);

    graphics.clear();
    graphics.fillStyle(0x1f2937, 1);
    graphics.fillRoundedRect(0, 0, 44, 86, 4);
    graphics.fillStyle(0x7dd3fc, 0.55);
    graphics.fillRect(8, 10, 28, 38);
    graphics.fillStyle(0xef4444, 1);
    graphics.fillRect(10, 54, 24, 5);
    graphics.fillStyle(0xfacc15, 1);
    graphics.fillRect(12, 64, 20, 4);
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
    graphics.fillStyle(0x16a34a, 1);
    graphics.fillRoundedRect(8, 28, 28, 18, 4);
    graphics.fillStyle(0x94a3b8, 1);
    graphics.fillRect(20, 4, 4, 28);
    graphics.fillStyle(0xd1d5db, 1);
    graphics.fillRect(10, 0, 24, 6);
    graphics.fillStyle(0x22c55e, 1);
    graphics.fillRect(2, 42, 40, 12);
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
    graphics.fillStyle(0x7a5a42, 1);
    graphics.fillRect(0, 0, 112, 52);
    graphics.fillStyle(0xc9b38c, 1);
    graphics.fillRect(6, 6, 100, 8);
    graphics.fillStyle(0x2d3748, 1);
    graphics.fillRect(10, 14, 92, 6);
    graphics.fillRect(14, 22, 12, 24);
    graphics.fillRect(86, 22, 12, 24);
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

    const drawWeaponSilhouette = (weaponKey: string, color: number, width: number, height: number, barrel = 0, accent = 0x0f172a): void => {
      graphics.clear();
      graphics.fillStyle(color, 1);
      graphics.fillRect(2, Math.floor(height / 2) - 2, Math.max(6, width - 6), 4);
      if (barrel > 0) {
        graphics.fillRect(width - barrel - 1, Math.floor(height / 2) - 1, barrel, 2);
      }
      graphics.fillStyle(accent, 1);
      graphics.fillRect(1, Math.floor(height / 2) + 2, 3, Math.max(2, Math.floor(height / 3)));
      graphics.generateTexture(`weapon-${weaponKey}`, width, height);

      graphics.clear();
      graphics.fillStyle(0x0f172a, 0.88);
      graphics.fillRoundedRect(0, 0, width + 8, height + 8, 4);
      graphics.fillStyle(color, 1);
      graphics.fillRect(4, 4 + Math.floor(height / 2) - 2, Math.max(6, width - 6), 4);
      if (barrel > 0) {
        graphics.fillRect(width - barrel + 3, 4 + Math.floor(height / 2) - 1, barrel, 2);
      }
      graphics.fillStyle(0xe2e8f0, 1);
      graphics.fillRect(2, 2, width + 4, 1);
      graphics.generateTexture(`weapon-hud-${weaponKey}`, width + 8, height + 8);
    };

    getAllWeaponCatalogEntries().forEach((weapon) => {
      if (createdWeaponKeys.has(weapon.key)) {
        return;
      }

      const isLong = weapon.family === 'rifle' || weapon.family === 'shotgun' || weapon.key === 'light_machine_gun';
      const isMelee = weapon.isMelee || weapon.isDefensive;
      const width = isLong ? 22 : isMelee ? 18 : 14;
      const height = isLong ? 8 : 10;
      const barrel = isLong ? 8 : isMelee ? 4 : 3;
      drawWeaponSilhouette(weapon.key, weapon.projectileTint ?? 0xcbd5e1, width, height, barrel);
      createdWeaponKeys.add(weapon.key);
    });

    graphics.clear();
    graphics.fillStyle(0x7f1d1d, 1);
    graphics.fillRoundedRect(0, 0, 22, 12, 4);
    graphics.fillStyle(0xfde68a, 1);
    graphics.fillRect(4, 5, 14, 2);
    graphics.fillRect(10, 2, 2, 8);
    graphics.generateTexture('weapon-missing', 22, 12);

    graphics.clear();
    graphics.fillStyle(0x111827, 0.95);
    graphics.fillRoundedRect(0, 0, 30, 20, 4);
    graphics.fillStyle(0xf87171, 1);
    graphics.fillRoundedRect(4, 4, 22, 12, 3);
    graphics.fillStyle(0xfef3c7, 1);
    graphics.fillRect(8, 9, 14, 2);
    graphics.fillRect(14, 6, 2, 8);
    graphics.generateTexture('weapon-hud-missing', 30, 20);
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
