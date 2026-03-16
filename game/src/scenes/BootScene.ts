import Phaser from 'phaser';
import { visualTheme } from './visualTheme';
import {
  CharacterVisualProfile,
  getCharacterVisualsByFaction
} from '../config/characterVisuals';
import { getAudioManager } from '../audio/AudioManager';
import { getAllWeaponCatalogEntries } from '../config/weaponCatalog';

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

    this.createCharacterSpriteSheets();

    const graphics = this.add.graphics();
    const { palette } = visualTheme;

    graphics.clear();
    graphics.fillStyle(palette.platformTop, 1);
    graphics.fillRect(0, 0, 64, 16);
    graphics.fillStyle(palette.platformEdge, 1);
    graphics.fillRect(0, 16, 64, 36);
    graphics.fillStyle(0x202839, 1);
    for (let x = 2; x < 64; x += 10) {
      graphics.fillRect(x, 24, 6, 2);
      graphics.fillRect(x + 3, 34, 4, 2);
    }
    graphics.fillStyle(0x465472, 1);
    for (let x = 4; x < 64; x += 8) {
      graphics.fillRect(x, 2, 5, 2);
    }
    graphics.generateTexture('ground-placeholder', 64, 52);

    this.createWeaponProjectileTextures(graphics);

    graphics.clear();
    graphics.fillStyle(palette.bullet, 1);
    graphics.fillRect(0, 4, 12, 4);
    graphics.fillStyle(0xd97706, 1);
    graphics.fillRect(9, 4, 3, 4);
    graphics.generateTexture('bullet-placeholder', 12, 12);

    graphics.clear();
    graphics.fillStyle(0x4b5563, 1);
    graphics.fillRect(0, 0, 32, 48);
    graphics.fillStyle(0x94a3b8, 1);
    for (let y = 3; y < 48; y += 8) {
      graphics.fillRect(5, y, 22, 2);
    }
    graphics.fillStyle(0x1f2937, 1);
    graphics.fillRect(12, 0, 8, 48);
    graphics.generateTexture('stair-placeholder', 32, 48);

    graphics.clear();
    graphics.fillStyle(0x8c806d, 1);
    graphics.fillRect(0, 0, 36, 96);
    graphics.fillStyle(0xb8ab95, 1);
    graphics.fillRect(4, 8, 28, 84);
    graphics.fillStyle(0x6b7280, 1);
    graphics.fillRect(0, 0, 36, 10);
    graphics.fillRect(0, 86, 36, 10);
    graphics.generateTexture('prop-stone-column', 36, 96);

    graphics.clear();
    graphics.fillStyle(0x6b3f2a, 1);
    graphics.fillRect(0, 0, 128, 56);
    graphics.fillStyle(0xb58b43, 1);
    graphics.fillRect(0, 0, 128, 8);
    graphics.fillStyle(0x334155, 1);
    graphics.fillRect(8, 14, 32, 20);
    graphics.fillRect(48, 14, 32, 20);
    graphics.fillRect(88, 14, 32, 20);
    graphics.generateTexture('prop-bank-counter', 128, 56);

    // "Cubículo grillado" del runtime: representa control de acceso (molinete/reja), no una caja gris genérica.
    graphics.clear();
    graphics.fillStyle(0x374151, 1);
    graphics.fillRect(0, 0, 72, 82);
    graphics.fillStyle(0x9ca3af, 1);
    for (let x = 8; x <= 64; x += 8) {
      graphics.fillRect(x, 8, 2, 66);
    }
    graphics.fillStyle(0x1f2937, 1);
    graphics.fillRect(0, 0, 72, 8);
    graphics.fillRect(0, 74, 72, 8);
    graphics.fillStyle(0xef4444, 1);
    graphics.fillRect(6, 4, 8, 4);
    graphics.generateTexture('prop-turnstile-grille', 72, 82);

    graphics.clear();
    graphics.fillStyle(0x334155, 1);
    graphics.fillRect(0, 0, 50, 90);
    graphics.fillStyle(0x86efac, 1);
    graphics.fillRect(8, 10, 34, 24);
    graphics.fillStyle(0x1f2937, 1);
    graphics.fillRect(10, 44, 30, 34);
    graphics.generateTexture('prop-atm', 50, 90);

    graphics.clear();
    graphics.fillStyle(0x475569, 1);
    graphics.fillRect(0, 0, 96, 28);
    graphics.fillStyle(0x94a3b8, 1);
    graphics.fillRect(8, 4, 80, 8);
    graphics.fillStyle(0x334155, 1);
    graphics.fillRect(8, 22, 10, 10);
    graphics.fillRect(78, 22, 10, 10);
    graphics.generateTexture('prop-bench', 96, 32);

    graphics.clear();
    graphics.fillStyle(0x16a34a, 1);
    graphics.fillRect(0, 0, 34, 42);
    graphics.fillStyle(0x0f172a, 1);
    graphics.fillRect(4, 6, 26, 30);
    graphics.generateTexture('prop-recycling-box', 34, 42);

    graphics.clear();
    graphics.fillStyle(0x1e293b, 1);
    graphics.fillRect(0, 0, 40, 78);
    graphics.fillStyle(0x60a5fa, 1);
    graphics.fillRect(5, 8, 30, 20);
    graphics.fillStyle(0x94a3b8, 1);
    graphics.fillRect(18, 28, 4, 44);
    graphics.generateTexture('prop-info-screen', 40, 78);

    graphics.clear();
    graphics.fillStyle(0x64748b, 1);
    graphics.fillRect(0, 0, 58, 36);
    graphics.fillStyle(0x334155, 1);
    graphics.fillRect(8, 4, 42, 14);
    graphics.fillStyle(0x9ca3af, 1);
    graphics.fillRect(4, 30, 10, 6);
    graphics.fillRect(44, 30, 10, 6);
    graphics.generateTexture('prop-utility-cart', 58, 36);

    graphics.destroy();

    this.createCharacterAnimations();

    this.scene.start('AssetPreloadScene');
  }

  private createCharacterSpriteSheets(): void {
    const protagonists = getCharacterVisualsByFaction('protagonist');
    const allies = getCharacterVisualsByFaction('ally');
    const zombies = getCharacterVisualsByFaction('zombie');

    protagonists.forEach((profile) => this.createCharacterSheet(profile));
    allies.forEach((profile) => this.createCharacterSheet(profile));
    zombies.forEach((profile) => this.createCharacterSheet(profile));
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

  private createCharacterAnimations(): void {
    const animationPrefixes = [
      ...getCharacterVisualsByFaction('protagonist'),
      ...getCharacterVisualsByFaction('ally'),
      ...getCharacterVisualsByFaction('zombie')
    ].map((profile) => profile.id);

    animationPrefixes.forEach((prefix) => {
      this.anims.create({
        key: `${prefix}-idle`,
        frames: this.anims.generateFrameNumbers(`${prefix}${CHARACTER_SPRITE_SHEET_SUFFIX}`, { start: 0, end: 1 }),
        frameRate: 4,
        repeat: -1
      });

      this.anims.create({
        key: `${prefix}-run`,
        frames: this.anims.generateFrameNumbers(`${prefix}${CHARACTER_SPRITE_SHEET_SUFFIX}`, { start: 2, end: 5 }),
        frameRate: 9,
        repeat: -1
      });

      this.anims.create({
        key: `${prefix}-shoot`,
        frames: this.anims.generateFrameNumbers(`${prefix}${CHARACTER_SPRITE_SHEET_SUFFIX}`, { start: 6, end: 6 }),
        frameRate: 1,
        repeat: 0
      });

      this.anims.create({
        key: `${prefix}-hurt`,
        frames: this.anims.generateFrameNumbers(`${prefix}${CHARACTER_SPRITE_SHEET_SUFFIX}`, { start: 7, end: 7 }),
        frameRate: 1,
        repeat: 0
      });
    });
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
    graphics.fillStyle(0xffe08a, 1);
    graphics.fillTriangle(0, 8, 18, 4, 0, 0);
    graphics.fillStyle(0xfff7d1, 1);
    graphics.fillTriangle(2, 7, 12, 4, 2, 1);
    graphics.generateTexture('fx-muzzle-flash', 18, 9);
  }


}
