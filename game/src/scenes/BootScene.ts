import Phaser from 'phaser';
import { visualTheme } from './visualTheme';

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

    this.scene.start('GameScene');
  }

  private createCharacterFrameTextures(): void {
    this.createCharacterFrames('player-base', {
      skin: 0xfaccaa,
      torso: 0x2563eb,
      pants: 0x1e293b,
      accent: 0xfbbf24,
      eye: 0xffffff
    });

    this.createCharacterFrames('zombie-base', {
      skin: 0xa1c678,
      torso: 0x4a6e3e,
      pants: 0x3d2314,
      accent: 0xb43b3b,
      eye: 0xf7fac7
    });

    this.createCharacterFrames('ally-base', {
      skin: 0xfad7b9,
      torso: 0x14b8a6,
      pants: 0x0f172a,
      accent: 0xbae6fd,
      eye: 0xffffff
    });
  }

  private createCharacterFrames(prefix: string, palette: CharacterPalette): void {
    for (let frame = 0; frame < CHARACTER_FRAME_COUNT; frame += 1) {
      const frameGraphics = this.add.graphics();
      this.drawCharacterFrame(frameGraphics, frame, palette);
      frameGraphics.generateTexture(`${prefix}-${frame}`, CHARACTER_FRAME_WIDTH, CHARACTER_FRAME_HEIGHT);
      frameGraphics.destroy();
    }
  }

  private drawCharacterFrame(graphics: Phaser.GameObjects.Graphics, frame: number, palette: CharacterPalette): void {
    const bob = [1, 3, 5, 7].includes(frame) ? 1 : 0;
    const isRunFrame = [2, 3, 4, 5].includes(frame);
    const isShootFrame = frame === 6;
    const isHurtFrame = frame === 7;
    const bodyY = 15 + bob;
    const legY = 27 + bob;

    this.fillPixelRect(graphics, 12, 6 + bob, 8, 8, palette.skin);
    this.fillPixelRect(graphics, 13, 9 + bob, 1, 1, palette.eye);
    this.fillPixelRect(graphics, 18, 9 + bob, 1, 1, palette.eye);

    this.fillPixelRect(graphics, 10, bodyY, 12, 12, palette.torso);
    this.fillPixelRect(graphics, 10, bodyY + 10, 12, 2, palette.accent);

    if (isShootFrame) {
      this.fillPixelRect(graphics, 22, bodyY + 3, 6, 3, palette.accent);
      this.fillPixelRect(graphics, 8, bodyY + 4, 2, 7, palette.torso);
    } else if (isHurtFrame) {
      this.fillPixelRect(graphics, 8, bodyY + 5, 2, 6, palette.accent);
      this.fillPixelRect(graphics, 22, bodyY + 5, 2, 6, palette.accent);
      this.fillPixelRect(graphics, 9, bodyY + 1, 14, 2, 0xdc2626);
    } else {
      this.fillPixelRect(graphics, 8, bodyY + 4, 2, 7, palette.torso);
      this.fillPixelRect(graphics, 22, bodyY + 4, 2, 7, palette.torso);
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
    const animationPrefixes = ['player', 'zombie', 'ally'];

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
