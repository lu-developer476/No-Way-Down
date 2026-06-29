import Phaser from 'phaser';

export const RETRO_PIXEL_FONT = '"Courier New", monospace';
export const RETRO_CHECKPOINTS = [
  { ratio: 0.25, id: 'level2-checkpoint-quarter-ambush', label: 'Checkpoint 25%' },
  { ratio: 0.5, id: 'level2-checkpoint-midpoint-elevator', label: 'Checkpoint 50%' },
  { ratio: 0.75, id: 'level2-checkpoint-final-corridor', label: 'Checkpoint 75%' }
] as const;

export function applyRetroRenderer(scene: Phaser.Scene): void {
  scene.cameras.main.setRoundPixels(true);
  scene.textures.list && Object.values(scene.textures.list).forEach((texture) => {
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  });
}

export function addRetroScreenOverlay(scene: Phaser.Scene, depth = 18): Phaser.GameObjects.Container {
  const { width, height } = scene.scale;
  const vignette = scene.add.rectangle(width / 2, height / 2, width, height, 0x120815, 0.16)
    .setScrollFactor(0)
    .setDepth(depth);
  vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);

  const scanlines = scene.add.graphics().setScrollFactor(0).setDepth(depth + 0.01);
  scanlines.lineStyle(1, 0x000000, 0.18);
  for (let y = 0; y < height; y += 4) {
    scanlines.lineBetween(0, y, width, y);
  }

  const edgeGlow = scene.add.rectangle(width / 2, height / 2, width - 6, height - 6, 0x000000, 0)
    .setStrokeStyle(3, 0xf6d365, 0.18)
    .setScrollFactor(0)
    .setDepth(depth + 0.02);

  return scene.add.container(0, 0, [vignette, scanlines, edgeGlow])
    .setScrollFactor(0)
    .setDepth(depth);
}

export function addCheckpointCinematicCard(
  scene: Phaser.Scene,
  title: string,
  subtitle: string,
  accentColor = 0xf6d365
): Phaser.GameObjects.Container {
  const { width, height } = scene.scale;
  const panel = scene.add.rectangle(width / 2, height * 0.28, width - 96, 108, 0x100913, 0.94)
    .setStrokeStyle(3, accentColor, 1);
  const stripe = scene.add.rectangle(96, height * 0.28 - 42, 72, 12, accentColor, 1).setOrigin(0, 0.5);
  const titleText = scene.add.text(width / 2, height * 0.28 - 14, title.toUpperCase(), {
    color: '#f4f0ff',
    fontFamily: RETRO_PIXEL_FONT,
    fontSize: '20px',
    fontStyle: 'bold',
    align: 'center'
  }).setOrigin(0.5);
  const subtitleText = scene.add.text(width / 2, height * 0.28 + 22, subtitle, {
    color: '#ceb9cf',
    fontFamily: RETRO_PIXEL_FONT,
    fontSize: '14px',
    align: 'center',
    wordWrap: { width: width - 160 }
  }).setOrigin(0.5);

  return scene.add.container(0, 0, [panel, stripe, titleText, subtitleText])
    .setScrollFactor(0)
    .setDepth(19)
    .setAlpha(0);
}
