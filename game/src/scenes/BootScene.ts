import Phaser from 'phaser';
import { visualTheme } from './visualTheme';
import {
  CharacterVisualProfile,
  getCharacterVisualsByFaction
} from '../config/characterVisuals';

const CHARACTER_FRAME_WIDTH = 32;
const CHARACTER_FRAME_HEIGHT = 48;
const CHARACTER_FRAME_COUNT = 8;

type HexColor = number;

interface CharacterPalette {
  skin: HexColor;
  torso: HexColor;
  pants: HexColor;
  accent: HexColor;
  eye: HexColor;
  hair: HexColor;
  factionBand: HexColor;
  weapon: HexColor;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
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

    graphics.destroy();

    this.createCharacterAnimations();

    this.scene.start('LoadingScene');
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
    this.fillPixelRect(graphics, 13, 9 + bob, 1, 1, palette.eye);
    this.fillPixelRect(graphics, 18, 9 + bob, 1, 1, palette.eye);

    this.fillPixelRect(graphics, torsoX, bodyY, torsoWidth, 12, palette.torso);
    this.fillPixelRect(graphics, torsoX, bodyY + 8, torsoWidth, 2, palette.factionBand);
    this.fillPixelRect(graphics, torsoX, bodyY + 10, torsoWidth, 2, palette.accent);

    if (isShootFrame) {
      this.drawWeapon(graphics, profile.weaponStyle, palette.weapon, bodyY + 3, true);
      this.fillPixelRect(graphics, torsoX - 2, bodyY + 4, 2, 7, palette.torso);
    } else if (isHurtFrame) {
      this.fillPixelRect(graphics, torsoX - 2, bodyY + 5, 2, 6, palette.accent);
      this.fillPixelRect(graphics, torsoX + torsoWidth, bodyY + 5, 2, 6, palette.accent);
      this.fillPixelRect(graphics, torsoX - 1, bodyY + 1, torsoWidth + 2, 2, isZombie ? 0x7f1d1d : 0xdc2626);
    } else {
      this.fillPixelRect(graphics, torsoX - 2, bodyY + 4, 2, 7, palette.torso);
      this.fillPixelRect(graphics, torsoX + torsoWidth, bodyY + 4, 2, 7, palette.torso);
      this.drawWeapon(graphics, profile.weaponStyle, palette.weapon, bodyY + 4, false);
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

  private drawWeapon(
    graphics: Phaser.GameObjects.Graphics,
    weaponStyle: CharacterVisualProfile['weaponStyle'],
    color: HexColor,
    y: number,
    isAiming: boolean
  ): void {
    const anchorY = isAiming ? y : y + 1;
    const length = weaponStyle === 'rifle' ? 8 : weaponStyle === 'shotgun' ? 7 : weaponStyle === 'smg' ? 6 : 5;
    const height = weaponStyle === 'shotgun' ? 3 : 2;

    this.fillPixelRect(graphics, 22, anchorY, length, height, color);

    if (weaponStyle === 'revolver') {
      this.fillPixelRect(graphics, 24, anchorY - 1, 2, 1, color);
    }

    if (weaponStyle === 'rifle' || weaponStyle === 'shotgun') {
      this.fillPixelRect(graphics, 22, anchorY + height, 2, 1, color);
    }
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
