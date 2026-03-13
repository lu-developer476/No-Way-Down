import Phaser from 'phaser';

export type CorridorLightDarknessLevel = 0 | 0.3 | 0.55;

export interface LightingSegment {
  index: number;
  startX: number;
  endX: number;
  darkness?: CorridorLightDarknessLevel;
  panelCount?: number;
}

export interface LightingSystemConfig {
  ceilingY: number;
  corridorTopY: number;
  corridorBottomY: number;
  panelColor?: number;
  panelGlowColor?: number;
  panelHeight?: number;
  panelInsetX?: number;
  panelSpacingY?: number;
  layerDepth?: number;
}

interface LightingSegmentRuntime {
  overlay: Phaser.GameObjects.Rectangle;
  panels: Phaser.GameObjects.Rectangle[];
  glows: Phaser.GameObjects.Rectangle[];
}

const DEFAULT_DARKNESS: CorridorLightDarknessLevel = 0.3;

export class LightingSystem {
  private readonly scene: Phaser.Scene;
  private readonly config: Required<LightingSystemConfig>;
  private readonly segmentRuntime = new Map<number, LightingSegmentRuntime>();
  private readonly renderObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, config: LightingSystemConfig) {
    this.scene = scene;
    this.config = {
      ceilingY: config.ceilingY,
      corridorTopY: config.corridorTopY,
      corridorBottomY: config.corridorBottomY,
      panelColor: config.panelColor ?? 0xf8fafc,
      panelGlowColor: config.panelGlowColor ?? 0x93c5fd,
      panelHeight: config.panelHeight ?? 12,
      panelInsetX: config.panelInsetX ?? 28,
      panelSpacingY: config.panelSpacingY ?? 22,
      layerDepth: config.layerDepth ?? 3
    };
  }

  buildFromSegments(segments: LightingSegment[]): void {
    this.clear();

    segments.forEach((segment) => {
      const segmentWidth = Math.max(8, segment.endX - segment.startX);
      const segmentCenterX = segment.startX + segmentWidth * 0.5;
      const darkness = segment.darkness ?? DEFAULT_DARKNESS;
      const panelCount = Math.max(1, segment.panelCount ?? this.resolvePanelCount(segmentWidth));

      const overlay = this.scene.add
        .rectangle(
          segmentCenterX,
          this.config.corridorTopY,
          segmentWidth,
          this.config.corridorBottomY - this.config.corridorTopY,
          0x000000,
          darkness
        )
        .setOrigin(0.5, 0)
        .setDepth(this.config.layerDepth);

      this.renderObjects.push(overlay);

      const panels: Phaser.GameObjects.Rectangle[] = [];
      const glows: Phaser.GameObjects.Rectangle[] = [];

      const usableWidth = Math.max(10, segmentWidth - this.config.panelInsetX * 2);
      const panelWidth = Math.min(usableWidth / panelCount - 14, 140);
      const startX = segment.startX + this.config.panelInsetX + panelWidth * 0.5;
      const stepX = panelCount > 1
        ? (usableWidth - panelWidth) / (panelCount - 1)
        : 0;

      for (let i = 0; i < panelCount; i += 1) {
        const x = startX + stepX * i;

        const panel = this.scene.add
          .rectangle(
            x,
            this.config.ceilingY,
            panelWidth,
            this.config.panelHeight,
            this.config.panelColor,
            0.92
          )
          .setOrigin(0.5, 0.5)
          .setDepth(this.config.layerDepth + 0.6);

        const glowStrength = darkness >= 0.55 ? 0.14 : 0.21;
        const glow = this.scene.add
          .rectangle(
            x,
            this.config.ceilingY + this.config.panelSpacingY,
            panelWidth * 0.88,
            this.config.panelSpacingY * 2,
            this.config.panelGlowColor,
            glowStrength
          )
          .setOrigin(0.5, 0)
          .setDepth(this.config.layerDepth + 0.4);

        panels.push(panel);
        glows.push(glow);
        this.renderObjects.push(panel, glow);
      }

      this.segmentRuntime.set(segment.index, { overlay, panels, glows });
    });
  }

  setSegmentDarkness(segmentIndex: number, darkness: CorridorLightDarknessLevel): boolean {
    const runtime = this.segmentRuntime.get(segmentIndex);
    if (!runtime) {
      return false;
    }

    runtime.overlay.setFillStyle(0x000000, darkness);

    const glowStrength = darkness >= 0.55 ? 0.14 : 0.21;
    runtime.glows.forEach((glow) => glow.setAlpha(glowStrength));
    return true;
  }

  clear(): void {
    this.segmentRuntime.clear();
    this.renderObjects.forEach((entry) => entry.destroy());
    this.renderObjects.length = 0;
  }

  private resolvePanelCount(segmentWidth: number): number {
    if (segmentWidth <= 220) {
      return 1;
    }

    if (segmentWidth <= 460) {
      return 2;
    }

    return 3;
  }
}
