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
const CHARACTER_FRAME_COUNT = 8;
const CHARACTER_SPRITE_SHEET_SUFFIX = '-sheet';

type HexColor = number;


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
      this.drawCharacterFrame(frameGraphics, frame, profile, frame * CHARACTER_FRAME_WIDTH);
    }

    const spriteSheetKey = `${profile.id}${CHARACTER_SPRITE_SHEET_SUFFIX}`;
    const rawSheetKey = `${spriteSheetKey}-raw`;
    frameGraphics.generateTexture(rawSheetKey, spriteSheetWidth, CHARACTER_FRAME_HEIGHT);
    frameGraphics.destroy();

    const rawTexture = this.textures.get(rawSheetKey);
    this.textures.addSpriteSheet(spriteSheetKey, rawTexture, {
      frameWidth: CHARACTER_FRAME_WIDTH,
      frameHeight: CHARACTER_FRAME_HEIGHT,
      endFrame: CHARACTER_FRAME_COUNT - 1
    });
    this.textures.remove(rawSheetKey);
  }

  private drawCharacterFrame(graphics: Phaser.GameObjects.Graphics, frame: number, profile: CharacterVisualProfile, offsetX = 0): void {
    const { palette } = profile;
    const bob = [1, 3, 5, 7].includes(frame) ? 1 : 0;
    const isRunFrame = [2, 3, 4, 5].includes(frame);
    const isShootFrame = frame === 6;
    const isHurtFrame = frame === 7;
    const isZombie = profile.faction === 'zombie';
    const silhouetteScale = profile.silhouette === 'broad' ? 1 : profile.silhouette === 'slim' ? -1 : 0;
    const torsoX = 10 - silhouetteScale;
    const torsoWidth = 12 + silhouetteScale * 2;
    const bodyY = 15 + bob;
    const legY = 27 + bob;

    this.fillPixelRect(graphics, offsetX + 12, 6 + bob, 8, 8, palette.skin);
    this.drawHair(graphics, profile, bob, offsetX);
    this.drawFacialHair(graphics, profile, bob, offsetX);
    this.fillPixelRect(graphics, offsetX + 13, 9 + bob, 1, 1, palette.eye);
    this.fillPixelRect(graphics, offsetX + 18, 9 + bob, 1, 1, palette.eye);

    this.fillPixelRect(graphics, offsetX + torsoX, bodyY, torsoWidth, 12, palette.torso);
    this.fillPixelRect(graphics, offsetX + torsoX, bodyY + 8, torsoWidth, 2, palette.factionBand);
    this.fillPixelRect(graphics, offsetX + torsoX, bodyY + 10, torsoWidth, 2, palette.accent);
    this.drawOutfitDetails(graphics, profile, torsoX + offsetX, bodyY, torsoWidth);
    this.drawGearDetails(graphics, profile, torsoX + offsetX, bodyY, torsoWidth);

    if (isShootFrame) {
      this.drawWeapon(graphics, profile, palette.weapon, bodyY + 3, true, offsetX);
      this.fillPixelRect(graphics, offsetX + torsoX - 2, bodyY + 4, 2, 7, palette.torso);
    } else if (isHurtFrame) {
      this.fillPixelRect(graphics, offsetX + torsoX - 2, bodyY + 5, 2, 6, palette.accent);
      this.fillPixelRect(graphics, offsetX + torsoX + torsoWidth, bodyY + 5, 2, 6, palette.accent);
      this.fillPixelRect(graphics, offsetX + torsoX - 1, bodyY + 1, torsoWidth + 2, 2, isZombie ? 0x7f1d1d : 0xdc2626);
    } else {
      this.fillPixelRect(graphics, offsetX + torsoX - 2, bodyY + 4, 2, 7, palette.torso);
      this.fillPixelRect(graphics, offsetX + torsoX + torsoWidth, bodyY + 4, 2, 7, palette.torso);
      this.drawWeapon(graphics, profile, palette.weapon, bodyY + 4, false, offsetX);
    }

    if (isRunFrame) {
      if (frame === 2 || frame === 4) {
        this.fillPixelRect(graphics, offsetX + 11, legY, 4, 12, palette.pants);
        this.fillPixelRect(graphics, offsetX + 17, legY + 2, 4, 10, palette.pants);
      } else {
        this.fillPixelRect(graphics, offsetX + 11, legY + 2, 4, 10, palette.pants);
        this.fillPixelRect(graphics, offsetX + 17, legY, 4, 12, palette.pants);
      }
    } else {
      this.fillPixelRect(graphics, offsetX + 11, legY, 4, 11, palette.pants);
      this.fillPixelRect(graphics, offsetX + 17, legY, 4, 11, palette.pants);
    }

    this.fillPixelRect(graphics, offsetX + 10, 39 + bob, 6, 2, palette.accent);
    this.fillPixelRect(graphics, offsetX + 16, 39 + bob, 6, 2, palette.accent);

    if (isZombie) {
      this.fillPixelRect(graphics, offsetX + 9, 21 + bob, 2, 2, 0x7f1d1d);
      this.fillPixelRect(graphics, offsetX + 20, 30 + bob, 2, 2, 0x7f1d1d);
    }
  }

  private drawHair(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, bob: number, offsetX = 0): void {
    const hairY = 3 + bob;

    if (profile.hairStyle === 'afro') {
      this.fillPixelRect(graphics, offsetX + 10, hairY, 12, 5, profile.palette.hair);
      return;
    }

    if (profile.hairStyle === 'long') {
      this.fillPixelRect(graphics, offsetX + 11, hairY, 10, 3, profile.palette.hair);
      this.fillPixelRect(graphics, offsetX + 10, hairY + 2, 2, 10, profile.palette.hair);
      this.fillPixelRect(graphics, offsetX + 20, hairY + 2, 2, 10, profile.palette.hair);
      return;
    }

    this.fillPixelRect(graphics, offsetX + 11, hairY, 10, 3, profile.palette.hair);
  }

  private drawFacialHair(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, bob: number, offsetX = 0): void {
    if (profile.facialHair === 'beard') {
      this.fillPixelRect(graphics, offsetX + 12, 12 + bob, 8, 2, 0x3f3f46);
      this.fillPixelRect(graphics, offsetX + 13, 14 + bob, 6, 1, 0x52525b);
      return;
    }

    if (profile.facialHair === 'stubble') {
      this.fillPixelRect(graphics, offsetX + 13, 13 + bob, 6, 1, 0x57534e);
    }
  }

  private drawOutfitDetails(
    graphics: Phaser.GameObjects.Graphics,
    profile: CharacterVisualProfile,
    torsoX: number,
    bodyY: number,
    torsoWidth: number
  ): void {
    if (profile.outfitStyle === 'shirt_tie') {
      this.fillPixelRect(graphics, torsoX + 4, bodyY + 2, 2, 7, 0x111827);
      this.fillPixelRect(graphics, torsoX, bodyY, torsoWidth, 2, 0xe5e7eb);
      return;
    }

    if (profile.outfitStyle === 'dress') {
      this.fillPixelRect(graphics, torsoX - 1, bodyY + 9, torsoWidth + 2, 3, profile.palette.torso);
      this.fillPixelRect(graphics, torsoX + 1, bodyY + 1, torsoWidth - 2, 2, 0xf8fafc);
      return;
    }

    if (profile.outfitStyle === 'uniform') {
      this.fillPixelRect(graphics, torsoX + 1, bodyY + 2, torsoWidth - 2, 2, 0x1f2937);
      this.fillPixelRect(graphics, torsoX + torsoWidth - 3, bodyY + 3, 2, 2, profile.palette.accent);
      return;
    }

    if (profile.outfitStyle === 'tactical') {
      this.fillPixelRect(graphics, torsoX + 1, bodyY + 1, torsoWidth - 2, 7, 0x1f2937);
      this.fillPixelRect(graphics, torsoX + 2, bodyY + 3, 2, 3, profile.palette.accent);
      this.fillPixelRect(graphics, torsoX + torsoWidth - 4, bodyY + 3, 2, 3, profile.palette.accent);
      return;
    }

    if (profile.outfitStyle === 'jacket') {
      this.fillPixelRect(graphics, torsoX + 1, bodyY + 2, 2, 9, 0x111827);
      this.fillPixelRect(graphics, torsoX + torsoWidth - 3, bodyY + 2, 2, 9, 0x111827);
      this.fillPixelRect(graphics, torsoX + 3, bodyY + 2, torsoWidth - 6, 1, profile.palette.accent);
    }
  }

  private drawGearDetails(
    graphics: Phaser.GameObjects.Graphics,
    profile: CharacterVisualProfile,
    torsoX: number,
    bodyY: number,
    torsoWidth: number
  ): void {
    if (profile.hasShoulderPads) {
      this.fillPixelRect(graphics, torsoX - 1, bodyY, 3, 2, 0x111827);
      this.fillPixelRect(graphics, torsoX + torsoWidth - 2, bodyY, 3, 2, 0x111827);
    }

    if (profile.hasBackpack) {
      this.fillPixelRect(graphics, torsoX + torsoWidth + 1, bodyY + 2, 3, 9, 0x374151);
      this.fillPixelRect(graphics, torsoX + torsoWidth, bodyY + 4, 1, 6, 0x9ca3af);
    }
  }

  private drawWeapon(
    graphics: Phaser.GameObjects.Graphics,
    profile: CharacterVisualProfile,
    color: HexColor,
    y: number,
    isAiming: boolean,
    offsetX = 0
  ): void {
    const anchorY = isAiming ? y : y + 1;
    const weaponStyle = profile.weaponStyle;
    const anchorX = profile.weaponCarry === 'shoulder' ? 19 : 22;

    if (weaponStyle === 'rifle') {
      this.fillPixelRect(graphics, offsetX + anchorX, anchorY, 10, 2, color);
      this.fillPixelRect(graphics, offsetX + anchorX + 2, anchorY + 2, 4, 1, 0x0f172a);
      this.fillPixelRect(graphics, offsetX + anchorX + 8, anchorY - 1, 2, 4, 0x111827);
      return;
    }

    if (weaponStyle === 'shotgun') {
      this.fillPixelRect(graphics, offsetX + anchorX, anchorY, 8, 3, color);
      this.fillPixelRect(graphics, offsetX + anchorX + 1, anchorY + 3, 3, 1, 0x78350f);
      this.fillPixelRect(graphics, offsetX + anchorX + 7, anchorY - 1, 1, 5, 0x111827);
      return;
    }

    if (weaponStyle === 'smg') {
      this.fillPixelRect(graphics, offsetX + anchorX + 1, anchorY, 6, 2, color);
      this.fillPixelRect(graphics, offsetX + anchorX + 2, anchorY + 2, 2, 2, 0x0f172a);
      this.fillPixelRect(graphics, offsetX + anchorX + 6, anchorY + 1, 1, 1, 0xe2e8f0);
      return;
    }

    if (weaponStyle === 'revolver') {
      this.fillPixelRect(graphics, offsetX + anchorX + 1, anchorY, 5, 2, color);
      this.fillPixelRect(graphics, offsetX + anchorX + 2, anchorY - 1, 2, 1, 0xe2e8f0);
      this.fillPixelRect(graphics, offsetX + anchorX + 2, anchorY + 2, 1, 2, 0x111827);
      return;
    }

    this.fillPixelRect(graphics, offsetX + anchorX + 1, anchorY, 4, 2, color);
    this.fillPixelRect(graphics, offsetX + anchorX + 2, anchorY + 2, 1, 2, 0x111827);
    this.fillPixelRect(graphics, offsetX + anchorX + 4, anchorY + 1, 1, 1, 0xe2e8f0);
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
    graphics.generateTexture('missing-character-sheet-raw', CHARACTER_FRAME_WIDTH, CHARACTER_FRAME_HEIGHT);
    const missingRawTexture = this.textures.get('missing-character-sheet-raw');
    this.textures.addSpriteSheet('missing-character-sheet', missingRawTexture, {
      frameWidth: CHARACTER_FRAME_WIDTH,
      frameHeight: CHARACTER_FRAME_HEIGHT,
      endFrame: 0
    });
    this.textures.remove('missing-character-sheet-raw');

    graphics.clear();
    graphics.fillStyle(0xffe08a, 1);
    graphics.fillTriangle(0, 8, 18, 4, 0, 0);
    graphics.fillStyle(0xfff7d1, 1);
    graphics.fillTriangle(2, 7, 12, 4, 2, 1);
    graphics.generateTexture('fx-muzzle-flash', 18, 9);
  }


}
