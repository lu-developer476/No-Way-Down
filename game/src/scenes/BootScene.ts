import Phaser from 'phaser';
import { visualTheme } from './visualTheme';
import {
  CharacterVisualProfile,
  getCharacterVisualsByFaction
} from '../config/characterVisuals';
import { getAudioManager } from '../audio/AudioManager';

const CHARACTER_FRAME_WIDTH = 32;
const CHARACTER_FRAME_HEIGHT = 48;
const CHARACTER_FRAME_COUNT = 8;

type HexColor = number;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const audioManager = getAudioManager(this);
    this.registry.set('audioMuted', audioManager.isMuted());
    this.registry.set('audioVolume', audioManager.getVolumePercent());

    this.createCharacterFrameTextures();

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

    graphics.clear();
    graphics.fillStyle(palette.bullet, 1);
    graphics.fillRect(0, 5, 7, 2);
    graphics.fillStyle(0xd97706, 1);
    graphics.fillRect(7, 5, 2, 2);
    graphics.generateTexture('projectile-pistol', 10, 12);

    graphics.clear();
    graphics.fillStyle(0xf59e0b, 1);
    graphics.fillRect(0, 4, 8, 3);
    graphics.fillStyle(0x78350f, 1);
    graphics.fillRect(8, 4, 2, 3);
    graphics.generateTexture('projectile-revolver', 12, 12);

    graphics.clear();
    graphics.fillStyle(0x93c5fd, 1);
    graphics.fillRect(1, 5, 6, 2);
    graphics.fillStyle(0x1e3a8a, 1);
    graphics.fillRect(7, 5, 1, 2);
    graphics.generateTexture('projectile-smg', 10, 12);

    graphics.clear();
    graphics.fillStyle(0xfde68a, 1);
    graphics.fillRect(0, 4, 4, 4);
    graphics.fillStyle(0x92400e, 1);
    graphics.fillRect(4, 5, 2, 2);
    graphics.generateTexture('projectile-shotgun', 10, 12);

    graphics.clear();
    graphics.fillStyle(0x86efac, 1);
    graphics.fillRect(0, 4, 10, 3);
    graphics.fillStyle(0x14532d, 1);
    graphics.fillRect(10, 4, 2, 3);
    graphics.generateTexture('projectile-carbine', 14, 12);

    graphics.clear();
    graphics.fillStyle(0xe2e8f0, 1);
    graphics.fillRect(0, 4, 12, 3);
    graphics.fillStyle(0x334155, 1);
    graphics.fillRect(12, 4, 2, 3);
    graphics.generateTexture('projectile-sniper_rifle', 16, 12);

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

  private createCharacterFrameTextures(): void {
    const protagonists = getCharacterVisualsByFaction('protagonist');
    const allies = getCharacterVisualsByFaction('ally');
    const zombies = getCharacterVisualsByFaction('zombie');

    protagonists.forEach((profile) => this.createCharacterFrames(profile));
    allies.forEach((profile) => this.createCharacterFrames(profile));
    zombies.forEach((profile) => this.createCharacterFrames(profile));
  }

  private createCharacterFrames(profile: CharacterVisualProfile): void {
    for (let frame = 0; frame < CHARACTER_FRAME_COUNT; frame += 1) {
      const frameGraphics = this.add.graphics();
      this.drawCharacterFrame(frameGraphics, frame, profile);
      frameGraphics.generateTexture(`${profile.id}-base-${frame}`, CHARACTER_FRAME_WIDTH, CHARACTER_FRAME_HEIGHT);
      frameGraphics.destroy();
    }
  }

  private drawCharacterFrame(graphics: Phaser.GameObjects.Graphics, frame: number, profile: CharacterVisualProfile): void {
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

    this.fillPixelRect(graphics, 12, 6 + bob, 8, 8, palette.skin);
    this.drawHair(graphics, profile, bob);
    this.drawFacialHair(graphics, profile, bob);
    this.fillPixelRect(graphics, 13, 9 + bob, 1, 1, palette.eye);
    this.fillPixelRect(graphics, 18, 9 + bob, 1, 1, palette.eye);

    this.fillPixelRect(graphics, torsoX, bodyY, torsoWidth, 12, palette.torso);
    this.fillPixelRect(graphics, torsoX, bodyY + 8, torsoWidth, 2, palette.factionBand);
    this.fillPixelRect(graphics, torsoX, bodyY + 10, torsoWidth, 2, palette.accent);
    this.drawOutfitDetails(graphics, profile, torsoX, bodyY, torsoWidth);
    this.drawGearDetails(graphics, profile, torsoX, bodyY, torsoWidth);

    if (isShootFrame) {
      this.drawWeapon(graphics, profile, palette.weapon, bodyY + 3, true);
      this.fillPixelRect(graphics, torsoX - 2, bodyY + 4, 2, 7, palette.torso);
    } else if (isHurtFrame) {
      this.fillPixelRect(graphics, torsoX - 2, bodyY + 5, 2, 6, palette.accent);
      this.fillPixelRect(graphics, torsoX + torsoWidth, bodyY + 5, 2, 6, palette.accent);
      this.fillPixelRect(graphics, torsoX - 1, bodyY + 1, torsoWidth + 2, 2, isZombie ? 0x7f1d1d : 0xdc2626);
    } else {
      this.fillPixelRect(graphics, torsoX - 2, bodyY + 4, 2, 7, palette.torso);
      this.fillPixelRect(graphics, torsoX + torsoWidth, bodyY + 4, 2, 7, palette.torso);
      this.drawWeapon(graphics, profile, palette.weapon, bodyY + 4, false);
    }

    if (isRunFrame) {
      if (frame === 2 || frame === 4) {
        this.fillPixelRect(graphics, 11, legY, 4, 12, palette.pants);
        this.fillPixelRect(graphics, 17, legY + 2, 4, 10, palette.pants);
      } else {
        this.fillPixelRect(graphics, 11, legY + 2, 4, 10, palette.pants);
        this.fillPixelRect(graphics, 17, legY, 4, 12, palette.pants);
      }
    } else {
      this.fillPixelRect(graphics, 11, legY, 4, 11, palette.pants);
      this.fillPixelRect(graphics, 17, legY, 4, 11, palette.pants);
    }

    this.fillPixelRect(graphics, 10, 39 + bob, 6, 2, palette.accent);
    this.fillPixelRect(graphics, 16, 39 + bob, 6, 2, palette.accent);

    if (isZombie) {
      this.fillPixelRect(graphics, 9, 21 + bob, 2, 2, 0x7f1d1d);
      this.fillPixelRect(graphics, 20, 30 + bob, 2, 2, 0x7f1d1d);
    }
  }

  private drawHair(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, bob: number): void {
    const hairY = 3 + bob;

    if (profile.hairStyle === 'afro') {
      this.fillPixelRect(graphics, 10, hairY, 12, 5, profile.palette.hair);
      return;
    }

    if (profile.hairStyle === 'long') {
      this.fillPixelRect(graphics, 11, hairY, 10, 3, profile.palette.hair);
      this.fillPixelRect(graphics, 10, hairY + 2, 2, 10, profile.palette.hair);
      this.fillPixelRect(graphics, 20, hairY + 2, 2, 10, profile.palette.hair);
      return;
    }

    this.fillPixelRect(graphics, 11, hairY, 10, 3, profile.palette.hair);
  }

  private drawFacialHair(graphics: Phaser.GameObjects.Graphics, profile: CharacterVisualProfile, bob: number): void {
    if (profile.facialHair === 'beard') {
      this.fillPixelRect(graphics, 12, 12 + bob, 8, 2, 0x3f3f46);
      this.fillPixelRect(graphics, 13, 14 + bob, 6, 1, 0x52525b);
      return;
    }

    if (profile.facialHair === 'stubble') {
      this.fillPixelRect(graphics, 13, 13 + bob, 6, 1, 0x57534e);
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
    isAiming: boolean
  ): void {
    const anchorY = isAiming ? y : y + 1;
    const weaponStyle = profile.weaponStyle;
    const anchorX = profile.weaponCarry === 'shoulder' ? 19 : 22;

    if (weaponStyle === 'rifle') {
      this.fillPixelRect(graphics, anchorX, anchorY, 10, 2, color);
      this.fillPixelRect(graphics, anchorX + 2, anchorY + 2, 4, 1, 0x0f172a);
      this.fillPixelRect(graphics, anchorX + 8, anchorY - 1, 2, 4, 0x111827);
      return;
    }

    if (weaponStyle === 'shotgun') {
      this.fillPixelRect(graphics, anchorX, anchorY, 8, 3, color);
      this.fillPixelRect(graphics, anchorX + 1, anchorY + 3, 3, 1, 0x78350f);
      this.fillPixelRect(graphics, anchorX + 7, anchorY - 1, 1, 5, 0x111827);
      return;
    }

    if (weaponStyle === 'smg') {
      this.fillPixelRect(graphics, anchorX + 1, anchorY, 6, 2, color);
      this.fillPixelRect(graphics, anchorX + 2, anchorY + 2, 2, 2, 0x0f172a);
      this.fillPixelRect(graphics, anchorX + 6, anchorY + 1, 1, 1, 0xe2e8f0);
      return;
    }

    if (weaponStyle === 'revolver') {
      this.fillPixelRect(graphics, anchorX + 1, anchorY, 5, 2, color);
      this.fillPixelRect(graphics, anchorX + 2, anchorY - 1, 2, 1, 0xe2e8f0);
      this.fillPixelRect(graphics, anchorX + 2, anchorY + 2, 1, 2, 0x111827);
      return;
    }

    this.fillPixelRect(graphics, anchorX + 1, anchorY, 4, 2, color);
    this.fillPixelRect(graphics, anchorX + 2, anchorY + 2, 1, 2, 0x111827);
    this.fillPixelRect(graphics, anchorX + 4, anchorY + 1, 1, 1, 0xe2e8f0);
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
        frames: [{ key: `${prefix}-base-0` }, { key: `${prefix}-base-1` }],
        frameRate: 4,
        repeat: -1
      });

      this.anims.create({
        key: `${prefix}-run`,
        frames: [
          { key: `${prefix}-base-2` },
          { key: `${prefix}-base-3` },
          { key: `${prefix}-base-4` },
          { key: `${prefix}-base-5` }
        ],
        frameRate: 9,
        repeat: -1
      });

      this.anims.create({
        key: `${prefix}-shoot`,
        frames: [{ key: `${prefix}-base-6` }],
        frameRate: 1,
        repeat: 0
      });

      this.anims.create({
        key: `${prefix}-hurt`,
        frames: [{ key: `${prefix}-base-7` }],
        frameRate: 1,
        repeat: 0
      });
    });
  }
}
