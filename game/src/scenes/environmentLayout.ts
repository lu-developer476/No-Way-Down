import Phaser from 'phaser';

export type EnvironmentPropKind =
  | 'stone-column'
  | 'bank-counter'
  | 'turnstile'
  | 'atm'
  | 'bench'
  | 'recycling-box'
  | 'info-screen'
  | 'cart';

interface EnvironmentPropConfig {
  kind: EnvironmentPropKind;
  x: number;
  y: number;
  depth?: number;
  alpha?: number;
  scale?: number;
}

const PROP_TEXTURES: Record<EnvironmentPropKind, string> = {
  'stone-column': 'prop-stone-column',
  'bank-counter': 'prop-bank-counter',
  turnstile: 'prop-turnstile-grille',
  atm: 'prop-atm',
  bench: 'prop-bench',
  'recycling-box': 'prop-recycling-box',
  'info-screen': 'prop-info-screen',
  cart: 'prop-utility-cart'
};

export function addEnvironmentProp(scene: Phaser.Scene, config: EnvironmentPropConfig): Phaser.GameObjects.GameObject {
  const texture = PROP_TEXTURES[config.kind];
  if (texture && scene.textures.exists(texture)) {
    return scene.add.image(config.x, config.y, texture)
      .setDepth(config.depth ?? 6)
      .setAlpha(config.alpha ?? 1)
      .setScale(config.scale ?? 1);
  }

  return scene.add.rectangle(config.x, config.y, 32, 32, 0x64748b, 0.85)
    .setDepth(config.depth ?? 6)
    .setAlpha(config.alpha ?? 1);
}
