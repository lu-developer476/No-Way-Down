import Phaser from 'phaser';

/**
 * Ejemplo de carga del tileset y mapa JSON generado para Phaser 3.
 * Ejecutar antes: `npm --prefix game run generate:institutional-tileset`.
 */
export class InstitutionalHallTilesetExample extends Phaser.Scene {
  constructor() {
    super('InstitutionalHallTilesetExample');
  }

  preload(): void {
    this.load.image(
      'institutional-hall-tileset',
      'assets/images/tilesets/institutional_hall_tileset.png',
    );

    this.load.tilemapTiledJSON(
      'institutional-hall-map',
      'assets/images/tilesets/institutional_hall_tileset_map.json',
    );
  }

  create(): void {
    const map = this.make.tilemap({ key: 'institutional-hall-map' });
    const tileset = map.addTilesetImage(
      'institutional_hall_tileset',
      'institutional-hall-tileset',
      32,
      32,
      0,
      0,
    );

    if (!tileset) {
      return;
    }

    const baseLayer = map.createLayer('base', tileset, 0, 0);
    baseLayer?.setCollisionByProperty({ collides: true });

    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }
}
