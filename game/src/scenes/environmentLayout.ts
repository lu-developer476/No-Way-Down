import Phaser from 'phaser';

export type EnvironmentPropKind =
  | 'stone-column'
  | 'bank-counter'
  | 'turnstile'
  | 'atm'
  | 'bench'
  | 'recycling-box'
  | 'info-screen'
  | 'cart'
  | 'tall-window'
  | 'bronze-door'
  | 'service-table'
  | 'dining-table'
  | 'cafeteria-counter'
  | 'vending-machine'
  | 'menu-board'
  | 'mop-bucket';

export type EnvironmentPropAnchor = 'floor' | 'wall' | 'ceiling' | 'center';

export interface EnvironmentPropConfig {
  kind: EnvironmentPropKind;
  x: number;
  y: number;
  anchor: EnvironmentPropAnchor;
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
  cart: 'prop-utility-cart',
  'tall-window': 'prop-tall-window',
  'bronze-door': 'prop-bronze-door',
  'service-table': 'prop-service-table',
  'dining-table': 'prop-dining-table',
  'cafeteria-counter': 'prop-cafeteria-counter',
  'vending-machine': 'prop-vending-machine',
  'menu-board': 'prop-menu-board',
  'mop-bucket': 'prop-mop-bucket'
};

export function addEnvironmentProp(scene: Phaser.Scene, config: EnvironmentPropConfig): Phaser.GameObjects.GameObject {
  const texture = PROP_TEXTURES[config.kind];
  if (!config.anchor) throw new Error(`Environment prop ${config.kind} requires an explicit anchor.`);
  const origin = config.anchor === 'floor' ? { x: .5, y: 1 } : config.anchor === 'ceiling' ? { x: .5, y: 0 } : { x: .5, y: .5 };
  if (texture && scene.textures.exists(texture)) {
    return scene.add.image(config.x, config.y, texture)
      .setOrigin(origin.x, origin.y)
      .setDepth(config.depth ?? 6)
      .setAlpha(config.alpha ?? 1)
      .setScale(config.scale ?? 1);
  }

  return scene.add.image(config.x, config.y, 'prop-stone-column')
    .setTint(0x8c806d)
    .setOrigin(origin.x, origin.y)
    .setDepth(config.depth ?? 6)
    .setAlpha((config.alpha ?? 1) * 0.35)
    .setScale(config.scale ?? 0.8);
}
